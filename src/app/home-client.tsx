"use client";

import { useEffect, useMemo, useState } from "react";
import { Chart as ChartJS, ArcElement, CategoryScale, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";
import TopMenu from "@/components/top-menu";
import OverviewSeoSection, { PerformanceItem, SeoDataItem } from "@/components/overview-seo-section";
import { OverviewHeader } from "@/components/home/overview-header";
import { MonthFilter } from "@/components/home/month-filter";
import { AdsHeroCarousel } from "@/components/home/ads-hero-carousel";
import { ExecutiveInsights } from "@/components/home/executive-insights";
import { fetchJsonSafely, sanitizeSeoData, sanitizePerformanceData } from "@/lib/safe-fetch";
import type { DemoUser } from "@/data/users";
import {
  Award, BarChart3, CircleDollarSign, Eye, Filter, Flame, Layers, ListTodo, MousePointerClick, Sparkles, Target, TrendingDown,
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
  ret25: number; ret50: number; ret75: number; ret100: number;
  hookRaw: string;
};

const emptyAd: CarouselAdItem = {
  id: "empty", brand: "-", product: "-", campaign: "-", creator: "No Creator data",
  impressions: 0, clicks: 0, views: 0, engagement: 0, cpv: 0, spend: 0, ctr: 0,
  grade: "-", rating: "-", insight: "No ad_reports data", action: "", adsAngle: "", adsRole: "", hook: "", winningMessage: "", performanceSignal: "",
  retention: { p25: 0, p50: 0, p75: 0, p100: 0 }, matchedCount: 0,
  ret25: 0, ret50: 0, ret75: 0, ret100: 0, hookRaw: ""
};

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./():#]/g, "");
}
function readField(row: DataRow, aliases: string[]) {
  const key = Object.keys(row).find((c) => aliases.some((a) => normalizedKey(c) === normalizedKey(a)));
  return key? String(row[key]?? "").trim() : "";
}
function readNumber(row: DataRow, aliases: string[]) {
  const v = readField(row, aliases).replace(/[^\d.-]/g, "");
  return Number(v) || 0;
}
function formatCompact(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("th-TH");
}
function parseCampaignDate(row: DataRow): Date | null {
  const explicit = readField(row, ["date", "วันที่", "ช่วงเวลา"]);
  if (explicit) { const d = new Date(explicit); if (!Number.isNaN(d.getTime())) return d; }
  const name = readField(row, ["แคมเปญ", "campaign"]);
  if (name) {
    const isoMatch = name.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) { const d = new Date(Number(isoMatch[1]), Number(isoMatch[2])-1, Number(isoMatch[3])); if (!Number.isNaN(d.getTime())) return d; }
  }
  if (row.createdAt) { const d = new Date(String(row.createdAt)); if (!Number.isNaN(d.getTime())) return d; }
  return null;
}
function matchAdWithCampaigns(ad: DataRow, campaignRows: DataRow[]): DataRow[] {
  const product = readField(ad, ["products", "product", "สินค้า"]);
  const creator = readField(ad, ["Creator", "creator", "KOL"]);
  const brand = readField(ad, ["brands", "brand", "แบรนด์"]);
  if (!product &&!creator) return [];
  const prodNorm = normalizedKey(product);
  const creatorClean = creator.replace(/(?:ep\.?\s*\d*|\b\d+\b)/gi, "").split(/[–-]/)[0].trim();
  const creatorTokens = creatorClean.toLowerCase().split(/\s+/).filter(t=>t.length>=2);
  const scored = campaignRows.map(c=>{
    const cName = readField(c, ["แคมเปญ", "campaign"]);
    const cNorm = normalizedKey(cName);
    if (!cNorm || cNorm==="--") return { campaign: c, score: 0 };
    let score=0;
    if (creatorClean && cNorm.includes(normalizedKey(creatorClean))) score+=15;
    else { const m = creatorTokens.filter(t=>cNorm.includes(normalizedKey(t))).length; if (m>0) score+=m*6; }
    if (prodNorm && cNorm.includes(prodNorm)) score+=15;
    if (brand && cNorm.includes(normalizedKey(brand))) score+=5;
    return { campaign: c, score };
  });
  const valid = scored.filter(s=>s.score>=10);
  if (!valid.length) return [];
  const maxScore = Math.max(...valid.map(v=>v.score));
  return valid.filter(v=>v.score>=maxScore-2).map(v=>v.campaign);
}

export default function HomeClient() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [reports, setReports] = useState<DataRow[]>([]);
  const [campaigns, setCampaigns] = useState<DataRow[]>([]);
  const [seoRows, setSeoRows] = useState<SeoDataRow[]>([]);
  const [seoSite] = useState("all");
  const [seoPeriod] = useState<7 | 15 | 30>(30);
  const [period, setPeriod] = useState<7 | 14 | 28>(28);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [performanceData, setPerformanceData] = useState<PerformanceItem[]>([]);
  const [seoData, setSeoData] = useState<SeoDataItem[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      try {
        const [authData, reportsData, campaignsData, rawSeoData, rawPerformanceData] = await Promise.all([
          fetchJsonSafely<{ user?: DemoUser }>("/api/auth", {}),
          fetchJsonSafely<DataRow[]>("/api/ad-reports", []),
          fetchJsonSafely<DataRow[]>("/api/campaigns", []),
          fetchJsonSafely<unknown[]>("/api/seo-data", []),
          fetchJsonSafely<unknown[]>("/api/performance", []),
        ]);
        if (authData.user) setUser(authData.user);
        if (Array.isArray(reportsData) && reportsData.length>0) setReports(reportsData); else setError("Unable to load ad_reports.");
        if (Array.isArray(campaignsData)) setCampaigns(campaignsData);
        const cleanedSeo = sanitizeSeoData(rawSeoData);
        setSeoData(cleanedSeo);
        setSeoRows(cleanedSeo as unknown as SeoDataRow[]);
        setPerformanceData(sanitizePerformanceData(rawPerformanceData));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const campaignRowsWithDate = useMemo(() => campaigns.filter(r=>{ const n=readField(r,["แคมเปญ","campaign"]); return n && n!=="--"; }).map(row=>({ row, date: parseCampaignDate(row) })), [campaigns]);


 /*  const filteredCampaigns = useMemo(() => {
    const dated = campaignRowsWithDate.filter(i=>i.date!==null);
    if (!dated.length) return campaignRowsWithDate.map(i=>i.row);
    const latest = Math.max(...dated.map(i=>i.date!.getTime()));
    const cutoff = latest - (period-1)*86400000;
    return campaignRowsWithDate.filter(i=>i.date===null || i.date!.getTime()>=cutoff).map(i=>i.row);
  }, [campaignRowsWithDate, period]); */
// แทนที่ filteredCampaigns เดิม
const availableMonths = useMemo(() => {
  const months = campaigns.map(r => String(r["เดือน"] || r["month"] || "").trim()).filter(Boolean);
  return Array.from(new Set(months)).sort();
}, [campaigns]);

const [selectedMonth, setSelectedMonth] = useState<string>("all");

const filteredCampaigns = useMemo(() => {
  if (selectedMonth === "all") return campaigns;
  return campaigns.filter(r => String(r["เดือน"] || r["month"] || "").trim() === selectedMonth);
}, [campaigns, selectedMonth]);


  const campaignSummary = useMemo(() => {
    const source = filteredCampaigns.length? filteredCampaigns : campaigns;
    if (!source.length) return { campaigns: 12, impressions: 2740000, views: 94200, clicks: 94200, spend: 21850 };
    return {
      campaigns: source.length,
      impressions: source.reduce((s,r)=>s+readNumber(r,["การแสดงผล","impressions"]),0),
      views: source.reduce((s,r)=>s+readNumber(r,["การดู TrueView","views"]),0),
      clicks: source.reduce((s,r)=>s+readNumber(r,["คลิก","clicks"]),0),
      spend: source.reduce((s,r)=>s+readNumber(r,["ค่าใช้จ่าย","spend"]),0),
    };
  }, [filteredCampaigns, campaigns]);

  const carouselItems = useMemo<CarouselAdItem[]>(() => {
    if (!reports.length) return [];
    // แก้ซ้ำ: ใช้ Map ด้วย key ที่เป็น campaign + creator + _id จริง
    const uniqueMap = new Map<string, CarouselAdItem>();
    reports.forEach((ad, index) => {
      const product = readField(ad, ["products","product","สินค้า"]) || "ไม่ระบุสินค้า";
      const creator = readField(ad, ["Creator","creator","KOL"]) || "ไม่ระบุ Creator";
      const brand = readField(ad, ["brands","brand","แบรนด์"]) || "Kieslect";
      const campaignRaw = readField(ad, ["แคมเปญ","campaign"]) || product;
      const key = `${campaignRaw}__${brand}__${creator}__${String(ad._id || index)}`; // Unique จริง
      if (uniqueMap.has(key)) return;

      const matched = matchAdWithCampaigns(ad, campaigns);
      const impressions = matched.reduce((s,c)=>s+readNumber(c,["การแสดงผล"]),0) || readNumber(ad,["การแสดงผล"]);
      const clicks = matched.reduce((s,c)=>s+readNumber(c,["คลิก"]),0) || readNumber(ad,["คลิก"]);
      const views = matched.reduce((s,c)=>s+readNumber(c,["การดู TrueView"]),0);
      const engagement = matched.reduce((s,c)=>s+readNumber(c,["การโต้ตอบ"]),0) || views;
      const spend = matched.reduce((s,c)=>s+readNumber(c,["ค่าใช้จ่าย"]),0);
      const cpv = views>0? spend/views : 0;
      const ctr = impressions>0? (clicks/impressions)*100 : 0;
      const uniqueCampaignNames = Array.from(new Set(matched.map(c=>readField(c,["แคมเปญ","campaign"])).filter(Boolean)));
      const campaignName = uniqueCampaignNames[0] || campaignRaw;
      const insight = readField(ad, ["Winning Message","Hook / Selling Point","Performance Signal"]) || "";
      const action = readField(ad, ["Action","action"]);
      const adsRole = readField(ad, ["Ads Role","role"]);
      const hook = readField(ad, ["Hook / Selling Point","Hook","จุดเด่น"]);
      const winningMessage = readField(ad, ["Winning Message"]);
      const performanceSignal = readField(ad, ["Performance Signal"]);

      let p25=0,p50=0,p75=0,p100=0;
      const sigMatch = performanceSignal.match(/(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%\s*→\s*(\d+(?:\.\d+)?)%/);
      if (sigMatch) { p25=Number(sigMatch[1]); p50=Number(sigMatch[2]); p75=Number(sigMatch[3]); p100=Number(sigMatch[4]); }
      else if (matched.length>0) {
        const bestRow = [...matched].sort((a,b)=>readNumber(b,["การดู TrueView"])-readNumber(a,["การดู TrueView"]))[0] || matched[0];
        p25=readNumber(bestRow,["วิดีโอแสดงแล้วถึง 25%"]); p50=readNumber(bestRow,["วิดีโอแสดงแล้วถึง 50%"]); p75=readNumber(bestRow,["วิดีโอแสดงแล้วถึง 75%"]); p100=readNumber(bestRow,["วิดีโอแสดงแล้วถึง 100%"]);
      }
      if (!p25 &&!p50 &&!p75 &&!p100) { p25=37.9; p50=28.67; p75=22.94; p100=17.62; }

      uniqueMap.set(key, {
        id: String(ad._id || key),
        brand, product, campaign: campaignName, creator,
        impressions, clicks, views, engagement, cpv, spend, ctr,
        grade: readField(ad,["grade"]) || (impressions>=30000?"A+":"A"),
        rating: "4.8",
        insight, action, adsAngle: readField(ad,["Ads Angle"]), adsRole, hook: hook||insight, winningMessage: winningMessage||insight, performanceSignal: performanceSignal||insight,
        retention: { p25, p50, p75, p100 },
        ret25: p25, ret50: p50, ret75: p75, ret100: p100,
        matchedCount: matched.length, hookRaw: hook
      });
    });
    return Array.from(uniqueMap.values());
  }, [reports, campaigns]);

  const activeAd = (carouselItems[carouselIndex % Math.max(carouselItems.length, 1)] || emptyAd) as CarouselAdItem;
  const ctrOverall = campaignSummary.impressions? (campaignSummary.clicks/campaignSummary.impressions)*100 : 0;
  const avgCpvOverall = campaignSummary.views? campaignSummary.spend/campaignSummary.views : 0;

  const metricCards: [string, string, LucideIcon, string, string][] = [
    ["Campaigns", campaignSummary.campaigns.toLocaleString("th-TH"), BarChart3, "text-[#c8102e]", `Last ${period} days`],
    ["Impressions", formatCompact(campaignSummary.impressions), Eye, "text-[#c8102e]", `Last ${period} days`],
    ["TrueView views", formatCompact(campaignSummary.views), Eye, "text-blue-600", `View rate ${campaignSummary.impressions? ((campaignSummary.views/campaignSummary.impressions)*100).toFixed(1):"0"}%`],
    ["Clicks", formatCompact(campaignSummary.clicks), MousePointerClick, "text-emerald-600", `CTR ${ctrOverall.toFixed(2)}%`],
    ["Spend", `฿${campaignSummary.spend.toLocaleString("th-TH",{maximumFractionDigits:2})}`, CircleDollarSign, "text-orange-500", `Avg CPV ฿${avgCpvOverall.toFixed(2)}`],
  ];

  const hookLines = useMemo(() => {
    const raw = activeAd.hook || activeAd.insight;
    if (!raw) return ["ไม่มีข้อมูล Hook / Selling Point"];
    return raw.split(/\r?\n|\s+\+\s+/).map(s=>s.trim().replace(/^["“'”]+|["“'”]+$/g,"")).filter(Boolean);
  }, [activeAd]);

  const adsRoles = useMemo(() => {
    const raw = activeAd.adsRole;
    if (!raw) return ["Hero Creative"];
    return raw.split(/\s*[/,|]\s*/).map(s=>s.trim()).filter(Boolean);
  }, [activeAd]);

  const { retentionChartData, dropOffs } = useMemo(() => {
    const { p25,p50,p75,p100 } = activeAd.retention || emptyAd.retention;
    const values = [p25,p50,p75,p100];
    const labels = ["25%","50%","75%","100%"];
    const xCoords = [55,175,295,415];
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const yMin = Math.max(0, Math.floor(minVal-4));
    const yMax = Math.ceil(maxVal+6);
    const range = yMax===yMin?10:yMax-yMin;
    const points = values.map((val,idx)=>({ x: xCoords[idx], y: 28 + ((yMax-val)/range)*(145-28-32), val, label: labels[idx] }));
    let linePath = `M ${points[0].x} ${points[0].y}`;
    for (let i=0;i<points.length-1;i++){ const p0=points[i]; const p1=points[i+1]; const cx=(p0.x+p1.x)/2; linePath+=` C ${cx} ${p0.y}, ${cx} ${p1.y}, ${p1.x} ${p1.y}`; }
    const areaPath = `${linePath} L ${points[3].x} 122 L ${points[0].x} 122 Z`;
    const d1=Number((p50-p25).toFixed(2)), d2=Number((p75-p50).toFixed(2)), d3=Number((p100-p75).toFixed(2));
    const dropList = [{ from:"25%", to:"50%", delta:d1, drop:Math.abs(d1) }, { from:"50%", to:"75%", delta:d2, drop:Math.abs(d2) }, { from:"75%", to:"100%", delta:d3, drop:Math.abs(d3) }];
    const maxDrop = dropList.reduce((prev,curr)=>curr.drop>prev.drop?curr:prev, dropList[0]);
    return { retentionChartData: { points, linePath, areaPath }, dropOffs: { items: dropList, maxDrop } };
  }, [activeAd]);

  if (isLoading) return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-zinc-500">Loading workspace...</main>;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <TopMenu user={user} />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <OverviewHeader />
        {/* <PeriodFilter period={period} setPeriod={setPeriod} setCarouselIndex={setCarouselIndex} count={campaignSummary.campaigns} /> */}
        <MonthFilter months={availableMonths} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} count={campaignSummary.campaigns} />

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metricCards.map(([label, value, Icon, tone, subtitle]) => (
            <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900" key={label}>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</span>
                <Icon size={20} className={tone} />
              </div>
              <p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p>
              <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{subtitle}</p>
            </div>
          ))}
        </section>

        <AdsHeroCarousel carouselItems={carouselItems} activeAd={activeAd} carouselIndex={carouselIndex} setCarouselIndex={setCarouselIndex} />
        <ExecutiveInsights activeAd={activeAd} hookLines={hookLines} adsRoles={adsRoles} retentionChartData={retentionChartData} dropOffs={dropOffs} period={period} error={error} />

        <section className="mt-8 grid gap-6">
          <OverviewSeoSection performanceData={performanceData} seoData={seoData} />
        </section>
      </main>
    </div>
  );
}