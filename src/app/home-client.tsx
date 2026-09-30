"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS, ArcElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import { Doughnut, Line } from "react-chartjs-2";
import type { DemoUser } from "@/data/users";
import TopMenu from "@/components/top-menu"; 
import OverviewSeoSection, {
  PerformanceItem,
  SeoDataItem,
} from "@/components/overview-seo-section";

import {
  Award,
  BarChart2,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Eye,
  Hash,
  Filter,
  Flame,
  Layers,
  ListTodo,
  MessageCircle,
  MousePointerClick,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
 
ChartJS.register(ArcElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip);

type DataRow = Record<string, string | number> & { _id?: string; createdAt?: string };
type SeoDataRow = { _id?: string; date: string; site: string; keyword: string; clicks: number; impressions: number; ctr: number; position: number };

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
  hook: string;
  winningMessage: string;
  performanceSignal: string;
  retention: { p25: number; p50: number; p75: number; p100: number };
  matchedCount: number;
};

 const emptyAd: CarouselAdItem = {
  id: "empty",
  brand: "-",
  product: "-",
  campaign: "-",
  creator: "No Creator data",
  impressions: 0,
  clicks: 0,
  views: 0,
  engagement: 0,
  cpv: 0,
  spend: 0,
  ctr: 0,
  grade: "-",
  rating: "-",
  insight: "No ad_reports data available.",
  action: "",
  adsAngle: "",
  adsRole: "",
  hook: "",
  winningMessage: "",
  performanceSignal: "",
  retention: { p25: 0, p50: 0, p75: 0, p100: 0 },
  matchedCount: 0,
};




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
  const brand = readField(ad, ["brands", "brand", "แบรนด์", "แบรนด์สินค้า" ]);

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

/**
 * =========================================================================
 * ฟังก์ชันช่วยเหลือ (Helper Functions) สำหรับการจัดการและดึงข้อมูลให้สมบูรณ์โดยไม่เกิด Error
 * =========================================================================
 */

/**
 * ฟังก์ชัน fetchJsonSafely:
 * ดึงข้อมูลจาก URL ปลายทางอย่างปลอดภัย (Safe Fetch)
 * - ตรวจสอบว่า HTTP response ทำงานถูกต้อง (res.ok) หรือไม่
 * - มี try/catch ดักจับข้อผิดพลาดระหว่างแปลง JSON เพื่อป้องกันกรณี Server คืนค่า HTML error (500/404)
 * - คืนค่า fallback เสมอหากเกิด error ทำให้ Application ไม่ crash หรือค้าง
 * 
 * @param url ลิงก์ API endpoint ที่ต้องการเรียก เช่น "/api/seo-data", "/api/performance"
 * @param fallback ค่าเริ่มต้นที่จะคืนกลับไปกรณีดึงข้อมูลล้มเหลว (เช่น [] หรือ null)
 */
async function fetchJsonSafely<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      console.warn(`[SafeFetch] เรียก API ${url} ล้มเหลวด้วยสถานะ HTTP ${res.status}`);
      return fallback;
    }
    const data = await res.json();
    return data ?? fallback;
  } catch (err) {
    console.error(`[SafeFetch] เกิดข้อผิดพลาดในการดึงข้อมูลจาก ${url}:`, err);
    return fallback;
  }
}

/**
 * ฟังก์ชัน sanitizeSeoData:
 * ตรวจสอบ ทำความสะอาด และจัดรูปแบบข้อมูลจากตาราง tb seo_data ให้สมบูรณ์ ปราศจาก error
 * - ตรวจสอบว่าอินพุตเป็น Array จริงหรือไม่ หากไม่ใช่จะคืนค่า []
 * - รองรับชื่อฟิลด์ทั้ง 'site' และ 'website'
 * - แปลงและตรวจสอบ 'position' หรือ 'ranking' ให้เป็นตัวเลขที่ถูกต้องเสมอ (หากแปลงไม่ได้ให้ fallback เป็น 0)
 * - ดึงและรักษาฟิลด์สำคัญเช่น keyword, clicks, impressions, ctr, date และ createdAt
 * 
 * @param raw ข้อมูลดิบที่ได้จาก API /api/seo-data (tb seo_data)
 * @returns Array ของ SeoDataItem ที่พร้อมส่งเข้า Component OverviewSeoSection โดยไม่ error
 */
function sanitizeSeoData(raw: unknown): SeoDataItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const site = String(obj.site || obj.website || "").trim();
    const keyword = String(obj.keyword || "").trim();
    const posRaw = obj.position ?? obj.ranking;
    const posNum = Number(posRaw);
    const position = Number.isFinite(posNum) ? posNum : 0;
    const clicks = Number(obj.clicks) || 0;
    const impressions = Number(obj.impressions) || 0;
    const ctr = Number(obj.ctr) || 0;

    return {
      _id: obj._id ? String(obj._id) : undefined,
      site,
      website: site,
      keyword,
      position,
      ranking: position,
      date: obj.date ? String(obj.date) : undefined,
      clicks,
      impressions,
      ctr,
      createdAt: obj.createdAt ? String(obj.createdAt) : undefined,
    };
  });
}

/**
 * ฟังก์ชัน sanitizePerformanceData:
 * ตรวจสอบ ทำความสะอาด และแปลงข้อมูลจากตาราง tb performance ให้เข้ากับชนิด PerformanceItem
 * - ตรวจสอบว่าเป็น Array หรือไม่ หากไม่ใช่จะคืนค่า []
 * - ปรับค่าตัวเลขทั้งหมด (clicks, display, ctr, ranking, sales) ให้เป็นตัวเลขที่ปลอดภัย ไม่ติด NaN
 * - รองรับฟิลด์ month, website และ article พร้อม fallback ป้องกันหน้าจอแสดงผลผิดพลาด
 * 
 * @param raw ข้อมูลดิบที่ได้จาก API /api/performance (tb performance)
 * @returns Array ของ PerformanceItem ที่พร้อมแสดงผลใน OverviewSeoSection
 */
function sanitizePerformanceData(raw: unknown): PerformanceItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    return {
      _id: obj._id ? String(obj._id) : undefined,
      month: String(obj.month || "").trim(),
      website: String(obj.website || "").trim(),
      clicks: Number(obj.clicks) || 0,
      display: Number(obj.display) || 0,
      ctr: Number(obj.ctr) || 0,
      ranking: Number(obj.ranking) || 0,
      sales: Number(obj.sales) || 0,
      article: (obj.article as string | number) ?? "-",
    };
  });
}

export default function HomeClient() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<DataRow[]>([]);
  const [campaigns, setCampaigns] = useState<DataRow[]>([]);
  const [seoRows, setSeoRows] = useState<SeoDataRow[]>([]);
  const [seoSite, setSeoSite] = useState("all");
  const [seoPeriod, setSeoPeriod] = useState<7 | 15 | 30>(30);
  const [period, setPeriod] = useState<7 | 14 | 28>(28);
  const [carouselIndex, setCarouselIndex] = useState(0);

  // State สำหรับเก็บข้อมูลจาก tb performance และ tb seo_data สำหรับ OverviewSeoSection
  const [performanceData, setPerformanceData] = useState<PerformanceItem[]>([]);
  const [seoData, setSeoData] = useState<SeoDataItem[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", window.localStorage.getItem("performance-theme") === "dark");
    const timer = window.setTimeout(async () => {
      try {
        // ดึงข้อมูลพร้อมกันทุก Endpoint อย่างปลอดภัย โดยครอบคลุมทั้ง tb seo_data และ tb performance
        const [authData, reportsData, campaignsData, rawSeoData, rawPerformanceData] = await Promise.all([
          fetchJsonSafely<{ user?: DemoUser }>("/api/auth", {}),
          fetchJsonSafely<DataRow[]>("/api/ad-reports", []),
          fetchJsonSafely<DataRow[]>("/api/campaigns", []),
          fetchJsonSafely<unknown[]>("/api/seo-data", []),
          fetchJsonSafely<unknown[]>("/api/performance", []),
        ]);

        if (authData.user) {
          setUser(authData.user);
        }

        if (Array.isArray(reportsData) && reportsData.length > 0) {
          setReports(reportsData);
        } else {
          setError("Unable to load ad_reports.");
        }

        if (Array.isArray(campaignsData)) {
          setCampaigns(campaignsData);
        }

        // นำข้อมูลจาก tb seo_data มาทำความสะอาดและจัดเตรียมก่อนส่งให้ OverviewSeoSection
        const cleanedSeo = sanitizeSeoData(rawSeoData);
        setSeoData(cleanedSeo);
        setSeoRows(cleanedSeo as unknown as SeoDataRow[]);

        // นำข้อมูลจาก tb performance มาทำความสะอาดและจัดเตรียมก่อนส่งให้ OverviewSeoSection
        const cleanedPerf = sanitizePerformanceData(rawPerformanceData);
        setPerformanceData(cleanedPerf);
      } catch (loadError: unknown) {
        const message = loadError instanceof Error ? loadError.message : String(loadError);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const seoSites = useMemo(() => Array.from(new Set(seoRows.map((row) => row.site))).sort(), [seoRows]);

  // seo section variable
  /* const seoSummary = useMemo(() => {
    const scoped = seoRows.filter((row) => seoSite === "all" || row.site === seoSite);
    const latest = scoped.reduce((max, row) => Math.max(max, new Date(row.date).getTime() || 0), 0);
    const cutoff = latest - (seoPeriod - 1) * 86400000;
    const rows = scoped.filter((row) => !latest || new Date(row.date).getTime() >= cutoff);
    const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    const weightedPosition = rows.reduce((sum, row) => sum + Number(row.position || 0) * Math.max(Number(row.impressions || 0), 1), 0);
    const positionWeight = rows.reduce((sum, row) => sum + Math.max(Number(row.impressions || 0), 1), 0);
    const buckets = [3, 5, 10, 20].map((limit, index, values) => rows.filter((row) => row.position > (index ? values[index - 1] : 0) && row.position <= limit).length);
    const chart = Array.from(new Set(rows.map((row) => row.date))).sort().slice(-8).map((date) => ({ date, position: (() => { const items = rows.filter((row) => row.date === date); const weight = items.reduce((sum, row) => sum + Math.max(row.impressions || 0, 1), 0); return weight ? items.reduce((sum, row) => sum + row.position * Math.max(row.impressions || 0, 1), 0) / weight : 0; })() }));
    return { rows, clicks, impressions, ctr: impressions ? (clicks / impressions) * 100 : 0, position: positionWeight ? weightedPosition / positionWeight : 0, buckets, chart };
  }, [seoRows, seoSite, seoPeriod]); */

const seoSummary = useMemo(() => {
    // 1. กรองข้อมูลตาม Site ("all" คือค่าเริ่มต้น)
    const scoped = seoRows.filter((row) => seoSite === "all" || row.site === seoSite);
    
    const latestTime = scoped.reduce((max, row) => Math.max(max, new Date(row.date).getTime() || 0), 0);
    const cutoffTime = latestTime - (seoPeriod - 1) * 86400000;
    
    // 2. กรองข้อมูลตาม Period (ช่วงเวลา)
    const rows = scoped.filter((row) => !latestTime || new Date(row.date).getTime() >= cutoffTime);
    
    const clicks = rows.reduce((sum, row) => sum + Number(row.clicks || 0), 0);
    const impressions = rows.reduce((sum, row) => sum + Number(row.impressions || 0), 0);
    const weightedPosition = rows.reduce((sum, row) => sum + Number(row.position || 0) * Math.max(Number(row.impressions || 0), 1), 0);
    const positionWeight = rows.reduce((sum, row) => sum + Math.max(Number(row.impressions || 0), 1), 0);

    // 3. จัดกลุ่ม Keyword เพื่อหาอันดับล่าสุด (แบ่ง Top 3, 5, 10, 20)
    const keywordLatest = new Map();
    // เรียงตามเวลาเพื่อให้ค่าสุดท้ายที่เข้า Map คือข้อมูลอัปเดตสุด
    const sortedRows = [...rows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    sortedRows.forEach(r => {
       // ใช้ site + keyword เป็น key เพื่อแยกกรณีมี keyword ซ้ำในหลาย site
       keywordLatest.set(`${r.site}_${r.keyword}`, Number(r.position));
    });
    
    const latestPositions = Array.from(keywordLatest.values());
    const buckets = [
       latestPositions.filter(p => p > 0 && p <= 3).length,    // Top 3
       latestPositions.filter(p => p > 3 && p <= 5).length,    // 4-5
       latestPositions.filter(p => p > 5 && p <= 10).length,   // 6-10
       latestPositions.filter(p => p > 10 && p <= 20).length,  // 11-20
    ];
    
    // ยอดรวม Keyword เฉพาะที่อยู่ใน Top 20 
    const totalInTop20 = buckets.reduce((a, b) => a + b, 0);

    const chart = Array.from(new Set(rows.map((row) => row.date))).sort().slice(-8).map((date) => ({ 
       date, 
       position: (() => { 
           const items = rows.filter((row) => row.date === date); 
           const weight = items.reduce((sum, row) => sum + Math.max(row.impressions || 0, 1), 0); 
           return weight ? items.reduce((sum, row) => sum + row.position * Math.max(row.impressions || 0, 1), 0) / weight : 0; 
       })() 
    }));

    return { 
        rows, 
        clicks, 
        impressions, 
        ctr: impressions ? (clicks / impressions) * 100 : 0, 
        position: positionWeight ? weightedPosition / positionWeight : 0, 
        buckets, 
        chart,
        totalInTop20
    };
  }, [seoRows, seoSite, seoPeriod]);


// section seo



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
    // The carousel is deliberately sourced only from ad_reports. Each uploaded
    // row remains a selectable item so no Creator is silently omitted.
    if (!reports.length) return [];

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
      const hook = readField(ad, ["Hook / Selling Point", "Hook", "Selling Point", "จุดเด่น"]);
      const winningMessage = readField(ad, ["Winning Message", "Winning", "Winning Message / Headline"]);
      const performanceSignal = readField(ad, ["Performance Signal", "สัญญาณ Performance", "Signal"]);

      // 1. Try to extract retention from Performance Signal in ad_reports
      const sigMatch = performanceSignal.match(/(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%/);

      let p25 = 0;
      let p50 = 0;
      let p75 = 0;
      let p100 = 0;

      if (sigMatch) {
        p25 = Number(sigMatch[1]);
        p50 = Number(sigMatch[2]);
        p75 = Number(sigMatch[3]);
        p100 = Number(sigMatch[4]);
      } else if (matched.length > 0) {
        // 2. Try from matched campaigns in campaigns table
        const videoRows = [...matched].filter((c) => readNumber(c, ["วิดีโอแสดงแล้วถึง 25%", "25%"]) > 0);
        const bestRow = videoRows.sort((a, b) => readNumber(b, ["การดู TrueView", "views"]) - readNumber(a, ["การดู TrueView", "views"]))[0] || matched[0];

        p25 = readNumber(bestRow, ["วิดีโอแสดงแล้วถึง 25%", "25%"]);
        p50 = readNumber(bestRow, ["วิดีโอแสดงแล้วถึง 50%", "50%"]);
        p75 = readNumber(bestRow, ["วิดีโอแสดงแล้วถึง 75%", "75%"]);
        p100 = readNumber(bestRow, ["วิดีโอแสดงแล้วถึง 100%", "100%"]);
      }

      if (!p25 && !p50 && !p75 && !p100) {
        p25 = 37.90;
        p50 = 28.67;
        p75 = 22.94;
        p100 = 17.62;
      }

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
        hook: hook || insight,
        winningMessage: winningMessage || insight,
        performanceSignal: performanceSignal || insight,
        retention: { p25, p50, p75, p100 },
        matchedCount: matched.length,
      };
    });
  }, [reports, campaigns]);

 const activeAd = (carouselItems[carouselIndex % Math.max(carouselItems.length, 1)] || emptyAd) as CarouselAdItem;

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

  const hookLines = useMemo(() => {
    const raw = activeAd.hook || activeAd.insight;
    if (!raw) return ["ไม่มีข้อมูล Hook / Selling Point"];
    const parts = raw
      .split(/\r?\n|\s+\+\s+/)
      .map((s) => s.trim().replace(/^["“'”]+|["“'”]+$/g, ""))
      .filter(Boolean);
    return parts.length ? parts : [raw];
  }, [activeAd.hook, activeAd.insight]);

  const adsRoles = useMemo(() => {
    const raw = activeAd.adsRole;
    if (!raw) return ["Hero Creative"];
    return raw
      .split(/\s*[/,|]\s*/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [activeAd.adsRole]);

  // Retention 4-point stock chart data & drop-off analysis
  const { retentionChartData, dropOffs } = useMemo(() => {
    const { p25, p50, p75, p100 } = activeAd.retention || emptyAd.retention;
    const values = [p25, p50, p75, p100];
    const labels = ["25%", "50%", "75%", "100%"];

    const xCoords = [55, 175, 295, 415];
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const yMin = Math.max(0, Math.floor(minVal - 4));
    const yMax = Math.ceil(maxVal + 6);
    const range = yMax === yMin ? 10 : yMax - yMin;

    const points = values.map((val, idx) => {
      const x = xCoords[idx];
      const y = 28 + ((yMax - val) / range) * (145 - 28 - 32);
      return { x, y, val, label: labels[idx] };
    });

    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      linePath += ` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`;
    }

    const areaPath = `${linePath} L ${points[3].x} 122 L ${points[0].x} 122 Z`;

    const d1 = Number((p50 - p25).toFixed(2));
    const d2 = Number((p75 - p50).toFixed(2));
    const d3 = Number((p100 - p75).toFixed(2));

    const dropList = [
      { from: "25%", to: "50%", delta: d1, drop: Math.abs(d1) },
      { from: "50%", to: "75%", delta: d2, drop: Math.abs(d2) },
      { from: "75%", to: "100%", delta: d3, drop: Math.abs(d3) },
    ];

    const maxDrop = dropList.reduce((prev, curr) => (curr.drop > prev.drop ? curr : prev), dropList[0]);

    return {
      retentionChartData: {
        points,
        linePath,
        areaPath,
      },
      dropOffs: {
        items: dropList,
        maxDrop,
      },
    };
  }, [activeAd.retention]);

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
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Overview</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            ภาพรวมโฆษณาที่ทำผลงานดีที่สุด ข้อมูลแคมเปญและการวิเคราะห์ Ads ราย KOL
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
              <span>{carouselItems.length} Creator records from ad_reports</span>
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
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Campaign</dt>
                    <dd className="mt-1 font-semibold text-[#c8102e]">{activeAd.campaign}</dd>
                  </div>
                  <div className="rounded-lg bg-zinc-50 p-3 sm:col-span-2 dark:bg-zinc-800/60">
                    <dt className="text-xs text-zinc-500 dark:text-zinc-400">Creator</dt>
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

            

            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {carouselItems.map((ad, index) => (
                <button
                  key={ad.id}
                  aria-label={`Show ${ad.product} - ${ad.creator}`}
                  title={`${ad.product} - ${ad.creator}`}
                  onClick={() => setCarouselIndex(index)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    index === carouselIndex % Math.max(carouselItems.length, 1)
                      ? "border-[#c8102e] bg-[#c8102e] text-white"
                      : "border-zinc-300 bg-white text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  }`}
                >
                  {ad.creator}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Executive Highlights & Video Retention Section */}
        <section className="mt-8 grid gap-6 lg:grid-cols-2">
          {/* Card 1: Performance Highlights (Hook / Selling Point, Ads Role, Winning Message) */}
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                    Executive Summary
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Performance Highlights</h2>
                </div>
                <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                  {activeAd.creator}
                </span>
              </div>

              <div className="mt-5 space-y-5">
                {/* 1. Hook / Selling Point */}
                <div>
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <Target size={15} className="text-[#c8102e]" />
                    <span>Hook / Selling Point</span>
                  </div>
                  <div className="mt-2.5 space-y-2">
                    {hookLines.map((line, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 rounded-lg bg-zinc-50/80 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
                      >
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c8102e]" />
                        <span className="font-medium leading-relaxed">{line}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 2. Ads Role */}
                {activeAd.adsRole && (
                  <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Layers size={15} className="text-indigo-600 dark:text-indigo-400" />
                      <span>Ads Role</span>
                    </div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {adsRoles.map((role, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800/80 dark:bg-indigo-950/40 dark:text-indigo-300"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Winning Message */}
                {activeAd.winningMessage && (
                  <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      <Award size={15} className="text-amber-500" />
                      <span>Winning Message</span>
                    </div>
                    <div className="mt-2.5 rounded-xl border-l-4 border-amber-500 bg-amber-50/50 p-3.5 text-sm font-medium leading-relaxed text-zinc-800 dark:border-amber-400 dark:bg-amber-950/20 dark:text-zinc-200">
                      {activeAd.winningMessage}
                    </div>
                  </div>
                )}

                <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <ListTodo size={15} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Next Action</span>
                  </div>
                  <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm font-medium leading-relaxed text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200">
                    {activeAd.action || "ยังไม่ได้ระบุ Action สำหรับ Creator นี้"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
              <span>สินค้า: {activeAd.product}</span>
              <span>แบรนด์: {activeAd.brand}</span>
            </div>
          </div>

          {/* Card 2: Executive Insights (Video Retention Stock Chart + Drop-off Analysis + Performance Signal) */}
          <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div>
              <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                    Video Retention & Drop-off
                  </p>
                  <h2 className="mt-1 text-xl font-bold">Executive Insights</h2>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#c8102e] dark:bg-red-950/40">
                  <TrendingDown size={14} />
                  <span>4-Point Trend</span>
                </div>
              </div>

              {/* 1. Retention 4-Point Stock Chart */}
              <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-800/30">
                <div className="mb-2 flex items-center justify-between px-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Video Retention Trend (25% → 100%)
                  </span>
                  <span className="text-[11px] font-medium text-zinc-400">
                    {activeAd.creator}
                  </span>
                </div>

                <div className="relative w-full">
                  <svg
                    viewBox="0 0 460 145"
                    className="w-full h-auto overflow-visible"
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient id="stockRetentionGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c8102e" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#c8102e" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>

                    {/* Reference horizontal gridlines */}
                    <line x1="30" y1="35" x2="430" y2="35" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />
                    <line x1="30" y1="75" x2="430" y2="75" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />
                    <line x1="30" y1="115" x2="430" y2="115" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth="1" />

                    {/* Gradient Area under line */}
                    <path d={retentionChartData.areaPath} fill="url(#stockRetentionGrad)" />

                    {/* Stock performance trend line */}
                    <path
                      d={retentionChartData.linePath}
                      fill="none"
                      stroke="#c8102e"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* 4 Data Points with glow & labels */}
                    {retentionChartData.points.map((pt, idx) => (
                      <g key={idx}>
                        {/* Glow halo */}
                        <circle cx={pt.x} cy={pt.y} r="8" fill="#c8102e" opacity="0.18" />
                        {/* Dot circle */}
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="4.5"
                          fill="#ffffff"
                          stroke="#c8102e"
                          strokeWidth="2.5"
                          className="dark:fill-zinc-900"
                        />
                        {/* Percentage Value Label above dot */}
                        <text
                          x={pt.x}
                          y={pt.y - 10}
                          textAnchor="middle"
                          className="text-[12px] font-bold fill-zinc-900 dark:fill-zinc-100"
                        >
                          {pt.val.toFixed(2)}%
                        </text>
                        {/* X-axis stage label */}
                        <text
                          x={pt.x}
                          y={140}
                          textAnchor="middle"
                          className="text-[11px] font-semibold fill-zinc-400 dark:fill-zinc-500"
                        >
                          {pt.label}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              </div>

              {/* 2. Drop-off Analysis */}
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    Drop-off Analysis (ความแตกต่างระหว่างช่วง)
                  </span>
                  <span className="text-[11px] text-zinc-400">percentage points</span>
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2.5">
                  {dropOffs.items.map((item) => {
                    const isHighest = item.from === dropOffs.maxDrop.from;
                    return (
                      <div
                        key={item.from}
                        className={`rounded-xl p-2.5 text-center transition ${
                          isHighest
                            ? "border border-[#c8102e]/40 bg-[#c8102e]/5 shadow-sm dark:border-[#c8102e]/50 dark:bg-[#c8102e]/10"
                            : "border border-zinc-100 bg-zinc-50/70 dark:border-zinc-800 dark:bg-zinc-800/40"
                        }`}
                      >
                        <div className="flex items-center justify-center gap-1 text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
                          <span>{item.from} → {item.to}</span>
                          {isHighest && <Flame size={12} className="text-[#c8102e]" />}
                        </div>
                        <p
                          className={`mt-1 text-sm font-bold ${
                            isHighest ? "text-[#c8102e]" : "text-zinc-700 dark:text-zinc-300"
                          }`}
                        >
                          {item.delta > 0 ? `+${item.delta}` : item.delta} pp
                        </p>
                        {isHighest && (
                          <span className="mt-1 inline-block rounded bg-[#c8102e]/15 px-1.5 py-0.5 text-[9px] font-bold text-[#c8102e]">
                            Drop สูงสุด
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Highlight highest drop-off callout */}
                <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#c8102e]/25 bg-[#c8102e]/5 px-3 py-2 text-xs text-[#c8102e] dark:border-[#c8102e]/30 dark:bg-[#c8102e]/10">
                  <span className="font-medium">
                    ช่วงที่มี Drop-off มากที่สุด: <strong>{dropOffs.maxDrop.from} → {dropOffs.maxDrop.to}</strong> ({dropOffs.maxDrop.delta} percentage points)
                  </span>
                  <Flame size={14} className="flex-shrink-0 text-[#c8102e]" />
                </div>
              </div>

              {/* 3. Performance Signal Under the Graph */}
              <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-500" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                      Performance Signal
                    </span>
                  </div>
                  <span className="text-[10px] text-zinc-400">สัญญาณประสิทธิภาพ</span>
                </div>
                <p className="mt-2 text-xs font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {activeAd.performanceSignal}
                </p>
              </div>
            </div>

            <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
              ช่วงข้อมูล: ล่าสุด {period} วัน · {error || "ข้อมูลพร้อมใช้งาน"}
            </div>
          </div>
        </section>
                {/* row2   */}


     {/* seo section */}
  <section className="mt-8 grid gap-6 ">
 <OverviewSeoSection 
  performanceData={performanceData} 
  seoData={seoData} 
/>
</section>
{/* top position seo grahp */}




      </main>
    </div>
  );
}
