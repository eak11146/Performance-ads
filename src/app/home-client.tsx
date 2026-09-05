"use client";

import { useEffect, useMemo, useState } from "react";
import type { DemoUser } from "@/data/users";
import TopMenu from "@/components/top-menu";
import { CheckCircle2, CircleDollarSign, Filter, PlayCircle, TrendingUp, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Doughnut } from "react-chartjs-2";
import { ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LineElement, LinearScale, PointElement, Tooltip } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, Filler, Legend, LineElement, BarElement, ArcElement, PointElement, Tooltip);

type ReportRow = Record<string, string> & { _id?: string };
type InsightRow = { date: string; product: string; creator: string; creative: string; angle: string; hook: string; role: string; signal: string; message: string; action: string };

const demoRows: InsightRow[] = [
  { date: "Aug 69", product: "S3", creator: "Munk TV", creative: "Hero", angle: "Value for money", hook: "Smartwatch ที่ครบและดูเกินราคา", role: "Hero", signal: "High retention", message: "ไม่ถึง ฿2,000 แต่ได้ Smartwatch ที่ครบและดูเกินราคา", action: "Keep Always-on" },
  { date: "Aug 69", product: "S3", creator: "Gadget Vader", creative: "Proof", angle: "Product proof", hook: "GPS / Running test", role: "Performance Proof", signal: "Strong click intent", message: "ครบทุกฟังก์ชันสำหรับสายวิ่ง", action: "Keep as proof" },
  { date: "Aug 69", product: "S3", creator: "Run With Me", creative: "Proof", angle: "Running lifestyle", hook: "วิ่งจริง ใช้ GPS จริง", role: "Test", signal: "Needs more data", message: "GPS แม่นสำหรับการซ้อมทุกวัน", action: "Produce Shorts" },
];

function normalizedKey(value: string) {
  return value.toLowerCase().replace(/[\s_\-./()]/g, "");
}

function readField(row: ReportRow, aliases: string[]) {
  const keys = Object.keys(row);
  const match = keys.find((key) => aliases.some((alias) => normalizedKey(key) === normalizedKey(alias)));
  return match ? row[match] : "";
}

function normalizeReports(rows: ReportRow[]): InsightRow[] {
  return rows.map((row) => ({
    date: readField(row, ["date", "วันที่"]) || "ไม่ระบุวันที่",
    product: readField(row, ["products", "product", "สินค้า"]) || "ไม่ระบุสินค้า",
    creator: readField(row, ["Creator", "creator", "KOL", "kol"]) || "ไม่ระบุ Creator",
    creative: readField(row, ["จุดเด่น", "creative", "key creative"]) || "-",
    angle: readField(row, ["Ads Angle", "angle"]) || "-",
    hook: readField(row, ["Hook / Selling Point", "hook", "selling point"]) || "-",
    role: readField(row, ["Ads Role", "role"]) || "-",
    signal: readField(row, ["Performance Signal", "performance"]) || "-",
    message: readField(row, ["Winning Message", "message"]) || "-",
    action: readField(row, ["Action", "action", "marketing action"]) || "-",
  }));
}

export default function HomeClient() {
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState("");
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [selectedDate, setSelectedDate] = useState("All dates");
  const [selectedProduct, setSelectedProduct] = useState("All products");
  const [selectedCreator, setSelectedCreator] = useState("All creators");
  const [strategyPage, setStrategyPage] = useState(1);
  const [strategyPageSize, setStrategyPageSize] = useState(5);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("performance-theme");
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    const timer = window.setTimeout(() => {
      fetch("/api/auth")
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json() as { user?: DemoUser };
          if (!data.user) return;
          setUser(data.user);
          const reportsResponse = await fetch("/api/ad-reports");
          const reportsData = await reportsResponse.json();
          if (!reportsResponse.ok) throw new Error(reportsData.error || "Unable to load reports");
          if (!Array.isArray(reportsData)) throw new Error("Unable to load reports");
          setReports(reportsData);
        })
        .catch((loadError: Error) => setProjectsError(loadError.message))
        .finally(() => setIsLoading(false));
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const allRows = reports.length ? normalizeReports(reports) : demoRows;
  const dates = Array.from(new Set(allRows.map((row) => row.date)));
  const products = Array.from(new Set(allRows.map((row) => row.product)));
  const creators = Array.from(new Set(allRows.map((row) => row.creator)));
  const filteredRows = useMemo(() => allRows.filter((row) => (selectedDate === "All dates" || row.date === selectedDate) && (selectedProduct === "All products" || row.product === selectedProduct) && (selectedCreator === "All creators" || row.creator === selectedCreator)), [allRows, selectedDate, selectedProduct, selectedCreator]);
  const strategyPageCount = Math.max(1, Math.ceil(filteredRows.length / strategyPageSize));
  const visibleStrategyRows = filteredRows.slice((strategyPage - 1) * strategyPageSize, strategyPage * strategyPageSize);
  const creativeCounts = filteredRows.reduce<Record<string, number>>((result, row) => { result[row.creative] = (result[row.creative] || 0) + 1; return result; }, {});
  const signalCount = filteredRows.filter((row) => row.signal !== "-" && row.signal.trim()).length;
  const actions = Array.from(new Set(filteredRows.map((row) => row.action).filter((action) => action !== "-")));
  const statusCounts = [filteredRows.filter((row) => /high|strong|ดี|ชนะ|winning/i.test(row.signal)).length, filteredRows.filter((row) => /test|ทดลอง|need|data|รอ/i.test(row.signal)).length, filteredRows.filter((row) => /stop|หยุด|ต่ำ|weak/i.test(row.signal)).length];
  const metricCards: [string, string, LucideIcon, string][] = [["Core creatives", Object.keys(creativeCounts).length.toString(), CircleDollarSign, "text-[#c8102e]"], ["Content rows", filteredRows.length.toString(), CheckCircle2, "text-emerald-600"], ["Performance signals", signalCount.toString(), TrendingUp, "text-orange-500"], ["Recommended actions", actions.length.toString(), PlayCircle, "text-zinc-500"]];

  if (isLoading) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-slate-500">Loading workspace...</main>;
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors">
      <TopMenu user={user} />

      <main id="top" className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-14">
        <div className="mb-8"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#c8102e]">Performance Reporting / Executive Summary</p><h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Overview</h1><p className="mt-3 max-w-xl text-sm leading-6 text-zinc-500 dark:text-zinc-400">ภาพรวม Content และ Ads Signal จากข้อมูลที่วิเคราะห์แล้วใน Sheet</p></div>
        <section className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><span className="mr-1 flex items-center gap-2 text-sm font-semibold"><Filter size={16} className="text-[#c8102e]" /> Filters</span><select aria-label="Filter by date" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setStrategyPage(1); }}><option>All dates</option>{dates.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by product" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800" value={selectedProduct} onChange={(event) => { setSelectedProduct(event.target.value); setStrategyPage(1); }}><option>All products</option>{products.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="Filter by creator" className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-800" value={selectedCreator} onChange={(event) => { setSelectedCreator(event.target.value); setStrategyPage(1); }}><option>All creators</option>{creators.map((item) => <option key={item}>{item}</option>)}</select><span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">{reports.length ? "Imported sheet data" : "Demo data"} · {filteredRows.length} rows selected</span></section>
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{metricCards.map(([label, value, Icon, tone]) => <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900" key={label}><div className="flex items-center justify-between"><span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span><Icon size={19} className={tone} /></div><p className="mt-4 text-2xl font-semibold tracking-tight">{value}</p><p className="mt-1 text-xs text-emerald-600">+12.8% vs last period</p></div>)}</section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]"><div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><div className="mb-5 flex items-center justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">Creative strategy</p><h2 className="mt-2 font-semibold">Core creatives</h2></div><Users size={18} className="text-zinc-400" /></div><div className="space-y-3">{Object.entries(creativeCounts).map(([creative, count]) => <div className="flex items-center gap-3" key={creative}><span className="w-28 truncate text-sm text-zinc-600 dark:text-zinc-300">{creative}</span><div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800"><div className="h-full rounded-full bg-[#c8102e]" style={{ width: `${(count / Math.max(filteredRows.length, 1)) * 100}%` }} /></div><span className="w-8 text-right text-sm font-semibold">{count}</span></div>)}</div><div className="mt-6 grid grid-cols-3 gap-3">{["Hero", "Proof", "Winning Msg"].map((label) => <div className="rounded-lg bg-zinc-50 p-3 text-center dark:bg-zinc-800" key={label}><p className="text-xl font-semibold">{filteredRows.filter((row) => row.creative.toLowerCase().includes(label.toLowerCase().split(" ")[0])).length}</p><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">{label}</p></div>)}</div></div><div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><h2 className="font-semibold">Performance signal</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Signal distribution from analyzed content</p><div className="mx-auto mt-5 max-w-[210px]"><Doughnut data={{ labels: ["Strong", "Test", "Stop"], datasets: [{ data: statusCounts, backgroundColor: ["#16a34a", "#f97316", "#c8102e"], borderWidth: 0 }] }} options={{ plugins: { legend: { position: "bottom", labels: { boxWidth: 10, usePointStyle: true } } } }} /></div></div></section>
        <section className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]"><div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><div className="mb-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">Winning message</p><h2 className="mt-2 font-semibold">What the audience should remember</h2></div>{filteredRows.length ? <blockquote className="border-l-4 border-[#c8102e] pl-4 text-xl font-medium leading-8">“{filteredRows[0].message}”</blockquote> : <p className="text-sm text-zinc-500">No message for this filter.</p>}<div className="mt-6 rounded-lg bg-zinc-50 p-4 dark:bg-zinc-800"><p className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">Audience / content notes</p><p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">{filteredRows[0]?.hook || "No hook available"}</p></div></div><div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><h2 className="font-semibold">Marketing action</h2><div className="mt-4 space-y-3">{actions.length ? actions.map((action) => <p className="flex gap-2 text-sm leading-6" key={action}><span className="text-emerald-600">✓</span>{action}</p>) : <p className="text-sm text-zinc-500">No action for this filter.</p>}</div></div></section>
        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><div className="flex flex-col justify-between gap-3 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center dark:border-zinc-700"><div><h2 className="font-semibold">Creative strategy detail</h2><p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">Creator, ads angle, role, signal and recommended action</p></div><label className="flex items-center gap-2 text-xs text-zinc-500">Rows per page<select aria-label="Rows per page" className="rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800" value={strategyPageSize} onChange={(event) => { setStrategyPageSize(Number(event.target.value)); setStrategyPage(1); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option></select></label></div><div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400"><tr><th className="px-5 py-3">Creator</th><th className="px-5 py-3">Ads Angle</th><th className="px-5 py-3">Ads Role</th><th className="px-5 py-3">Performance Signal</th><th className="px-5 py-3">Action</th></tr></thead><tbody>{visibleStrategyRows.map((row, index) => <tr className="border-t border-zinc-200 dark:border-zinc-700" key={`${row.creator}-${(strategyPage - 1) * strategyPageSize + index}`}><td className="px-5 py-4 font-medium">{row.creator}</td><td className="px-5 py-4">{row.angle}<p className="mt-1 text-xs text-zinc-500">{row.hook}</p></td><td className="px-5 py-4">{row.role}</td><td className="px-5 py-4">{row.signal}</td><td className="px-5 py-4 text-[#c8102e]">{row.action}</td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-zinc-200 px-5 py-3 text-sm dark:border-zinc-700"><span className="text-xs text-zinc-500">Page {strategyPage} of {strategyPageCount} · {filteredRows.length} rows</span><div className="flex gap-2"><button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600" disabled={strategyPage === 1} onClick={() => setStrategyPage((page) => page - 1)}>Previous</button><button className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-600" disabled={strategyPage >= strategyPageCount} onClick={() => setStrategyPage((page) => page + 1)}>Next</button></div></div></section>
        {projectsError && <p className="mt-4 text-sm text-red-600" role="alert">{projectsError}</p>}
      </main>
    </div>
  );
}
