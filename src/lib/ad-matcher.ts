// src/lib/ad-matcher.ts
export type DataRow = Record<string, string | number> & { _id?: string; createdAt?: string };

export function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./():#]/g, "");
}

export function readField(row: DataRow, aliases: string[]) {
  const key = Object.keys(row).find((candidate) =>
    aliases.some((alias) => normalizedKey(candidate) === normalizedKey(alias))
  );
  return key? String(row[key]?? "").trim() : "";
}

export function readNumber(row: DataRow, aliases: string[]) {
  const value = readField(row, aliases).replace(/[^\d.-]/g, "");
  return Number(value) || 0;
}

export function formatCompact(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("th-TH");
}

export function parseCampaignDate(row: DataRow): Date | null {
  const explicit = readField(row, ["date", "วันที่", "ช่วงเวลา"]);
  if (explicit) {
    const d = new Date(explicit);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const name = readField(row, ["แคมเปญ", "campaign", "campaign name"]);
  if (name) {
    const isoMatch = name.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
      if (!Number.isNaN(d.getTime())) return d;
    }
    const dmyMatch = name.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})/);
    if (dmyMatch) {
      let day = Number(dmyMatch[1]);
      let month = Number(dmyMatch[2]);
      let year = Number(dmyMatch[3]);
      if (year >= 2400) year -= 543;
      if (year < 100) year = year >= 50? 2000 + (year - 43) : 2000 + year;
      const d = new Date(year, month - 1, day);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  if (row.createdAt) {
    const d = new Date(String(row.createdAt));
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

export function matchAdWithCampaigns(ad: DataRow, campaignRows: DataRow[]): DataRow[] {
  const product = readField(ad, ["products", "product", "สินค้า"]);
  const creator = readField(ad, ["Creator", "creator", "KOL", "kol"]);
  const brand = readField(ad, ["brands", "brand", "แบรนด์"]);
  if (!product &&!creator) return [];

  const prodNorm = normalizedKey(product);
  const adEpMatch = creator.match(/(?:ep\.?\s*|#\s*|\s+|^)(\d+)(?:\s|$)/i);
  const targetEp = adEpMatch? adEpMatch[1] : null;
  const creatorClean = creator.replace(/(?:ep\.?\s*\d*|\b\d+\b)/gi, "").split(/[–-]/)[0].trim();
  const creatorTokens = creatorClean.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);
  const productTokens = product.toLowerCase().split(/\s+/).filter((t) => t.length >= 2);

  const scored = campaignRows.map((c) => {
    const cName = readField(c, ["แคมเปญ", "campaign", "campaign name"]);
    const cNorm = normalizedKey(cName);
    if (!cNorm || cNorm === "--") return { campaign: c, score: 0 };
    let score = 0;
    let creatorMatched = false;
    let productMatched = false;

    if (creatorClean && cNorm.includes(normalizedKey(creatorClean))) { score += 15; creatorMatched = true; }
    else { const m = creatorTokens.filter((t) => cNorm.includes(normalizedKey(t))).length; if(m>0){ score+=m*6; creatorMatched=true; } }

    if (prodNorm && cNorm.includes(prodNorm)) { score += 15; productMatched = true; }
    else { const m = productTokens.filter((t) => cNorm.includes(normalizedKey(t))).length; if(m>0){ score+=m*6; productMatched=true; } }

    if (creator && product && (!creatorMatched ||!productMatched)) return { campaign: c, score: 0 };
    if (brand && normalizedKey(brand).length >=3 && cNorm.includes(normalizedKey(brand))) score+=5;

    const cEpMatch = cName.match(/(?:ep\.?\s*|#\s*|\s+|^)(\d+)(?:\s|$)/i);
    const cEp = cEpMatch? cEpMatch[1] : null;
    if (targetEp && cEp) { if(targetEp===cEp) score+=10; else score-=20; }
    return { campaign: c, score };
  });

  const valid = scored.filter((s) => s.score >= 10);
  if (!valid.length) return [];
  const maxScore = Math.max(...valid.map((v) => v.score));
  return valid.filter((v) => v.score >= maxScore - 2).map((v) => v.campaign);
}