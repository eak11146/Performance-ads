"use client";

import { useMemo, useState } from "react";
import { Line, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { TrendingUp, BarChart2 } from "lucide-react";

// ลงทะเบียน Chart.js Modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

// Types
export type PerformanceItem = {
  _id?: string;
  month: string;
  website: string;
  clicks: number;
  display: number;
  ctr: number;
  ranking: number;
  sales: number;
  article: string | number;
};

export type SeoDataItem = {
  _id?: string;
  site?: string;
  website?: string;
  keyword?: string;
  position?: number;
  ranking?: number;
};

// Helper ฟังก์ชันแปลงตัวเลขย่อ (เช่น 52.9K, 3.38M)
function formatCompact(val: number) {
  if (!val || !Number.isFinite(val)) return "0";
  if (val >= 1_000_000) return (val / 1_000_000).toFixed(2) + "M";
  if (val >= 1_000) return (val / 1_000).toFixed(1) + "K";
  return val.toLocaleString();
}




export default function OverviewSeoSection({
  performanceData = [],
  seoData = [],
}: {
  performanceData: PerformanceItem[];
  seoData?: SeoDataItem[];
}) {
  // State การ์ดฝั่งซ้าย (Performance)
  const [perfSite, setPerfSite] = useState<string>("all");
  const [perfMetric, setPerfMetric] = useState<
    "clicks" | "display" | "ctr" | "ranking" | "sales" | "article"
  >("clicks");

    const MONTH_ORDER: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    june: 6, jul: 7, july: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
    };

    function getMonthIndex(monthStr: string): number {
    if (!monthStr) return 0;
    const str = String(monthStr).trim().toLowerCase();
    for (const [key, index] of Object.entries(MONTH_ORDER)) {
        if (str.includes(key)) return index;
    }
    const match = str.match(/\d{4}[-/](\d{1,2})/);
    if (match) return Number(match[1]);
    return 0;
    }

  // State การ์ดฝั่งขวา (SEO Keywords)
  const [seoSite, setSeoSite] = useState<string>("all");

  // ป้องกันกรณีส่งค่า null หรือไม่ใช่ Array เข้ามา
  const safePerfData = useMemo(() => (Array.isArray(performanceData) ? performanceData : []), [performanceData]);
  const safeSeoData = useMemo(() => (Array.isArray(seoData) ? seoData : []), [seoData]);

  // รายชื่อเว็บไซต์ทั้งหมดจากทั้งสองตาราง (tb performance และ tb seo_data)
  const performanceSites = useMemo(() => {
    return Array.from(new Set(safePerfData.map((item) => item?.website || "").filter(Boolean)));
  }, [safePerfData]);

  const seoDataSites = useMemo(() => {
    return Array.from(new Set(safeSeoData.map((item) => item?.site || item?.website || "").filter(Boolean)));
  }, [safeSeoData]);

  // -------------------------------------------------------------
  // LOGIC 1: การ์ดฝั่งซ้าย (Performance Stock-style Chart จาก tb performance)
  // -------------------------------------------------------------
  const perfSummary = useMemo(() => {
    const filtered = safePerfData.filter((item) => {
      if (!item) return false;
      if (perfSite === "all") return true;
      return (item.website || "").toLowerCase() === perfSite.toLowerCase();
    });

    // เรียงตาม Month จากอดีตไปปัจจุบัน
    const sorted = [...filtered].sort((a, b) => {
    const indexA = getMonthIndex(a.month);
    const indexB = getMonthIndex(b.month);
    if (indexA !== indexB) {
        return indexA - indexB;
    }
    return String(a.month || "").localeCompare(String(b.month || ""));
    });

    const totalClicks = sorted.reduce((sum, item) => sum + Number(item?.clicks || 0), 0);
    const totalDisplay = sorted.reduce((sum, item) => sum + Number(item?.display || 0), 0);
    const avgCtr = sorted.length
      ? sorted.reduce((sum, item) => sum + Number(item?.ctr || 0), 0) / sorted.length
      : 0;
    const avgRanking = sorted.length
      ? sorted.reduce((sum, item) => sum + Number(item?.ranking || 0), 0) / sorted.length
      : 0;
    const totalSales = sorted.reduce((sum, item) => sum + Number(item?.sales || 0), 0);
    //const totalArticles = sorted.reduce((sum, item) => sum + Number(item?.article || 0), 0);
   /*  สาเหตุเกิดจากในข้อมูลของคุณ ค่าของ article บางแถวส่งมาเป็น string (เช่น "6", "12", หรือ "-") ทำให้เมื่อเรานำไปคำนวณด้วย .reduce() ผลลัพธ์ตัวแปร perfSummary.article จึงกลายเป็น String ไม่ใช่ Number และเมื่อสั่ง .toLocaleString() บน String โปรแกรมจึงโยน Error ออกมาครับ

วิธีแก้ไข (ทำได้ 2 จุด)
จุดที่ 1: ปรับปรุงการคำนวณ totalArticles ใน perfSummary ให้แปลงเป็น Number เสมอ
ในไฟล์ components/overview-seo-section.tsx ตรงส่วนการคำนวณ perfSummary ให้เปลี่ยนบรรทัด totalArticles เป็นดังนี้ครับ: */

 

// ✅ แก้ไขใหม่ (แปลงค่า string/number ให้เป็นตัวเลขที่ปลอดภัยเสมอ)
const totalArticles = sorted.reduce((sum, item) => {
  const val = typeof item.article === "number" 
    ? item.article 
    : parseFloat(String(item.article || "").replace(/[^0-9.-]/g, ""));
  return sum + (Number.isFinite(val) ? val : 0);
}, 0);


    return {
      clicks: totalClicks,
      display: totalDisplay,
      ctr: avgCtr,
      ranking: avgRanking,
      sales: totalSales,
      article: totalArticles,
      chart: sorted,
    };
  }, [safePerfData, perfSite]);

  // สเปกกราฟของแต่ละ Metric ฝั่ง Performance
  const metricConfig = {
    clicks: {
      label: "Clicks",
      color: "#c8102e",
      bgColor: "rgba(200,16,46,0.12)",
      format: (v: number) => formatCompact(v),
      reverseY: false,
    },
    display: {
      label: "Display / Impressions",
      color: "#2563eb",
      bgColor: "rgba(37,99,235,0.12)",
      format: (v: number) => formatCompact(v),
      reverseY: false,
    },
    ctr: {
      label: "AVR. CTR (%)",
      color: "#059669",
      bgColor: "rgba(5,150,105,0.12)",
      format: (v: number) => `${v.toFixed(2)}%`,
      reverseY: false,
    },
    ranking: {
      label: "Ranking",
      color: "#d97706",
      bgColor: "rgba(217,119,6,0.12)",
      format: (v: number) => v.toFixed(1),
      reverseY: true, // ranking ยิ่งน้อยยิ่งอยู่อันดับสูง
    },
    sales: {
      label: "Sales (฿)",
      color: "#7c3aed",
      bgColor: "rgba(124,58,237,0.12)",
      format: (v: number) => `฿${formatCompact(v)}`,
      reverseY: false,
    },
    article: {
      label: "Articles",
      color: "#0891b2",
      bgColor: "rgba(8,145,178,0.12)",
      format: (v: number) => v.toLocaleString(),
      reverseY: false,
    },
  }[perfMetric];

  // -------------------------------------------------------------
  // LOGIC 2: การ์ดฝั่งขวา (Tracked Keywords Buckets จาก tb seo_data)
  // -------------------------------------------------------------
  const seoSummary = useMemo(() => {
    // 1. กรองตามเว็บไซต์ที่เลือก (รองรับทั้งฟิลด์ site และ website)
    const filtered = safeSeoData.filter((item) => {
      if (!item) return false;
      if (seoSite === "all") return true;
      const siteName = item.site || item.website || "";
      return siteName.toLowerCase() === seoSite.toLowerCase();
    });

    // 2. จัดกลุ่ม Keyword เพื่อนำอันดับล่าสุด (Latest Ranking) มาคำนวณ
    // ป้องกันปัญหากรณีข้อมูลใน tb seo_data มีหลายวัน (Historical tracking) แล้วทำให้นับ Keyword ซ้ำซ้อน
    const keywordMap = new Map<string, number>();

    // เรียงลำดับตามวันที่ (date หรือ createdAt) จากอดีตไปปัจจุบัน เพื่อให้ข้อมูลล่าสุด overwrite ใน Map
    const sorted = [...filtered].sort((a, b) => {
      const dateA = new Date(String((a as Record<string, unknown>).date || (a as Record<string, unknown>).createdAt || 0)).getTime();
      const dateB = new Date(String((b as Record<string, unknown>).date || (b as Record<string, unknown>).createdAt || 0)).getTime();
      return (Number.isNaN(dateA) ? 0 : dateA) - (Number.isNaN(dateB) ? 0 : dateB);
    });

    sorted.forEach((item) => {
      if (!item) return;
      const siteKey = String(item.site || item.website || "all").trim().toLowerCase();
      const kwKey = String(item.keyword || "").trim().toLowerCase();
      const pos = Number(item.position ?? item.ranking ?? 0);

      // ถ้ามี keyword ให้ระบุ key เป็น site + keyword
      // หากไม่มี keyword ให้ใช้ _id หรือตำแหน่ง index เพื่อให้แสดงผลได้ครบถ้วน
      const uniqueKey = kwKey ? `${siteKey}:::${kwKey}` : (item._id ? String(item._id) : Math.random().toString());
      keywordMap.set(uniqueKey, pos);
    });

    // 3. จัดหมวดหมู่อันดับ: Buckets: [Top 3 (1-3), Top 5 (4-5), Top 10 (6-10), Top 20 (11-20)]
    const buckets = [0, 0, 0, 0];

    keywordMap.forEach((pos) => {
      if (pos >= 1 && pos <= 3) {
        buckets[0]++;
      } else if (pos >= 4 && pos <= 5) {
        buckets[1]++;
      } else if (pos >= 6 && pos <= 10) {
        buckets[2]++;
      } else if (pos >= 11 && pos <= 20) {
        buckets[3]++;
      }
    });

    const totalInTop20 = buckets.reduce((a, b) => a + b, 0);

    return {
      buckets,
      totalInTop20,
      totalKeywords: keywordMap.size,
    };
  }, [safeSeoData, seoSite]);

  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      {/* ==================== CARD 1: Performance Stock Chart (ฝั่งซ้าย - tb performance) ==================== */}
      <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          {/* Header Card 1 */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                Performance Trend
              </p>
              <h2 className="mt-1 text-xl font-bold">Performance Overview</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#c8102e] dark:bg-red-950/40">
              <TrendingUp size={14} />
              <span>Monthly Data</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <select
              value={perfSite}
              onChange={(e) => setPerfSite(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="all">All Websites (ทุกเว็บ)</option>
              {performanceSites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>

            {/* Metric Switcher */}
            <div className="flex flex-wrap gap-1 text-xs">
              {(
                [
                  { key: "clicks", label: "CLICK" },
                  { key: "display", label: "DISPLAY" },
                  { key: "ctr", label: "AVR.CTR" },
                  { key: "ranking", label: "Ranking" },
                  { key: "sales", label: "Sales" },
                  { key: "article", label: "Article" },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPerfMetric(m.key)}
                  className={`rounded-md px-2 py-1 text-xs font-medium transition ${
                    perfMetric === m.key
                      ? "bg-[#c8102e] text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Metrics Summary Grid */}
          <div className="mt-4 grid grid-cols-3 gap-2 border-y border-zinc-100 py-3 text-center dark:border-zinc-800 sm:grid-cols-6">
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Clicks</p>
              <p className="mt-0.5 text-sm font-bold">{formatCompact(perfSummary.clicks)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Display</p>
              <p className="mt-0.5 text-sm font-bold">{formatCompact(perfSummary.display)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">AVR.CTR</p>
              <p className="mt-0.5 text-sm font-bold">{perfSummary.ctr.toFixed(2)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Ranking</p>
              <p className="mt-0.5 text-sm font-bold">{perfSummary.ranking.toFixed(1)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Sales</p>
              <p className="mt-0.5 text-sm font-bold">฿{formatCompact(perfSummary.sales)}</p>
            </div>
            <div>
              <p className="text-[10px] text-zinc-500 uppercase">Articles</p>
             {/*  <p className="mt-0.5 text-sm font-bold">{perfSummary.article.toLocaleString()}</p> 
             ปรับตรง JSX การแสดงผล ให้ปลอดภัย 100%
ตรงจุดที่แสดงผล {perfSummary.article.toLocaleString()} ให้ใส่ตัวช่วยแปลงเป็น Number ก่อนเรียกฟังก์ชันครับ:
             
             */}
             <p className="mt-0.5 text-sm font-bold">  {Number(perfSummary.article || 0).toLocaleString()}</p>
              
            </div>
          </div>

          {/* Stock Line Chart */}
          {perfSummary.chart.length > 0 ? (
            <div className="mt-4 h-56">
              <Line
                data={{
                  labels: perfSummary.chart.map((point) => point.month || "N/A"),
                  datasets: [
                    {
                      label: metricConfig.label,
                      data: perfSummary.chart.map((point) => Number(point[perfMetric] || 0)),
                      borderColor: metricConfig.color,
                      backgroundColor: metricConfig.bgColor,
                      fill: true,
                      tension: 0.25,
                      pointRadius: 4,
                      pointHoverRadius: 6,
                      pointBackgroundColor: metricConfig.color,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context) =>
                          ` ${metricConfig.label}: ${metricConfig.format(Number(context.raw))}`,
                      },
                    },
                  },
                  scales: {
                    x: { grid: { display: false }, ticks: { color: "#71717a", font: { size: 10 } } },
                    y: {
                      reverse: metricConfig.reverseY,
                      grid: { color: "rgba(113,113,122,.15)" },
                      ticks: { color: "#71717a", font: { size: 10 } },
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-zinc-500">
              ไม่พบข้อมูล Performance สำหรับเว็บไซต์นี้
            </div>
          )}
        </div>
      </div>

      {/* ==================== CARD 2: Ranking Distribution Donut (ฝั่งขวา - tb seo_data) ==================== */}
      <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          {/* Header Card 2 */}
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                Tracked Keywords
              </p>
              <h2 className="mt-1 text-xl font-bold">Ranking Distribution</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#c8102e] dark:bg-red-950/40">
              <BarChart2 size={14} />
              <span>Site: {seoSite === "all" ? "All" : seoSite}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="mt-4 flex items-center justify-between">
            <select
              value={seoSite}
              onChange={(e) => setSeoSite(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="all">All Sites (ทุกเว็บ)</option>
              {seoDataSites.map((site) => (
                <option key={site} value={site}>
                  {site}
                </option>
              ))}
            </select>
            <span className="text-xs text-zinc-500">
              Total Keywords: <strong>{seoSummary.totalKeywords}</strong>
            </span>
          </div>

          {/* Donut Chart & Legend */}
          {seoSummary.totalInTop20 > 0 ? (
            <div className="mt-6 flex flex-col items-center gap-8 sm:flex-row sm:justify-center">
              {/* Donut Graph */}
              <div className="relative h-48 w-48">
                <Doughnut
                  data={{
                    labels: ["Top 3", "Top 5 (4-5)", "Top 10 (6-10)", "Top 20 (11-20)"],
                    datasets: [
                      {
                        data: seoSummary.buckets,
                        backgroundColor: ["#c8102e", "#ef4444", "#f59e0b", "#94a3b8"],
                        borderWidth: 0,
                        hoverOffset: 5,
                      },
                    ],
                  }}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: "70%",
                    plugins: { legend: { display: false } },
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-3xl font-bold text-zinc-800 dark:text-white">
                    {seoSummary.totalInTop20}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    Keywords
                  </span>
                </div>
              </div>

              {/* Legend List */}
              <div className="space-y-3">
                {[
                  { label: "Top 3", color: "#c8102e" },
                  { label: "Top 5 (4-5)", color: "#ef4444" },
                  { label: "Top 10 (6-10)", color: "#f59e0b" },
                  { label: "Top 20 (11-20)", color: "#94a3b8" },
                ].map((item, index) => (
                  <div key={item.label} className="flex items-center gap-3 text-sm">
                    <span
                      className="h-3 w-3 rounded-full shadow-sm"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="w-28 font-medium text-zinc-600 dark:text-zinc-400">
                      {item.label}
                    </span>
                    <strong className="text-base text-zinc-900 dark:text-zinc-100">
                      {seoSummary.buckets[index]}
                    </strong>
                    <span className="text-xs text-zinc-400">
                      (
                      {seoSummary.totalInTop20 > 0
                        ? ((seoSummary.buckets[index] / seoSummary.totalInTop20) * 100).toFixed(0)
                        : 0}
                      %)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex h-48 flex-col items-center justify-center text-center text-sm text-zinc-500">
              <p>ไม่พบข้อมูล Keyword ที่ติดอันดับ Top 20</p>
              <p className="mt-1 text-xs">ลองเลือกร้านค้าอื่น หรืออัปโหลดข้อมูลใน SEO Data</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}