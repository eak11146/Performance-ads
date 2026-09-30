// src/lib/safe-fetch.ts
export async function fetchJsonSafely<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return fallback;
    const data = await res.json();
    return data ?? fallback;
  } catch {
    return fallback;
  }
}

export function sanitizeSeoData(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    const obj = item || {};
    const site = String(obj.site || obj.website || "").trim();
    const posNum = Number(obj.position ?? obj.ranking);
    return {
      _id: obj._id ? String(obj._id) : undefined,
      site,
      website: site,
      keyword: String(obj.keyword || "").trim(),
      position: Number.isFinite(posNum) ? posNum : 0,
      ranking: Number.isFinite(posNum) ? posNum : 0,
      date: obj.date ? String(obj.date) : undefined,
      clicks: Number(obj.clicks) || 0,
      impressions: Number(obj.impressions) || 0,
      ctr: Number(obj.ctr) || 0,
      createdAt: obj.createdAt ? String(obj.createdAt) : undefined,
    };
  });
}

export function sanitizePerformanceData(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    _id: item._id ? String(item._id) : undefined,
    month: String(item.month || "").trim(),
    website: String(item.website || "").trim(),
    clicks: Number(item.clicks) || 0,
    display: Number(item.display) || 0,
    ctr: Number(item.ctr) || 0,
    ranking: Number(item.ranking) || 0,
    sales: Number(item.sales) || 0,
    article: item.article ?? "-",
  }));
}