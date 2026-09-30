"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { BarChart3, CheckCircle2, CircleDollarSign, Eye, MousePointerClick, Upload, Trash2 } from "lucide-react";
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

const numericHeaders = new Set(campaignHeaders.filter((h) => h!== "แคมเปญ" && h!== "สถานะ"));

function getColumnStyle(header: string) {
  const h = header.toLowerCase();
  if (h.includes("แคมเปญ")) return "min-w- w- max-w-";
  if (h.includes("งบประมาณ") || h.includes("ค่าใช้จ่าย")) return "min-w- w- text-right font-medium";
  if (h.includes("สถานะ")) return "min-w- w- text-center";
  if (h.includes("การแสดงผล") || h.includes("การดู") || h.includes("คลิก")) return "min-w- w- text-right";
  if (h.includes("cpv") || h.includes("cpm") || h.includes("ctr") || h.includes("อัตรา")) return "min-w- w- text-right";
  if (h.includes("วิดีโอ")) return "min-w- w- text-right";
  return "min-w- w- max-w-";
}

function parseNumber(value: string | number | undefined) {
  const number = Number(String(value?? "").replace(/[^\d.-]/g, ""));
  return Number.isNaN(number)? 0 : number;
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
   .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index]?? "").trim()]).filter(([header, value]) => header && value)))
   .filter((row) => Object.keys(row).length > 0)
   .filter((row) =>!/^(แคมเปญ|campaign)$/i.test(String(row["แคมเปญ"] || "")));
}
function displayValue(value: string | number | undefined, header: string) {
  if (value === undefined || value === "") return "-";
  if (!numericHeaders.has(header)) return String(value);
  return typeof value === "number"? value.toLocaleString("th-TH", { maximumFractionDigits: 2 }) : value;
}

export default function CampaignsPage() {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [rows, setRows] = useState<CampaignRow[]>([]);
  const [previewRows, setPreviewRows] = useState<CampaignRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Upload Google Ads campaign Excel เพื่อเริ่มต้น");
  const [campaignPage, setCampaignPage] = useState(1);
  const [campaignPageSize, setCampaignPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth").then(async (authResponse) => {
        if (!authResponse.ok) { router.replace("/login"); return; }
        const authData = await authResponse.json() as { user?: DemoUser };
        if (!authData.user) { router.replace("/login"); return; }
        setUser(authData.user);
        setAuthorized(true);
        const response = await fetch("/api/campaigns");
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Unable to load campaigns");
        setRows(data);
      }).catch((error: Error) => setMessage(error.message));
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
      setMessage(error instanceof Error? error.message : "ไม่สามารถอ่านไฟล์ได้");
    }
  }

  async function importRows() {
    const response = await fetch("/api/campaigns", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: previewRows }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "นำเข้า campaign ไม่สำเร็จ"); return; }
    const refreshed = await fetch("/api/campaigns").then((r) => r.json());
    setRows(refreshed);
    setCampaignPage(1);
    setPreviewRows([]);
    setMessage(`นำเข้า ${data.imported} campaign สำเร็จ`);
  }

  // --- ลบข้อมูล ---
  async function deleteSelected(ids: string[], confirmMessage: string) {
    const validIds = ids.filter(Boolean);
    if (!validIds.length ||!window.confirm(confirmMessage)) return;
    const response = await fetch("/api/campaigns", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: validIds }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "ลบไม่สำเร็จ");
      return;
    }
    setRows((cur) => cur.filter((r) =>!validIds.includes(r._id || "")));
    setSelectedIds((cur) => cur.filter((id) =>!validIds.includes(id)));
    setMessage(`ลบ ${data.deleted?? validIds.length} แถวสำเร็จ`);
    if (campaignPage > 1 && (rows.length - validIds.length) <= (campaignPage - 1) * campaignPageSize) {
      setCampaignPage((p) => Math.max(1, p - 1));
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((cur) => cur.includes(id)? cur.filter((s) => s!== id) : [...cur, id]);
  }

  const summary = useMemo(() => ({
    campaigns: rows.length,
    impressions: rows.reduce((t, r) => t + parseNumber(r["การแสดงผล"]), 0),
    views: rows.reduce((t, r) => t + parseNumber(r["การดู TrueView"]), 0),
    clicks: rows.reduce((t, r) => t + parseNumber(r["คลิก"]), 0),
    spend: rows.reduce((t, r) => t + parseNumber(r["ค่าใช้จ่าย"]), 0),
  }), [rows]);

  const metricCards: [string, string | number, LucideIcon, string][] = [
    ["Campaigns", summary.campaigns.toLocaleString(), BarChart3, "from-[#c8102e]/10 to-red-50"],
    ["Impressions", summary.impressions.toLocaleString(), Eye, "from-blue-500/10 to-blue-50"],
    ["TrueView views", summary.views.toLocaleString(), Eye, "from-violet-500/10 to-violet-50"],
    ["Clicks", summary.clicks.toLocaleString(), MousePointerClick, "from-emerald-500/10 to-emerald-50"],
    ["Spend", `฿${summary.spend.toLocaleString()}`, CircleDollarSign, "from-amber-500/10 to-amber-50"],
  ];

  const savedIds = rows.map((r) => r._id).filter((id): id is string => Boolean(id));
  const campaignPageCount = Math.max(1, Math.ceil(rows.length / campaignPageSize));
  const visibleCampaignRows = rows.slice((campaignPage - 1) * campaignPageSize, campaignPage * campaignPageSize);
  const allVisibleSelected = visibleCampaignRows.length > 0 && visibleCampaignRows.every((r) => r._id && selectedIds.includes(r._id));
  const allSelected = savedIds.length > 0 && savedIds.every((id) => selectedIds.includes(id));

  if (!authorized ||!user) return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-slate-500">Checking access...</main>;

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <TopMenu user={user} />
      <main className="mx-auto max-w-7xl px-5 py-10 lg:px-8">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-700 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#c8102e]">Google Ads / Campaigns</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight">Campaign data</h1>
            <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">อัปโหลดและวิเคราะห์ข้อมูลแคมเปญจาก Google Ads</p>
          </div>
          <Link href="/dashboard" className="text-sm text-zinc-500 underline underline-offset-4 hover:text-zinc-800">Back to overview</Link>
        </div>

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {metricCards.map(([label, value, Icon, grad]) => (
            <div key={label} className={`rounded-2xl border border-zinc-200 bg-gradient-to-br ${grad} bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900`}>
              <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-zinc-500">
                <span>{label}</span>
                <span className="rounded-full bg-white p-1.5 shadow-sm dark:bg-zinc-800"><Icon size={16} className="text-[#c8102e]" /></span>
              </div>
              <p className="mt-3 truncate text-xl font-bold tracking-tight" title={String(value)}>{value}</p>
            </div>
          ))}
        </section>

        <section className="rounded-2xl border border-dashed border-zinc-300 bg-white p-8 text-center shadow-sm dark:border-zinc-600 dark:bg-zinc-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30"><Upload className="text-[#c8102e]" size={20} /></div>
          <p className="mt-3 text-base font-semibold">Upload campaign spreadsheet</p>
          <p className="mt-1.5 text-sm text-zinc-500">ระบบจะค้นหา header แคมเปญ และ งบประมาณ แล้วตัดแถวที่ไม่ใช่ข้อมูลออก</p>
          <label className="mt-5 inline-flex cursor-pointer rounded-full bg-[#c8102e] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#a50d26]">
            Choose Excel file
            <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
          </label>
          {fileName && <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">ไฟล์: {fileName}</p>}
          <p className="mt-3 text-sm text-zinc-500" role="status">{message}</p>
        </section>

        {previewRows.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-amber-50/60 px-5 py-4 dark:border-zinc-700 dark:bg-amber-950/20">
              <h2 className="font-semibold">Preview ({previewRows.length} rows) - ยังไม่ได้บันทึก</h2>
              <button onClick={importRows} className="inline-flex items-center rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><CheckCircle2 className="mr-2" size={16} />Import campaigns</button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm">
                <thead className="sticky top-0 z-10 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-800">
                  <tr>{campaignHeaders.map((header) => <th className={`px-3 py-3 ${getColumnStyle(header)}`} key={header} title={header}><span className="block truncate">{header}</span></th>)}</tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50/60 hover:bg-amber-50/60 dark:border-zinc-700 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/40" key={index}>
                      {campaignHeaders.map((header) => (
                        <td className={`px-3 py-2.5 align-top text-zinc-700 dark:text-zinc-300 ${getColumnStyle(header)}`} key={header}>
                          <span className="block truncate" title={String(row[header]?? "")}>{displayValue(row[header], header)}</span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Imported + ปุ่มลบ */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-center">
            <div>
              <h2 className="font-semibold">Imported campaigns</h2>
              <p className="mt-1 text-xs text-zinc-500">{rows.length} rows • เลือก {selectedIds.length} • Page {campaignPage}/{campaignPageCount}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.length > 0 && (
                <button
                  onClick={() => deleteSelected(selectedIds, `ต้องการลบ ${selectedIds.length} แถวที่เลือกหรือไม่?`)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
                >
                  <Trash2 size={14} /> ลบที่เลือก ({selectedIds.length})
                </button>
              )}
              <button
                onClick={() => deleteSelected(savedIds, "ต้องการลบข้อมูลทั้งหมดหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")}
                disabled={!savedIds.length}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-900/50 dark:bg-zinc-900"
              >
                <Trash2 size={14} /> ลบทั้งหมด
              </button>
              <label className="ml-2 flex items-center gap-2 text-xs text-zinc-500">Rows
                <select aria-label="Campaign rows per page" className="rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800" value={campaignPageSize} onChange={(e) => { setCampaignPageSize(Number(e.target.value)); setCampaignPage(1); }}>
                  <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
                </select>
              </label>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <thead className="sticky top-0 z-10 bg-white text-xs font-semibold uppercase tracking-wide text-zinc-500 shadow-sm dark:bg-zinc-900">
                <tr>
                  <th className="w- px-3 py-3">
                    <input type="checkbox" checked={allVisibleSelected} onChange={() => {
                      const visibleIds = visibleCampaignRows.map((r) => r._id).filter((id): id is string => Boolean(id));
                      if (allVisibleSelected) {
                        setSelectedIds((cur) => cur.filter((id) =>!visibleIds.includes(id)));
                      } else {
                        setSelectedIds((cur) => Array.from(new Set([...cur,...visibleIds])));
                      }
                    }} title={allVisibleSelected? "ยกเลิกเลือกหน้านี้" : "เลือกทั้งหมดหน้านี้"} />
                  </th>
                  {campaignHeaders.map((header) => <th className={`px-3 py-3 ${getColumnStyle(header)}`} key={header} title={header}><span className="block truncate">{header}</span></th>)}
                  <th className="w- px-3 py-3 text-center">ลบ</th>
                </tr>
              </thead>
              <tbody>
                {visibleCampaignRows.map((row, index) => (
                  <tr className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50/50 hover:bg-zinc-50 dark:border-zinc-700 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/40 dark:hover:bg-zinc-800" key={row._id || index}>
                    <td className="px-3 py-2.5 text-center">
                      <input type="checkbox" checked={Boolean(row._id && selectedIds.includes(row._id))} onChange={() => row._id && toggleSelected(row._id)} />
                    </td>
                    {campaignHeaders.map((header) => (
                      <td className={`px-3 py-2.5 align-top text-zinc-700 dark:text-zinc-300 ${getColumnStyle(header)}`} key={header}>
                        <span className="block truncate" title={String(row[header]?? "")}>{displayValue(row[header], header)}</span>
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => row._id && deleteSelected([row._id], "ต้องการลบแคมเปญนี้หรือไม่?")} className="rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length && <div className="px-5 py-16 text-center"><p className="text-sm text-zinc-500">ยังไม่มีข้อมูล campaign</p><p className="mt-1 text-xs text-zinc-400">อัปโหลดไฟล์ Excel ด้านบนเพื่อเริ่มต้น</p></div>}
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-200 bg-zinc-50 px-5 py-3 text-sm dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={allSelected} onChange={() => {
                  if (allSelected) setSelectedIds([]); else setSelectedIds(savedIds);
                }} />
                เลือกทั้งหมด {savedIds.length} แถว
              </label>
              <span>Page {campaignPage} of {campaignPageCount} · {rows.length} rows</span>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900" disabled={campaignPage === 1} onClick={() => setCampaignPage((p) => p - 1)}>Previous</button>
              <button className="rounded-full border border-zinc-300 bg-white px-4 py-1.5 text-xs font-medium disabled:opacity-40 dark:border-zinc-600 dark:bg-zinc-900" disabled={campaignPage >= campaignPageCount} onClick={() => setCampaignPage((p) => p + 1)}>Next</button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}