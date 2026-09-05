"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { BarChart3, CheckCircle2, CircleDollarSign, Eye, MousePointerClick } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import TopMenu from "@/components/top-menu";
import type { DemoUser } from "@/data/users";

type CampaignRow = Record<string, string | number> & { _id?: string };

const campaignHeaders = [
  "แคมเปญ", "งบประมาณ", "สถานะ", "การแสดงผล", "การดู TrueView", "TrueView: CPV เฉลี่ย", "CPM เฉลี่ย",
  "วิดีโอแสดงแล้วถึง 25%", "วิดีโอแสดงแล้วถึง 50%", "วิดีโอแสดงแล้วถึง 75%", "วิดีโอแสดงแล้วถึง 100%",
  "TrueView: อัตราการดู (ในสตรีม)", "TrueView: อัตราการดู (ในฟีด)", "TrueView: อัตราการดู (Shorts)",
  "การโต้ตอบ", "อัตราการโต้ตอบ", "คลิก", "CTR", "ค่าใช้จ่าย",
];

const numericHeaders = new Set(campaignHeaders.filter((header) => header !== "แคมเปญ" && header !== "สถานะ"));

function parseNumber(value: string | number | undefined) {
  const number = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(number) ? 0 : number;
}

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[\s_\-./:()]/g, "");
}

function parseCampaignSheet(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headerIndex = matrix.findIndex((row) => {
    const headers = row.map((cell) => normalizedHeader(String(cell).trim()));
    return headers.includes(normalizedHeader("แคมเปญ")) && headers.includes(normalizedHeader("งบประมาณ"));
  });
  if (headerIndex < 0) throw new Error("ไม่พบ header แคมเปญ และ งบประมาณ");
  const headers = matrix[headerIndex].map((cell) => String(cell).trim());
  return matrix.slice(headerIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]).filter(([header, value]) => header && value)))
    .filter((row) => Object.keys(row).length > 0)
    .filter((row) => !/^(แคมเปญ|campaign)$/i.test(String(row["แคมเปญ"] || "")));
}

function displayValue(value: string | number | undefined, header: string) {
  if (value === undefined || value === "") return "-";
  if (!numericHeaders.has(header)) return String(value);
  return typeof value === "number" ? value.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : value;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [previewRows, setPreviewRows] = useState<CampaignRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Upload Google Ads campaign Excel เพื่อเริ่มต้น");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth")
        .then(async (authResponse) => {
          if (!authResponse.ok) {
            router.replace("/login");
            return;
          }
          const authData = await authResponse.json() as { user?: DemoUser };
          if (!authData.user) {
            router.replace("/login");
            return;
          }
          setUser(authData.user);
          setAuthorized(true);
          const response = await fetch("/api/campaigns");
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to load campaigns");
          setRows(data);
        })
        .catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const parsed = parseCampaignSheet(workbook.Sheets[workbook.SheetNames[0]]);
      setPreviewRows(parsed);
      setFileName(file.name);
      setMessage(`${parsed.length} rows ready. ตรวจสอบข้อมูลก่อน import`);
    } catch (error) {
      setPreviewRows([]);
      setMessage(error instanceof Error ? error.message : "ไม่สามารถอ่านไฟล์ได้");
    }
  }

  async function importRows() {
    const response = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: previewRows }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "นำเข้า campaign ไม่สำเร็จ"); return; }
    const refreshed = await fetch("/api/campaigns").then((result) => result.json());
    setRows(refreshed);
    setPreviewRows([]);
    setMessage(`นำเข้า ${data.imported} campaign สำเร็จ`);
  }

  const summary = useMemo(() => ({
    campaigns: rows.length,
    impressions: rows.reduce((total, row) => total + parseNumber(row["การแสดงผล"]), 0),
    views: rows.reduce((total, row) => total + parseNumber(row["การดู TrueView"]), 0),
    clicks: rows.reduce((total, row) => total + parseNumber(row["คลิก"]), 0),
    spend: rows.reduce((total, row) => total + parseNumber(row["ค่าใช้จ่าย"]), 0),
  }), [rows]);
  const metricCards: [string, string | number, LucideIcon][] = [["Campaigns", summary.campaigns, BarChart3], ["Impressions", summary.impressions, Eye], ["TrueView views", summary.views, Eye], ["Clicks", summary.clicks, MousePointerClick], ["Spend", `฿${summary.spend.toLocaleString()}`, CircleDollarSign]];

  if (!authorized || !user) return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-slate-500">Checking access...</main>;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <TopMenu user={user} />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-4 border-b border-zinc-300 pb-8 dark:border-zinc-700"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c8102e]">Google Ads / Campaigns</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Campaign data</h1><p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">อัปโหลดและวิเคราะห์ข้อมูลแคมเปญจาก Google Ads</p></div><Link href="/dashboard" className="text-sm text-zinc-500 underline underline-offset-4">Back to overview</Link></div>
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{metricCards.map(([label, value, Icon]) => <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900" key={label}><div className="flex items-center justify-between text-sm text-zinc-500"><span>{label}</span><Icon size={17} className="text-[#c8102e]" /></div><p className="mt-3 text-xl font-semibold">{value}</p></div>)}</section>
        <section className="rounded-xl border border-dashed border-zinc-400 bg-white p-7 text-center shadow-sm dark:border-zinc-600 dark:bg-zinc-900"><p className="font-semibold">Upload campaign spreadsheet</p><p className="mt-2 text-sm text-zinc-500">ระบบจะค้นหา header แคมเปญ และ งบประมาณ แล้วตัดแถวที่ไม่ใช่ข้อมูลออก</p><label className="mt-5 inline-flex cursor-pointer rounded-lg bg-[#c8102e] px-5 py-3 text-sm font-medium text-white hover:bg-[#a50d26]">Choose Excel file<input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} /></label>{fileName && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{fileName}</p>}<p className="mt-3 text-sm text-zinc-500" role="status">{message}</p></section>
        {previewRows.length > 0 && <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 dark:border-zinc-700"><h2 className="font-semibold">Preview ({previewRows.length} rows)</h2><button onClick={importRows} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white"><CheckCircle2 className="mr-2 inline" size={16} />Import campaigns</button></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800"><tr>{campaignHeaders.map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{previewRows.map((row, index) => <tr className="border-t border-zinc-200 dark:border-zinc-700" key={index}>{campaignHeaders.map((header) => <td className="max-w-48 px-4 py-3" key={header}>{displayValue(row[header], header)}</td>)}</tr>)}</tbody></table></div></section>}
        <section className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"><div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-700"><h2 className="font-semibold">Imported campaigns</h2><p className="mt-1 text-xs text-zinc-500">{rows.length} rows</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-800"><tr>{campaignHeaders.map((header) => <th className="px-4 py-3" key={header}>{header}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-zinc-200 dark:border-zinc-700" key={row._id || index}>{campaignHeaders.map((header) => <td className="max-w-48 px-4 py-3" key={header}>{displayValue(row[header], header)}</td>)}</tr>)}</tbody></table>{!rows.length && <p className="px-5 py-10 text-sm text-zinc-500">ยังไม่มีข้อมูล campaign</p>}</div></section>
      </main>
    </div>
  );
}
