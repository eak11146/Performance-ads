"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import TopMenu from "@/components/top-menu";

type ReportRow = Record<string, string> & { _id?: string };

function getColumns(rows: ReportRow[]) {
  return Array.from(
    new Set(
      rows.flatMap((row) =>
        Object.keys(row).filter(
          (key) =>
            key!== "_id" &&
            key!== "createdAt" &&
            key!== "updatedAt" &&
           !/^__empty/i.test(key) &&
            rows.some((item) => item[key]?.toString().trim()),
        ),
      ),
    ),
  );
}

// แก้แล้ว - ใส่ตัวเลขครบ ไม่หาย
function getColumnStyle(column: string) {
  const c = column.toLowerCase();
  if (c.includes("date") || c.includes("วันที่")) return "min-w- w- max-w-";
  if (c.includes("website") || c.includes("site")) return "min-w- w- max-w-";
  if (c.includes("month")) return "min-w- w-";
  if (c.includes("click") || c.includes("display") || c.includes("sales") || c.includes("ctr") || c.includes("rank")) return "min-w- w- text-right";
  if (c.includes("keyword")) return "min-w- w- max-w-";
  if (c.includes("article")) return "min-w- w- text-center";
  return "min-w- w- max-w-";
}

function isDateColumn(column: string) {
  const normalized = column.toLowerCase().replace(/[\s_\-./]/g, "");
  return normalized === "date" || normalized === "วันที่";
}

function toDateInputValue(value: string) {
  const isoMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  const parts = value.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (parts) {
    const yearNumber = Number(parts[3]);
    const year = yearNumber < 100? (yearNumber >= 50? yearNumber + 1957 : yearNumber + 2000) : yearNumber >= 2400? yearNumber - 543 : yearNumber;
    return `${year.toString().padStart(4, "0")}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
  }
  return "";
}

function formatCellValue(value: string, column: string) {
  if (!isDateColumn(column)) return value;
  const dateValue = toDateInputValue(value);
  if (!dateValue) return value;
  const [year, month, day] = dateValue.split("-");
  return `${day}/${month}/${year}`;
}

function parseSeoSheet(sheet: XLSX.WorkSheet, skipFirstRow = true): ReportRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (!matrix || matrix.length < 2) throw new Error("ไฟล์ไม่มีข้อมูลพอ (ต้องมีอย่างน้อย 2 แถว)");
  let headerIndex = 0;
  if (skipFirstRow) {
    headerIndex = 1; // เอาแถวที่ 2 เป็นหัว
  } else {
    headerIndex = matrix.findIndex((row) => row.filter((cell) => String(cell).trim()!== "").length > 0);
  }
  if (headerIndex < 0) throw new Error("ไม่พบข้อมูล Header");
  const headers = matrix[headerIndex].map((cell) => String(cell).trim());
  return matrix.slice(headerIndex + 1).map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index]?? "").trim()]).filter(([h, v]) => h!== "" && v!== ""))).filter((row) => Object.keys(row).length > 0);
}

export default function SeoReportPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Upload ไฟล์ Excel หรือ CSV เพื่อเริ่มวิเคราะห์รายงาน SEO");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<ReportRow>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [reportPageSize, setReportPageSize] = useState(10);
  const [reportPages, setReportPages] = useState<Record<string, number>>({});
  const [skipFirstRow, setSkipFirstRow] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth").then(async (authResponse) => {
        if (!authResponse.ok) { router.replace("/login"); return; }
        setIsAuthorized(true);
        const response = await fetch("/api/ad-reports");
        const data = await response.json();
        if (response.ok) setReports(data);
      }).catch(() => setMessage("ไม่สามารถโหลดรายงานได้"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = parseSeoSheet(sheet, skipFirstRow); // ใช้ค่าจาก checkbox
      setRows(parsed);
      setFileName(file.name);
      setMessage(`โหลดข้อมูลสำเร็จ ${parsed.length} แถว (ข้ามแถวแรก: ${skipFirstRow? "ใช่" : "ไม่"})`);
    } catch (err: unknown) {
      setRows([]);
      const errMsg = err instanceof Error? err.message : "ไม่สามารถอ่านไฟล์ได้";
      setMessage(`ข้อผิดพลาด: ${errMsg}`);
    }
  }

  async function importRows() {
    if (rows.length === 0) return;
    const response = await fetch("/api/ad-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "นำเข้าไม่สำเร็จ"); return; }
    const refreshed = await fetch("/api/ad-reports").then((r) => r.json());
    setReports(refreshed);
    setReportPages({});
    setRows([]);
    setMessage(`นำเข้าข้อมูล ${data.imported || rows.length} แถว สำเร็จ`);
  }

  function startEditing(report: ReportRow) { setEditingId(report._id || null); setEditingRow({...report }); }
  async function saveEdit() {
    if (!editingId) return;
    const response = await fetch("/api/ad-reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...editingRow, id: editingId }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "แก้ไขไม่สำเร็จ"); return; }
    setReports((cur) => cur.map((r) => (r._id === editingId? data : r)));
    setEditingId(null);
    setMessage("แก้ไขสำเร็จ");
  }
  async function deleteSelected(ids: string[], confirmMessage: string) {
    const validIds = ids.filter(Boolean);
    if (!validIds.length ||!window.confirm(confirmMessage)) return;
    const response = await fetch("/api/ad-reports", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: validIds }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "ลบไม่สำเร็จ"); return; }
    setReports((cur) => cur.filter((r) =>!validIds.includes(r._id || "")));
    setSelectedIds((cur) => cur.filter((id) =>!validIds.includes(id)));
    setReportPages({});
    setMessage(`ลบ ${data.deleted} แถวสำเร็จ`);
  }

  const columns = getColumns([...reports,...rows]);
  const savedIds = reports.map((r) => r._id).filter((id): id is string => Boolean(id));
  const groupedReports: Record<string, ReportRow[]> = { "รายงานคะแนน SEO": reports };

  function toggleSelected(id: string) { setSelectedIds((cur) => cur.includes(id)? cur.filter((s) => s!== id) : [...cur, id]); }
  function getGroupPage(group: string) { return reportPages[group] || 1; }
  function getVisibleGroupReports(group: string, groupReports: ReportRow[]) {
    const page = getGroupPage(group);
    return groupReports.slice((page - 1) * reportPageSize, page * reportPageSize);
  }

  function renderValue(report: ReportRow, column: string) {
    const raw = report[column] || "";
    if (editingId!== report._id) {
      const display = formatCellValue(raw, column) || "-";
      return <span title={display} className="block truncate whitespace-nowrap">{display}</span>;
    }
    if (isDateColumn(column)) {
      return <input className="w-full rounded-lg border border-orange-300 px-2 py-1 text-sm" type="date" value={toDateInputValue(editingRow[column] || "")} onChange={(e) => setEditingRow({...editingRow, [column]: e.target.value })} />;
    }
    return <textarea className="min-h-16 w-full rounded-lg border border-orange-300 px-2 py-1 text-sm" value={editingRow[column] || ""} onChange={(e) => setEditingRow({...editingRow, [column]: e.target.value })} />;
  }

  if (!isAuthorized) return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-slate-500">Checking access...</main>;

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <TopMenu />
      <main className="px-4 py-8 sm:px-5 sm:py-12 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-300 pb-8 sm:mb-10 sm:flex-row sm:items-end dark:border-zinc-700">
            <div>
              <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">SEO Performance & Keywords</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">SEO Report Import</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">อัปโหลดไฟล์คะแนน SEO (.xlsx,.csv) ระบบสร้างคอลัมน์อัตโนมัติ</p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-600 underline underline-offset-4 dark:text-zinc-400">Back to dashboard</Link>
          </div>

          <section className="rounded-2xl border border-dashed border-zinc-400 bg-white p-6 text-center shadow-sm dark:border-zinc-600 dark:bg-zinc-900 sm:p-8">
            <p className="text-lg font-semibold">Upload SEO Score File (.xlsx,.csv)</p>
            <p className="mt-2 text-sm text-zinc-500">รองรับไฟล์คะแนน SEO ทุกรูปแบบ</p>
            <label className="mt-6 inline-flex cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-orange-700">
              Choose File
              <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
            </label>

            <label className="mt-4 flex items-center justify-center gap-2 text-sm">
              <input type="checkbox" checked={skipFirstRow} onChange={(e) => setSkipFirstRow(e.target.checked)} />
              ข้ามแถวที่ 1 (เอาแถวที่ 2 เป็นหัวตาราง)
            </label>

            {fileName && <p className="mt-4 text-sm font-medium text-zinc-600">ไฟล์ที่เลือก: {fileName}</p>}
            <p className="mt-4 text-sm text-zinc-500" role="status">{message}</p>
          </section>

          {rows.length > 0 && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
                <h2 className="font-semibold">Preview Data ({rows.length} รายการ)</h2>
                <button onClick={importRows} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">Import to Database</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-800">
                    <tr>{getColumns(rows).map((column) => <th className={`px-4 py-3 font-semibold ${getColumnStyle(column)}`} key={column}>{column}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row, index) => (
                      <tr className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50/50 hover:bg-orange-50/50 dark:border-zinc-700 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30" key={index}>
                        {getColumns(rows).map((column) => (
                          <td className={`px-4 py-3 align-top text-zinc-700 dark:text-zinc-300 ${getColumnStyle(column)}`} key={column}>
                            <span className="block truncate" title={row[column]}>{formatCellValue(row[column], column)}</span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-8 space-y-6 sm:mt-10">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Database Records</p><h2 className="mt-2 text-2xl font-semibold">ข้อมูลคะแนน SEO ทั้งหมด</h2></div>
              <div className="flex flex-wrap items-center gap-3">
                {selectedIds.length > 0 && <button onClick={() => deleteSelected(selectedIds, `ต้องการลบ ${selectedIds.length} แถวที่เลือกหรือไม่?`)} className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700">ลบที่เลือก ({selectedIds.length})</button>}
                <button onClick={() => deleteSelected(savedIds, "ต้องการลบข้อมูลทั้งหมดหรือไม่?")} disabled={!savedIds.length} className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-40">ลบทั้งหมด</button>
                <label className="text-sm font-medium text-zinc-600">Rows/page<select className="ml-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800" value={reportPageSize} onChange={(e) => { setReportPageSize(Number(e.target.value)); setReportPages({}); }}><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option></select></label>
              </div>
            </div>

            {Object.entries(groupedReports).map(([group, groupReports]) => (
              <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900" key={group}>
                <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800 sm:px-6">
                  <h3 className="font-semibold">{group}</h3><span className="text-sm text-zinc-500">{groupReports.length} รายการ</span>
                </div>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full table-fixed text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-white text-xs uppercase tracking-wider text-zinc-500 shadow-sm dark:bg-zinc-900">
                      <tr>
                        <th className="w- px-3 py-3"><input type="checkbox" checked={groupReports.length > 0 && groupReports.every((r) => r._id && selectedIds.includes(r._id))} onChange={() => { const groupIds = groupReports.map((r) => r._id).filter((id): id is string => Boolean(id)); setSelectedIds((cur) => groupIds.every((id) => cur.includes(id))? cur.filter((id) =>!groupIds.includes(id)) : Array.from(new Set([...cur,...groupIds]))); }} /></th>
                        {columns.map((column) => <th className={`px-3 py-3 font-semibold ${getColumnStyle(column)}`} key={column} title={column}><span className="block truncate">{column}</span></th>)}
                        <th className="w- px-3 py-3">จัดการ</th>
                      </tr>
                    </thead>
                    <tbody>
                      {getVisibleGroupReports(group, groupReports).map((report, index) => (
                        <tr className="border-t border-zinc-200 odd:bg-white even:bg-zinc-50/50 hover:bg-orange-50/60 dark:border-zinc-700 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/40" key={`${group}-${report._id || index}`}>
                          <td className="px-3 py-3 align-top"><input type="checkbox" checked={Boolean(report._id && selectedIds.includes(report._id))} onChange={() => report._id && toggleSelected(report._id)} /></td>
                          {columns.map((column) => (
                            <td className={`px-3 py-3 align-top text-zinc-700 dark:text-zinc-300 ${getColumnStyle(column)}`} key={column}>{renderValue(report, column)}</td>
                          ))}
                          <td className="whitespace-nowrap px-3 py-3 align-top">
                            <div className="flex gap-1.5">
                              {editingId === report._id? (<><button className="rounded-md bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white" onClick={saveEdit}>บันทึก</button><button className="rounded-md border px-2.5 py-1.5 text-xs" onClick={() => setEditingId(null)}>ยกเลิก</button></>) : (<><button className="rounded-md border px-2.5 py-1.5 text-xs hover:bg-zinc-50" onClick={() => startEditing(report)}>แก้ไข</button><button className="rounded-md border border-red-200 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50" onClick={() => report._id && deleteSelected([report._id], "ต้องการลบรายงานแถวนี้หรือไม่?")}>ลบ</button></>)}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </section>
        </div>
      </main>
    </div>
  );
}