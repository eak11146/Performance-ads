"use client";

import { ChangeEvent, DragEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import TopMenu from "@/components/top-menu";
import { Upload, FileSpreadsheet, X, Video } from "lucide-react";

type ReportRow = Record<string, string> & { _id?: string };

const VIDEO_HEADERS = [
  "products",
  "brands",
  "Creator",
  "จุดเด่น",
  "Ads Angle",
  "Hook / Selling Point",
  "Ads Role",
  "Performance Signal",
  "Winning Message",
  "Action",
];

function getColumns(rows: ReportRow[]) {
  if (!rows.length) return VIDEO_HEADERS;
  const existing = Array.from(new Set(rows.flatMap((r) => Object.keys(r).filter(k => k!== "_id" && k!== "createdAt" && k!== "updatedAt" &&!/^__empty/i.test(k)))));
  // ให้เรียงตาม VIDEO_HEADERS ก่อน ที่เหลือตามท้าย
  const ordered = [...VIDEO_HEADERS.filter(h => existing.includes(h)),...existing.filter(h =>!VIDEO_HEADERS.includes(h))];
  return ordered.length? ordered : VIDEO_HEADERS;
}

function getColumnStyle(column: string): React.CSSProperties {
  const c = column.toLowerCase();
  if (c.includes("products")) return { minWidth: 140, width: 140 };
  if (c.includes("brands")) return { minWidth: 120, width: 120 };
  if (c.includes("creator")) return { minWidth: 120, width: 120 };
  if (c.includes("จุดเด่น")) return { minWidth: 200, width: 220 };
  if (c.includes("angle")) return { minWidth: 160, width: 180 };
  if (c.includes("hook") || c.includes("selling")) return { minWidth: 220, width: 250 };
  if (c.includes("role")) return { minWidth: 120, width: 130 };
  if (c.includes("performance") || c.includes("signal")) return { minWidth: 150, width: 160 };
  if (c.includes("winning") || c.includes("message")) return { minWidth: 200, width: 220 };
  if (c.includes("action")) return { minWidth: 150, width: 160 };
  return { minWidth: 150, width: 160 };
}

function parseVideoSheet(sheet: XLSX.WorkSheet, skipFirstRow = true, forceNoHeader = false): ReportRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const cleanMatrix = matrix.filter((row) => row.some((c) => String(c).trim()!== ""));
  if (!cleanMatrix.length) throw new Error("ไฟล์ว่าง");

  let headerIndex = -1;
  let headers: string[] = [];

  if (!forceNoHeader) {
    const candidateIndexes = skipFirstRow? [1, 0, 2] : [0, 1];
    for (const idx of candidateIndexes) {
      const row = cleanMatrix[idx];
      if (!row) continue;
      const rowStr = row.map((c) => String(c).toLowerCase());
      const hasVideoHeader = rowStr.some((c) => /products|brands|creator|จุดเด่น|ads angle|hook|selling|ads role|performance|winning|action/.test(c));
      if (hasVideoHeader) {
        headerIndex = idx;
        headers = row.map((c) => String(c).trim()).filter(Boolean);
        break;
      }
    }
  }

  let dataStartIndex = 0;
  if (headerIndex === -1) {
    headers = VIDEO_HEADERS;
    dataStartIndex = skipFirstRow? 1 : 0;
    // ถ้าแถวแรกเป็น title ยาวๆ ข้ามไป
    if (cleanMatrix[0] && cleanMatrix[0].length === 1) dataStartIndex = 1;
  } else {
    dataStartIndex = headerIndex + 1;
  }

  const rows: ReportRow[] = [];
  for (let i = dataStartIndex; i < cleanMatrix.length; i++) {
    const row = cleanMatrix[i];
    const obj: ReportRow = {};
    headers.forEach((h, colIdx) => {
      const val = String(row[colIdx]?? "").trim();
      if (val) obj[h] = val;
    });
    if (Object.keys(obj).length > 0 && (obj["products"] || obj["brands"] || obj["Creator"] || obj["จุดเด่น"] || Object.values(obj).some(v => v))) {
      rows.push(obj);
    }
  }
  if (!rows.length) throw new Error("ไม่พบข้อมูลวิดีโอ");
  return rows;
}

export default function VideoAnalysisPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("ลากไฟล์วิเคราะห์วิดีโอมาวางได้เลย");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<ReportRow>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [skipFirstRow, setSkipFirstRow] = useState(true);
  const [noHeaderMode, setNoHeaderMode] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth").then(async (authResponse) => {
        if (!authResponse.ok) { router.replace("/login"); return; }
        setIsAuthorized(true);
        const response = await fetch("/api/ad-reports");
        const data = await response.json();
        if (response.ok) setReports(data);
      }).catch(() => setMessage("โหลดข้อมูลไม่ได้"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function processFile(file: File) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = parseVideoSheet(sheet, skipFirstRow, noHeaderMode);
      setRows(parsed);
      setFileName(file.name);
      setMessage(`โหลดสำเร็จ ${parsed.length} วิดีโอ - ${noHeaderMode? "โหมด Auto Header วิดีโอ" : "Auto Detect"}`);
    } catch (err: unknown) {
      setRows([]);
      setMessage(`Error: ${err instanceof Error? err.message : "อ่านไฟล์ไม่ได้"}`);
    }
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    await processFile(file);
  }
  function handleDragOver(e: DragEvent<HTMLDivElement>) { e.preventDefault(); e.stopPropagation(); setDragActive(true); }
  function handleDragLeave(e: DragEvent<HTMLDivElement>) { e.preventDefault(); e.stopPropagation(); setDragActive(false); }
  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  }

  async function importRows() {
    if (!rows.length) return;
    const response = await fetch("/api/ad-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "นำเข้าไม่สำเร็จ"); return; }
    const refreshed = await fetch("/api/ad-reports").then((r) => r.json());
    setReports(refreshed);
    setRows([]);
    setMessage(`นำเข้า ${data.imported || rows.length} วิดีโอ สำเร็จ`);
  }

  function startEditing(report: ReportRow) { setEditingId(report._id || null); setEditingRow({...report }); }
  async function saveEdit() {
    if (!editingId) return;
    const response = await fetch("/api/ad-reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({...editingRow, id: editingId }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "แก้ไขไม่สำเร็จ"); return; }
    setReports((cur) => cur.map((r) => (r._id === editingId? data : r)));
    setEditingId(null);
  }
  async function deleteSelected(ids: string[], msg: string) {
    if (!ids.length ||!window.confirm(msg)) return;
    const response = await fetch("/api/ad-reports", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "ลบไม่สำเร็จ"); return; }
    setReports((cur) => cur.filter((r) =>!ids.includes(r._id || "")));
    setSelectedIds((cur) => cur.filter((id) =>!ids.includes(id)));
  }

  const columns = getColumns([...reports,...rows]);
  const savedIds = reports.map((r) => r._id).filter((id): id is string => Boolean(id));

  function toggleSelected(id: string) { setSelectedIds((cur) => cur.includes(id)? cur.filter((s) => s!== id) : [...cur, id]); }

  if (!isAuthorized) return <main className="flex min-h-screen items-center justify-center text-sm">Checking access...</main>;

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-zinc-900">
      <TopMenu />
      <main className="px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-200 pb-8 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#c8102e]"><Video size={14} /> Video Content Analysis</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">Video Analysis Import</h1>
              <p className="mt-2 text-sm text-zinc-500">อัปโหลดไฟล์วิเคราะห์เนื้อหาวิดีโอ - products, brands, Creator, จุดเด่น, Ads Angle...</p>
            </div>
            <Link href="/dashboard" className="text-sm underline underline-offset-4">Back to dashboard</Link>
          </div>

          <section
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`rounded-2xl border-2 border-dashed p-8 text-center shadow-sm transition-all ${dragActive? "border-[#c8102e] bg-red-50" : "border-zinc-300 bg-white"}`}
          >
            <div className="flex flex-col items-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100"><Upload className="h-7 w-7" /></div>
              <p className="mt-4 text-lg font-semibold">{dragActive? "วางไฟล์ตรงนี้เลย" : "ลากไฟล์วิเคราะห์วิดีโอมาวาง"}</p>
              <p className="mt-1 text-sm text-zinc-500">รองรับ.xlsx,.xls,.csv - หัวคอลัมน์: products, brands, Creator, จุดเด่น...</p>
              <label className="mt-5 inline-flex cursor-pointer rounded-full bg-zinc-950 px-6 py-3 text-sm font-semibold text-white hover:bg-[#c8102e]">
                Choose File
                <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
              </label>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="checkbox" checked={skipFirstRow} onChange={(e) => setSkipFirstRow(e.target.checked)} /> ข้ามแถวที่ 1 (ถ้ามี title)</label>
                <label className="flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-amber-800"><input type="checkbox" checked={noHeaderMode} onChange={(e) => setNoHeaderMode(e.target.checked)} /> ไฟล์ไม่มีหัวตาราง</label>
              </div>

              {fileName && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-zinc-100 px-4 py-2 text-sm">
                  <FileSpreadsheet size={16} /> {fileName}
                  <button onClick={() => { setFileName(""); setRows([]); }} className="ml-1 rounded-full p-1 hover:bg-zinc-200"><X size={14} /></button>
                </div>
              )}
              <p className="mt-3 text-sm text-zinc-500">{message}</p>
              <p className="mt-2 text-xs text-zinc-400">ลำดับ Auto: {VIDEO_HEADERS.join(" | ")}</p>
            </div>
          </section>

          {rows.length > 0 && (
            <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b bg-amber-50 px-5 py-4">
                <h2 className="font-semibold">Preview {rows.length} วิดีโอ - {noHeaderMode? "โหมดไม่มีหัว" : "Auto Detect"}</h2>
                <button onClick={importRows} className="rounded-full bg-[#c8102e] px-5 py-2 text-sm font-semibold text-white">Import to Database</button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-zinc-50 text-xs uppercase text-zinc-500"><tr>{getColumns(rows).map((col) => <th style={getColumnStyle(col)} className="px-3 py-3 font-semibold" key={col}>{col}</th>)}</tr></thead>
                  <tbody>
                    {rows.map((row, i) => (
                      <tr key={i} className="border-t odd:bg-white even:bg-zinc-50/50"><td colSpan={columns.length} className="hidden" />
                        {getColumns(rows).map((col) => <td style={getColumnStyle(col)} className="px-3 py-3 align-top" key={col}><span className="block truncate" title={row[col]}>{row[col] || "-"}</span></td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b bg-zinc-50 px-5 py-4">
              <h3 className="font-semibold">Saved Video Analysis ({reports.length})</h3>
              <div className="flex gap-2">
                {selectedIds.length > 0 && <button onClick={() => deleteSelected(selectedIds, `ลบ ${selectedIds.length} ที่เลือก?`)} className="rounded-full bg-red-600 px-4 py-2 text-xs text-white">ลบที่เลือก ({selectedIds.length})</button>}
                <button onClick={() => deleteSelected(savedIds, "ลบทั้งหมด?")} disabled={!savedIds.length} className="rounded-full border border-red-200 px-4 py-2 text-xs text-red-600 disabled:opacity-40">ลบทั้งหมด</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-white text-xs uppercase text-zinc-500"><tr><th style={{ width: 48 }} className="px-3 py-3"><input type="checkbox" checked={reports.length > 0 && reports.every(r => r._id && selectedIds.includes(r._id))} onChange={() => { const ids = reports.map(r => r._id).filter(Boolean) as string[]; setSelectedIds((cur) => ids.every(id => cur.includes(id))? cur.filter(id =>!ids.includes(id)) : Array.from(new Set([...cur,...ids]))); }} /></th>{columns.map((col) => <th style={getColumnStyle(col)} className="px-3 py-3 font-semibold" key={col}>{col}</th>)}<th style={{ width: 120 }} className="px-3 py-3">จัดการ</th></tr></thead>
                <tbody>
                  {reports.map((report, idx) => (
                    <tr key={report._id || idx} className="border-t odd:bg-white even:bg-zinc-50/50">
                      <td className="px-3 py-3"><input type="checkbox" checked={Boolean(report._id && selectedIds.includes(report._id))} onChange={() => report._id && toggleSelected(report._id)} /></td>
                      {columns.map((col) => (
                        <td style={getColumnStyle(col)} className="px-3 py-3 align-top" key={col}>
                          {editingId === report._id? <textarea className="w-full rounded border border-red-300 px-2 py-1 text-sm" value={editingRow[col] || ""} onChange={(e) => setEditingRow({...editingRow, [col]: e.target.value })} /> : <span className="block truncate" title={report[col]}>{report[col] || "-"}</span>}
                        </td>
                      ))}
                      <td className="px-3 py-3"><div className="flex gap-1">{editingId === report._id? <><button className="rounded bg-emerald-600 px-2 py-1 text-xs text-white" onClick={saveEdit}>บันทึก</button><button className="rounded border px-2 py-1 text-xs" onClick={() => setEditingId(null)}>ยกเลิก</button></> : <><button className="rounded border px-2 py-1 text-xs" onClick={() => startEditing(report)}>แก้ไข</button><button className="rounded border border-red-200 px-2 py-1 text-xs text-red-600" onClick={() => report._id && deleteSelected([report._id], "ลบ?")}>ลบ</button></>}</div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}