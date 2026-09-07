"use client";

import { useEffect, useMemo, useState } from "react";
import type { DemoUser } from "@/data/users";
import TopMenu from "@/components/top-menu";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Filter,
  MessageCircle,
  MousePointerClick,
  Sparkles,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type DataRow = Record<string, string | number> & { _id?: string; createdAt?: string };

type CarouselAdItem = {
  id: string;
  brand: string;
  product: string;
  campaign: string;
  creator: string;
  impressions: number;
  clicks: number;
  views: number;
  engagement: number;
  cpv: number;
  spend: number;
  ctr: number;
  grade: string;
  rating: string;
  insight: string;
  action: string;
  adsAngle: string;
  adsRole: string;
  matchedCount: number;
};

const demoRows: CarouselAdItem[] = [
  {
    id: "demo-1",
    brand: "Kieslect",
    product: "BIOKOOP",
    campaign: "Atom Ponlacha KIESLECT BIOKOOP 25-8-69 #1",
    creator: "Atom Ponlacha 1",
    impressions: 12785,
    clicks: 54,
    views: 3810,
    engagement: 1151,
    cpv: 0.13,
    spend: 505.96,
    ctr: 0.42,
    grade: "A+",
    rating: "4.8",
    insight: "ดูแลสุขภาพได้ครบ โดยไม่ต้องจ่ายรายเดือน + Recovery / Body Load ช่วยให้รู้ว่าร่างกายพร้อมแค่ไหน",
    action: "เพิ่มงบ — ใช้เป็น Creative หลัก และแตก Creative จาก Recovery / Body Load",
    adsAngle: "Health Tracking + Recovery Management",
    adsRole: "Hero / Consideration / Conversion",
    matchedCount: 2,
  },
  {
    id: "demo-2",
    brand: "Kieslect",
    product: "Notepods 10S",
    campaign: "PEEAKEWIT Kieslect AI Notepods 10S 13-8-69",
    creator: "PEEAKEWIT",
    impressions: 34280,
    clicks: 112,
    views: 14132,
    engagement: 14132,
    cpv: 0.08,
    spend: 1107.51,
    ctr: 0.33,
    grade: "A+",
    rating: "4.8",
    insight: "Feature AI แปลภาษาแบบเรียลไทม์ และฟังก์ชันตัดเสียงรบกวนที่เด่นชัด",
    action: "ดันงบ awareness ต่อเนื่องเพื่อขยายกลุ่มผู้ใช้งานวัยทำงาน",
    adsAngle: "AI Smart Features",
    adsRole: "Awareness / Consideration",
    matchedCount: 2,
  },
  {
    id: "demo-3",
    brand: "Kieslect",
    product: "Kieslect KS3",
    campaign: "วิดีโอ Kieslect Actor & Ks3-Munk TV 2025-11-25",
    creator: "Munk TV",
    impressions: 79924,
    clicks: 81,
    views: 13941,
    engagement: 13941,
    cpv: 0.11,
    spend: 1474.30,
    ctr: 0.10,
    grade: "A",
    rating: "4.4",
    insight: "รีวิวฟังก์ชันครบ จอแสดงผลสวยงาม และแบตเตอรี่อึดคุ้มค่าเกินราคา",
    action: "ปรับช่วงเปิดคลิปให้กระชับขึ้นเพื่อเพิ่ม Click Intent",
    adsAngle: "Value Proposition",
    adsRole: "Hero Creative",
    matchedCount: 2,
  },
];

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./():#]/g, "");
}

function readField(row: DataRow, aliases: string[]) {
  const key = Object.keys(row).find((candidate) =>
    aliases.some((alias) => normalizedKey(candidate) === normalizedKey(alias))
  );
  return key ? String(row[key] ?? "").trim() : "";
}

function readNumber(row: DataRow, aliases: string[]) {
  const value = readField(row, aliases).replace(/[^\d.-]/g, "");
  return Number(value) || 0;
}

function formatCompact(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("th-TH");
}

function parseCampaignDate(row: DataRow): Date | null {
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
      const day = Number(dmyMatch[1]);
      const month = Number(dmyMatch[2]);
      let year = Number(dmyMatch[3]);
      if (year >= 2400) year -= 543;
      else if (year < 100) {
        if (year >= 50) year = 2000 + (year - 43);
        else year = 2000 + year;
      }
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

function matchAdWithCampaigns(ad: DataRow, campaignRows: DataRow[]): DataRow[] {
  const product = readField(ad, ["products", "product", "สินค้า"]);
  const creator = readField(ad, ["Creator", "creator", "KOL", "kol"]);
  const brand = readField(ad, ["brands", "brand", "แบรนด์", "แบรนด์สินค้า", "BIOKOOP"]);

  if (!product && !creator) return [];

  const prodNorm = normalizedKey(product);

  const adEpMatch = creator.match(/(?:ep\.?\s*|#\s*|\s+|^)(\d+)(?:\s|$)/i);
  const targetEp = adEpMatch ? adEpMatch[1] : null;

  const creatorClean = creator
    .replace(/(?:ep\.?\s*\d*|\b\d+\b)/gi, "")
    .split(/[–-]/)[0]
    .trim();
  const creatorTokens = creatorClean
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2);

  const productTokens = product
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !["kieslect", "black", "shark"].includes(t));

  const scored = campaignRows.map((c) => {
    const cName = readField(c, ["แคมเปญ", "campaign", "campaign name"]);
    const cNorm = normalizedKey(cName);
    if (!cNorm || cNorm === "--") return { campaign: c, score: 0 };

    let score = 0;

    let creatorMatched = false;
    if (creatorClean && cNorm.includes(normalizedKey(creatorClean))) {
      score += 15;
      creatorMatched = true;
    } else {
      const matchCount = creatorTokens.filter((t) => cNorm.includes(normalizedKey(t))).length;
      if (matchCount > 0) {
        score += matchCount * 6;
        creatorMatched = true;
      }
    }

    let productMatched = false;
    if (prodNorm && cNorm.includes(prodNorm)) {
      score += 15;
      productMatched = true;
    } else {
      const pMatchCount = productTokens.filter((t) => cNorm.includes(normalizedKey(t))).length;
      if (pMatchCount > 0) {
        score += pMatchCount * 6;
        productMatched = true;
      }
    }

    if (creator && product && (!creatorMatched || !productMatched)) {
      return { campaign: c, score: 0 };
    }

    if (brand && normalizedKey(brand).length >= 3) {
      if (cNorm.includes(normalizedKey(brand))) {
        score += 5;
      }
    }

    const cEpMatch = cName.match(/(?:ep\.?\s*|#\s*|\s+|^)(\d+)(?:\s|$)/i);
    const cEp = cEpMatch ? cEpMatch[1] : null;
    if (targetEp && cEp) {
      if (targetEp === cEp) {
        score += 10;
      } else {
        score -= 20;
      }
    }

    return { campaign: c, score };
  });

  const valid = scored.filter((s) => s.score >= 10);
  if (!valid.length) return [];
  const maxScore = Math.max(...valid.map((v) => v.score));
  return valid.filter((v) => v.score >= maxScore - 2).map((v) => v.campaign);
}

export default function HomeClient() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<DataRow[]>([]);
  const [campaigns, setCampaigns] = useState<DataRow[]>([]);
  const [period, setPeriod] = useState<7 | 14 | 28>(28);
  const [carouselIndex, setCarouselIndex] = useState(0);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", window.localStorage.getItem("performance-theme") === "dark");
    const timer = window.setTimeout(() => {
      fetch("/api/auth")
        .then(async (response) => {
          if (!response.ok) return;
          const auth = (await response.json()) as { user?: DemoUser };
          if (!auth.user) return;
          setUser(auth.user);
          const [reportsResponse, campaignsResponse] = await Promise.all([
            fetch("/api/ad-reports"),
            fetch("/api/campaigns"),
          ]);
          const reportsData = await reportsResponse.json();
          const campaignsData = await campaignsResponse.json();
          if (reportsResponse.ok && Array.isArray(reportsData)) setReports(reportsData);
          if (campaignsResponse.ok && Array.isArray(campaignsData)) setCampaigns(campaignsData);
        })
        .catch((loadError: Error) => setError(loadError.message))
        .finally(() => setIsLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const campaignRowsWithDate = useMemo(() => {
    return campaigns
      .filter((row) => {
        const name = readField(row, ["แคมเปญ", "campaign"]);
        return name && name !== "--" && !/^(แคมเปญ|campaign)$/i.test(name);
      })
      .map((row) => ({
        row,
        date: parseCampaignDate(row),
      }));
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const datedRows = campaignRowsWithDate.filter((item) => item.date !== null);
    if (!datedRows.length) return campaignRowsWithDate.map((item) => item.row);

    const latestTime = Math.max(...datedRows.map((item) => item.date!.getTime()));
    const cutoffTime = latestTime - (period - 1) * 86400000;

    return campaignRowsWithDate
      .filter((item) => item.date === null || item.date!.getTime() >= cutoffTime)
      .map((item) => item.row);
  }, [campaignRowsWithDate, period]);

  const campaignSummary = useMemo(() => {
    const source = filteredCampaigns.length ? filteredCampaigns : (campaigns.length ? campaigns : []);
    if (!source.length) {
      return {
        campaigns: 12,
        impressions: 2740000,
        views: 94200,
        clicks: 94200,
        spend: 21850,
      };
    }
    const count = source.length;
    const impressions = source.reduce((sum, r) => sum + readNumber(r, ["การแสดงผล", "impressions"]), 0);
    const views = source.reduce((sum, r) => sum + readNumber(r, ["การดู TrueView", "views", "การดู"]), 0);
    const clicks = source.reduce((sum, r) => sum + readNumber(r, ["คลิก", "clicks"]), 0);
    const spend = source.reduce((sum, r) => sum + readNumber(r, ["ค่าใช้จ่าย", "spend", "cost"]), 0);

    return {
      campaigns: count,
      impressions,
      views,
      clicks,
      spend,
    };
  }, [filteredCampaigns, campaigns]);

  const carouselItems = useMemo<CarouselAdItem[]>(() => {
    if (!reports.length) return demoRows;

    return reports.map((ad, index) => {
      const product = readField(ad, ["products", "product", "สินค้า"]) || "ไม่ระบุสินค้า";
      const creator = readField(ad, ["Creator", "creator", "KOL", "kol"]) || "ไม่ระบุ Creator";
      const brand = readField(ad, ["brands", "brand", "แบรนด์", "แบรนด์สินค้า", "BIOKOOP"]) || "Kieslect";

      const matched = matchAdWithCampaigns(ad, campaigns);

      const impressions = matched.reduce((sum, c) => sum + readNumber(c, ["การแสดงผล", "impressions"]), 0) || readNumber(ad, ["การแสดงผล", "impressions"]);
      const clicks = matched.reduce((sum, c) => sum + readNumber(c, ["คลิก", "clicks"]), 0) || readNumber(ad, ["คลิก", "clicks"]);
      const views = matched.reduce((sum, c) => sum + readNumber(c, ["การดู TrueView", "views"]), 0);
      const engagement = matched.reduce((sum, c) => sum + readNumber(c, ["การโต้ตอบ", "engagement"]), 0) || (views > 0 ? views : readNumber(ad, ["การโต้ตอบ", "engagement"]));
      const spend = matched.reduce((sum, c) => sum + readNumber(c, ["ค่าใช้จ่าย", "spend", "cost"]), 0);

      const cpv = views > 0 ? spend / views : (matched.length ? matched.reduce((sum, c) => sum + readNumber(c, ["TrueView: CPV เฉลี่ย", "cpv"]), 0) / matched.length : readNumber(ad, ["TrueView: CPV เฉลี่ย", "cpv"]));

      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

      const uniqueCampaignNames = Array.from(new Set(matched.map((c) => readField(c, ["แคมเปญ", "campaign"])).filter(Boolean)));
      const campaignName = uniqueCampaignNames[0] || (uniqueCampaignNames.length > 1 ? `${uniqueCampaignNames[0]} (+${uniqueCampaignNames.length - 1})` : `${product} / ${creator}`);

      const insight =
        readField(ad, ["Winning Message", "จุดเด่น", "Hook / Selling Point", "Performance Signal"]) ||
        "จุดเด่นและ performance signal จากการวิเคราะห์แคมเปญ";

      const action = readField(ad, ["Action", "action", "ข้อแนะนำ"]);
      const adsAngle = readField(ad, ["Ads Angle", "angle"]);
      const adsRole = readField(ad, ["Ads Role", "role"]);

      const grade =
        readField(ad, ["grade", "rating", "ระดับ"]) ||
        (impressions >= 30000 || ctr >= 0.5 ? "A+" : impressions >= 10000 || ctr >= 0.3 ? "A" : "B+");

      const rating = grade === "A+" ? "4.8" : grade === "A" ? "4.4" : "4.0";

      return {
        id: String(ad._id || index),
        brand,
        product,
        campaign: campaignName,
        creator,
        impressions,
        clicks,
        views,
        engagement,
        cpv,
        spend,
        ctr,
        grade,
        rating,
        insight,
        action,
        adsAngle,
        adsRole,
        matchedCount: matched.length,
      };
    });
  }, [reports, campaigns]);

  const activeAd = carouselItems[carouselIndex % Math.max(carouselItems.length, 1)] || demoRows[0];

  const ctrOverall = campaignSummary.impressions ? (campaignSummary.clicks / campaignSummary.impressions) * 100 : 0;
  const avgCpvOverall = campaignSummary.views ? campaignSummary.spend / campaignSummary.views : 0;

  const metricCards: [string, string, LucideIcon, string, string][] = [
    [
      "Campaigns",
      campaignSummary.campaigns.toLocaleString("th-TH"),
      BarChart3,
      "text-[#c8102e]",
      `Last ${period} days`,
    ],
    [
      "Impressions",
      formatCompact(campaignSummary.impressions),
      Eye,
      "text-[#c8102e]",
      `Last ${period} days`,
    ],
    [
      "TrueView views",
      formatCompact(campaignSummary.views),
      Eye,
      "text-blue-600",
      `View rate ${campaignSummary.impressions ? ((campaignSummary.views / campaignSummary.impressions) * 100).toFixed(1) : "0"}%`,
    ],
    [
      "Clicks",
      formatCompact(campaignSummary.clicks),
      MousePointerClick,
      "text-emerald-600",
      `CTR ${ctrOverall.toFixed(2)}%`,
    ],
    [
      "Spend",
      `฿${campaignSummary.spend.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`,
      CircleDollarSign,
      "text-orange-500",
      `Avg CPV ฿${avgCpvOverall.toFixed(2)}`,
    ],
  ];

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-zinc-500">
        Loading workspace...
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors">
      <TopMenu user={user} />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c8102e]">
            Performance Reporting / Executive Summary
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Overview</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            ภาพรวมโฆษณาที่ทำผลงานดีที่สุด เชื่อมโยงข้อมูลแคมเปญและการวิเคราะห์ Ads ราย KOL
          </p>
        </div>

        <section className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <span className="flex items-center gap-2 text-sm font-semibold">
            <Filter size={16} className="text-[#c8102e]" /> Period
          </span>
          {([7, 14, 28] as const).map((days) => (
            <button
              key={days}
              onClick={() => {
                setPeriod(days);
                setCarouselIndex(0);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                period === days
                  ? "bg-[#c8102e] text-white shadow-sm"
                  : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"
              }`}
            >
              {days} Days
            </button>
          ))}
          <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
            {campaigns.length ? `${campaignSummary.campaigns} campaigns from Google Ads` : "Demo data"} · latest {period} days
          </span>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metricCards.map(([label, value, Icon, tone, subtitle]) => (
            <div
              className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              key={label}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
                <Icon size={20} className={tone} />
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
            </div>
          ))}
        </section>

        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                Ads Hero / KOL Performance
              </p>
              <h2 className="mt-1 text-xl font-semibold">Best Performing Ads by Brand / Product</h2>
            </div>
            <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
              <Sparkles size={14} className="text-amber-500" />
              <span>{carouselItems.length} KOL creatives analyzed</span>
            </div>
          </div>

          <div className="relative p-6 sm:p-9">
            <button
              aria-label="Previous ad"
              title="Previous ad"
              onClick={() => setCarouselIndex((i) => (i - 1 + carouselItems.length) % Math.max(carouselItems.length, 1))}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white p-2.5 text-zinc-700 shadow-md transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              aria-label="Next ad"
              title="Next ad"
              onClick={() => setCarouselIndex((i) => (i + 1) % Math.max(carouselItems.length, 1))}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border border-zinc-300 bg-white p-2.5 text-zinc-700 shadow-md transition hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
            >
              <ChevronRight size={20} />
            </button>

            <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-[#c8102e] px-3 py-1 text-xs font-bold text-white">
                    KOL / AD CREATIVE
                  </span>
                  <span className="text-lg font-bold text-[#c8102e]">
                    {activeAd.grade} ★ {activeAd.rating}
                  </span>
                  {activeAd.matchedCount > 0 && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                      เชื่อมโยง {activeAd.matchedCount} แคมเปญ
                    </span>
                  )}
                </div>

                <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Brand</dt>
                    <dd className="mt-1 font-semibold">{activeAd.brand}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Product</dt>
                    <dd className="mt-1 font-semibold">{activeAd.product}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 sm:col-span-2 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Campaign (จากหน้า Campaign)</dt>
                    <dd className="mt-1 font-semibold text-[#c8102e]">{activeAd.campaign}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 sm:col-span-2 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Creator (จากหน้า Ads Report)</dt>
                    <dd className="mt-1 font-semibold">{activeAd.creator}</dd>
                  </div>
                </dl>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:min-w-[440px] lg:grid-cols-2">
                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Impressions</span>
                    <Eye className="text-[#c8102e]" size={18} />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{formatCompact(activeAd.impressions)}</p>
                  <p className="mt-1 text-xs text-zinc-400">{activeAd.impressions.toLocaleString()} views total</p>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Clicks</span>
                    <MousePointerClick className="text-emerald-600" size={18} />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{formatCompact(activeAd.clicks)}</p>
                  <p className="mt-1 text-xs text-zinc-400">CTR {activeAd.ctr.toFixed(2)}%</p>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">Engagement</span>
                    <MessageCircle className="text-orange-500" size={18} />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{formatCompact(activeAd.engagement)}</p>
                  <p className="mt-1 text-xs text-zinc-400">TrueView {formatCompact(activeAd.views)}</p>
                </div>

                <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-4 dark:border-zinc-700/50 dark:bg-zinc-800">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">CPV</span>
                    <WalletCards className="text-zinc-500" size={18} />
                  </div>
                  <p className="mt-2 text-2xl font-bold tracking-tight">฿{activeAd.cpv.toFixed(2)}</p>
                  <p className="mt-1 text-xs text-zinc-400">Spend ฿{activeAd.spend.toLocaleString()}</p>
                </div>
              </div>
            </div>

            <div className="mt-7 space-y-3">
              <div className="rounded-xl border-l-4 border-[#c8102e] bg-zinc-50 p-4 text-sm leading-6 dark:bg-zinc-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Why it stands out (จาก Ads Report)
                </p>
                <p className="mt-2 font-medium">{activeAd.insight}</p>
              </div>

              {activeAd.action && (
                <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/20">
                  <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs font-bold text-white">Action</span>
                  <p className="text-emerald-900 dark:text-emerald-300">{activeAd.action}</p>
                </div>
              )}
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {carouselItems.map((ad, index) => (
                <button
                  key={ad.id}
                  aria-label={`Show ${ad.product} - ${ad.creator}`}
                  title={`${ad.product} - ${ad.creator}`}
                  onClick={() => setCarouselIndex(index)}
                  className={`h-2.5 transition-all ${
                    index === carouselIndex % Math.max(carouselItems.length, 1)
                      ? "w-8 rounded-full bg-[#c8102e]"
                      : "w-2.5 rounded-full bg-zinc-300 hover:bg-zinc-400 dark:bg-zinc-600 dark:hover:bg-zinc-500"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-semibold">Performance Highlights</h2>
            <div className="mt-4 space-y-3 text-sm">
              <p className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  Top Creative คือ <strong>{activeAd.creator}</strong> ({activeAd.product}) ทำได้{" "}
                  <strong>{formatCompact(activeAd.impressions)}</strong> impressions
                </span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  CTR รวมของช่วงเวลานี้อยู่ที่ <strong>{ctrOverall.toFixed(2)}%</strong>
                </span>
              </p>
              <p className="flex items-center gap-2">
                <span className="text-emerald-600 font-bold">✓</span>
                <span>
                  รวมแคมเปญที่มีผลงาน <strong>{campaignSummary.campaigns}</strong> แคมเปญ ในช่วง {period} วันล่าสุด
                </span>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <h2 className="font-semibold">Executive Insights</h2>
            <p className="mt-4 border-l-4 border-[#c8102e] pl-4 text-sm leading-7">
              {activeAd.insight}
            </p>
            <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
              ช่วงข้อมูล: ล่าสุด {period} วัน · {error || "ข้อมูลพร้อมใช้งาน"}
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
