"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { BarChart3, Trash2, Upload, MousePointerClick, Eye, CircleDollarSign, Edit3, Search } from "lucide-react";
import TopMenu from "@/components/top-menu";

type PerformanceRow = {
  _id?: string;
  month: string;
  website: string;
  clicks: number;
  display: number;
  ctr: number;
  ranking: number;
  sales: number;
  article: string;
  createdAt?: string;
};

type SheetRow = Record<string, string | number>;

const parseFormattedNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value)? value : 0;
  const str = String(value?? "").trim().toLowerCase().replace(/,/g, "");
  if (!str) return 0;
  if (str.endsWith("%")) {
    const num = parseFloat(str.replace("%", ""));
    return Number.isFinite(num)? num : 0;
  }
  if (str.endsWith("k")) {
    const num = parseFloat(str.replace("k", ""));
    return Number.isFinite(num)? num * 1000 : 0;
  }
  if (str.endsWith("m")) {
    const num = parseFloat(str.replace("m", ""));
    return Number.isFinite(num)? num * 1000000 : 0;
  }
  const parsed = parseFloat(str);
  return Number.isFinite(parsed)? parsed : 0;
};

function parseSheet(sheet: XLSX.WorkSheet): SheetRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (!matrix.length) throw new Error("ไฟล์ว่างเปล่า");
  const parsedRows: SheetRow[] = [];
  for (let i = 0; i < matrix.length; i++) {
    const line = matrix[i];
    if (!Array.isArray(line)) continue;
    const cleanCells = line.map((cell) => String(cell?? "").trim());
    if (cleanCells.every((cell) =>!cell)) continue;
    const monthVal = cleanCells[0] || "";
    const websiteVal = cleanCells[1] || "";
    if (!monthVal &&!websiteVal) continue;
    const clicksVal = parseFormattedNumber(cleanCells[2]);
    const displayVal = parseFormattedNumber(cleanCells[3]);
    let ctrVal = parseFormattedNumber(cleanCells[4]);
    if (ctrVal === 0 && displayVal > 0 && clicksVal > 0) ctrVal = parseFloat(((clicksVal / displayVal) * 100).toFixed(2));
    const rankingVal = parseFormattedNumber(cleanCells[5]);
    const salesVal = parseFormattedNumber(cleanCells[6]);
    const articleVal = cleanCells[7] || "-";
    parsedRows.push({ month: monthVal, website: websiteVal, clicks: clicksVal, display: displayVal, ctr: ctrVal, ranking: rankingVal, sales: salesVal, article: articleVal });
  }
  return parsedRows;
}

export default function PerformanceDataPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [saved, setSaved] = useState<PerformanceRow[]>([]);
  const [preview, setPreview] = useState<SheetRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("เลือกไฟล์ Excel/CSV เรียงคอลัมน์: Month | Website | CLICK | DISPLAY | AVR.CTR | Ranking | Sales | Article");
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<PerformanceRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const load = async () => {
    try {
      const response = await fetch("/api/performance", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) setSaved(Array.isArray(data)? data : []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/auth").then(async (response) => {
        if (!response.ok) return router.replace("/login");
        setAuthorized(true);
        await load();
      }).catch(() => router.replace("/login"));
    }, 0);
    return () => clearTimeout(timer);
  }, [router]);

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage(`กำลังอ่านไฟล์ ${file.name}...`);
    try {
      const buffer = await file.arrayBuffer();
      let book: XLSX.WorkBook;
      try { book = XLSX.read(buffer, { type: "array" }); }
      catch {
        const text = new TextDecoder("utf-8").decode(buffer);
        book = XLSX.read(text, { type: "string" });
      }
      const firstSheet = book.Sheets[book.SheetNames[0]];
      const rows = parseSheet(firstSheet);
      if (!rows.length) throw new Error("ไม่พบข้อมูล");
      setPreview(rows);
      setFileName(file.name);
      setMessage(`พร้อมนำเข้า ${rows.length} รายการจาก "${file.name}"`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error? error.message : String(error);
      setPreview([]);
      setMessage(`เกิดข้อผิดพลาด: ${errMsg}`);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function importRows() {
    if (!preview.length) return;
    setLoading(true);
    setMessage(`กำลังบันทึก ${preview.length} รายการ...`);
    try {
      const response = await fetch("/api/performance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: preview }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "นำเข้าไม่สำเร็จ"); return; }
      setPreview([]); setPage(1); setMessage(`นำเข้าสำเร็จ ${data.imported || preview.length} รายการ`); await load();
    } catch { setMessage("เชื่อมต่อไม่ได้"); } finally { setLoading(false); }
  }

  async function handleDeleteRow(id?: string) {
    if (!id) return;
    if (!confirm("ลบรายการนี้?")) return;
    try {
      const response = await fetch("/api/performance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (response.ok) { setSelectedIds((cur) => cur.filter((s) => s!== id)); await load(); }
      else { const err = await response.json(); alert(err.error || "ลบไม่ได้"); }
    } catch { alert("ลบไม่ได้"); }
  }

  async function handleBulkDelete(ids: string[]) {
    if (!ids.length) return;
    if (!confirm(`ต้องการลบ ${ids.length} แถวที่เลือกหรือไม่?`)) return;
    try {
      const res = await fetch("/api/performance", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "ลบไม่สำเร็จ"); return; }
      setSelectedIds([]); await load();
    } catch { alert("ลบไม่สำเร็จ"); }
  }

  async function handleDeleteAll() {
    if (!saved.length) return;
    if (!confirm(`ลบทั้งหมด ${saved.length} แถว? ไม่สามารถย้อนกลับได้`)) return;
    const allIds = saved.map((r) => r._id).filter((id): id is string => Boolean(id));
    await handleBulkDelete(allIds);
  }

  async function handleSaveUpdate() {
    if (!editingRow ||!editingRow._id) return;
    try {
      const response = await fetch("/api/performance", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingRow._id,...editingRow }) });
      if (response.ok) { setEditingRow(null); await load(); }
      else { const err = await response.json(); alert(err.error || "อัปเดตไม่ได้"); }
    } catch { alert("อัปเดตไม่ได้"); }
  }

  const summary = useMemo(() => ({
    rows: saved.length,
    clicks: saved.reduce((t, r) => t + parseFormattedNumber(r.clicks), 0),
    display: saved.reduce((t, r) => t + parseFormattedNumber(r.display), 0),
    sales: saved.reduce((t, r) => t + parseFormattedNumber(r.sales), 0),
    websites: new Set(saved.map((r) => r.website)).size,
  }), [saved]);

  const shown = saved.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(saved.length / pageSize));
  const savedIds = saved.map((r) => r._id).filter((id): id is string => Boolean(id));
  const visibleIds = shown.map((r) => r._id).filter((id): id is string => Boolean(id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const allSelected = savedIds.length > 0 && savedIds.every((id) => selectedIds.includes(id));

  if (!authorized) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fcfaf7] text-sm text-zinc-500">Checking access…</main>;
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <TopMenu />
      <main className="px-5 py-10 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-700 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#c8102e]"><BarChart3 size={14} /> Performance Data Management</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">Performance Overview</h1>
              <p className="mt-2 text-sm text-zinc-500">รวมข้อมูล Clicks, Display, CTR, Ranking และ Sales</p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-500 underline underline-offset-4 hover:text-zinc-800">Back to dashboard</Link>
          </div>

          {/* Metrics */}
          <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-[#c8102e]/10 to-red-50 p-4 dark:from-red-950/20 dark:to-zinc-900"><div className="flex items-center justify-between text-xs uppercase tracking-wide text-zinc-500"><span>Rows</span><BarChart3 size={16} className="text-[#c8102e]" /></div><p className="mt-2 text-2xl font-bold">{summary.rows.toLocaleString()}</p><p className="text-xs text-zinc-500">{summary.websites} websites</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-blue-500/10 to-blue-50 p-4 dark:from-blue-950/20 dark:to-zinc-900"><div className="flex items-center justify-between text-xs uppercase text-zinc-500"><span>Clicks</span><MousePointerClick size={16} className="text-blue-600" /></div><p className="mt-2 text-2xl font-bold">{summary.clicks.toLocaleString()}</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-violet-500/10 to-violet-50 p-4 dark:from-violet-950/20 dark:to-zinc-900"><div className="flex items-center justify-between text-xs uppercase text-zinc-500"><span>Display</span><Eye size={16} className="text-violet-600" /></div><p className="mt-2 text-2xl font-bold">{summary.display.toLocaleString()}</p></div>
            <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-amber-500/10 to-amber-50 p-4 dark:from-amber-950/20 dark:to-zinc-900"><div className="flex items-center justify-between text-xs uppercase text-zinc-500"><span>Sales</span><CircleDollarSign size={16} className="text-amber-600" /></div><p className="mt-2 text-2xl font-bold">฿{summary.sales.toLocaleString()}</p></div>
          </section>

          {/* Upload */}
          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center dark:border-zinc-600 dark:bg-zinc-800/30">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800"><Upload className="text-[#c8102e]" size={20} /></div>
              <p className="mt-3 font-semibold">Upload Excel / CSV File</p>
              <p className="mt-1 text-sm text-zinc-500">เรียงคอลัมน์: Month | Website | CLICK | DISPLAY | AVR.CTR | Ranking | Sales | Article</p>
              <label className={`mt-5 inline-flex cursor-pointer rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#c8102e] ${loading? "opacity-50 pointer-events-none" : ""}`}>
                Choose.xlsx,.xls or.csv
                <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={upload} disabled={loading} />
              </label>
              {fileName && <p className="mt-3 text-sm font-medium">{fileName}</p>}
              <p className="mt-2 text-sm text-zinc-500">{message}</p>
            </div>
          </section>

          {preview.length > 0 && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between bg-amber-50 px-5 py-4 dark:bg-amber-950/20">
                <h2 className="font-semibold">Preview — {preview.length} rows</h2>
                <button onClick={importRows} disabled={loading} className="rounded-full bg-[#c8102e] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{loading? "Importing..." : "Import data"}</button>
              </div>
              <div className="max-h-80 overflow-auto">
                <table className="w-full min-w- text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3">Website</th><th className="px-4 py-3 text-right">Click</th><th className="px-4 py-3 text-right">Display</th><th className="px-4 py-3 text-right">CTR</th><th className="px-4 py-3 text-right">Ranking</th><th className="px-4 py-3 text-right">Sales</th><th className="px-4 py-3">Article</th></tr></thead>
                  <tbody>{preview.map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800"><td className="px-4 py-2.5 font-medium">{String(row.month)}</td><td className="px-4 py-2.5">{String(row.website)}</td><td className="px-4 py-2.5 text-right">{parseFormattedNumber(row.clicks).toLocaleString()}</td><td className="px-4 py-2.5 text-right">{parseFormattedNumber(row.display).toLocaleString()}</td><td className="px-4 py-2.5 text-right">{parseFormattedNumber(row.ctr).toFixed(2)}%</td><td className="px-4 py-2.5 text-right">{parseFormattedNumber(row.ranking).toFixed(1)}</td><td className="px-4 py-2.5 text-right">฿{parseFormattedNumber(row.sales).toLocaleString()}</td><td className="px-4 py-2.5 max-w- truncate" title={String(row.article)}>{String(row.article)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><Search size={16} className="text-[#c8102e]" /> Saved Performance Data</h2>
                <p className="mt-1 text-xs text-zinc-500">{saved.length} rows • {summary.websites} websites • Page {page}/{pages} • เลือก {selectedIds.length}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && <button onClick={() => handleBulkDelete(selectedIds)} className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"><Trash2 size={14} /> ลบที่เลือก ({selectedIds.length})</button>}
                <button onClick={handleDeleteAll} disabled={!saved.length} className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 size={14} /> ลบทั้งหมด</button>
              </div>
            </div>

            <div className="overflow-auto">
              <table className="w-full min-w- text-left text-sm">
                <thead className="bg-white text-xs font-semibold uppercase tracking-wide text-zinc-500 shadow-sm dark:bg-zinc-900">
                  <tr>
                    <th className="w- px-4 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={() => {
                      if (allVisibleSelected) setSelectedIds((cur) => cur.filter((id) =>!visibleIds.includes(id)));
                      else setSelectedIds((cur) => Array.from(new Set([...cur,...visibleIds])));
                    }} /></th>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3">Website</th>
                    <th className="px-4 py-3 text-right">Click</th>
                    <th className="px-4 py-3 text-right">Display</th>
                    <th className="px-4 py-3 text-right">AVR.CTR</th>
                    <th className="px-4 py-3 text-right">Ranking</th>
                    <th className="px-4 py-3 text-right">Sales</th>
                    <th className="px-4 py-3">Article</th>
                    <th className="w- px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0? (
                    <tr><td colSpan={10} className="px-4 py-16 text-center text-zinc-500">ยังไม่มีข้อมูล Performance กรุณาอัปโหลดไฟล์ Excel</td></tr>
                  ) : (
                    shown.map((row, idx) => (
                      <tr key={row._id || idx} className="border-t border-zinc-100 odd:bg-white even:bg-zinc-50/50 hover:bg-amber-50/50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30">
                        <td className="px-4 py-3 text-center"><input type="checkbox" checked={Boolean(row._id && selectedIds.includes(row._id))} onChange={() => row._id && setSelectedIds((cur) => cur.includes(row._id!)? cur.filter((id) => id!== row._id) : [...cur, row._id!])} /></td>
                        <td className="px-4 py-3 font-medium">{row.month || "-"}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">{row.website || "-"}</span></td>
                        <td className="px-4 py-3 text-right">{parseFormattedNumber(row.clicks).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-zinc-500">{parseFormattedNumber(row.display).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{parseFormattedNumber(row.ctr).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-semibold">{parseFormattedNumber(row.ranking).toFixed(1)}</td>
                        <td className="px-4 py-3 text-right">฿{parseFormattedNumber(row.sales).toLocaleString()}</td>
                        <td className="px-4 py-3 max-w- truncate" title={row.article}>{row.article || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex justify-center gap-1.5">
                            <button onClick={() => setEditingRow(row)} className="rounded-full p-1.5 text-zinc-400 hover:bg-blue-50 hover:text-blue-600"><Edit3 size={16} /></button>
                            <button onClick={() => handleDeleteRow(row._id)} className="rounded-full p-1.5 text-zinc-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={16} /></button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {saved.length > pageSize && (
              <div className="flex items-center justify-between border-t border-zinc-200 bg-zinc-50 px-5 py-3 dark:border-zinc-700 dark:bg-zinc-800">
                <label className="flex items-center gap-2 text-xs text-zinc-500"><input type="checkbox" checked={allSelected} onChange={() => setSelectedIds(allSelected? [] : savedIds)} /> เลือกทั้งหมด {saved.length} แถว</label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">Page {page} / {pages}</span>
                  <div className="flex gap-2">
                    <button disabled={page === 1} onClick={() => setPage((c) => c - 1)} className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium disabled:opacity-40">Previous</button>
                    <button disabled={page === pages} onClick={() => setPage((c) => c + 1)} className="rounded-full border bg-white px-4 py-1.5 text-xs font-medium disabled:opacity-40">Next</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="border-b pb-3 text-lg font-semibold dark:border-zinc-700">Edit Record</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label>Month<input type="text" value={editingRow.month || ""} onChange={(e) => setEditingRow({...editingRow, month: e.target.value })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
                <label>Website<input type="text" value={editingRow.website || ""} onChange={(e) => setEditingRow({...editingRow, website: e.target.value })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
              </div>
              <label>Article<input type="text" value={editingRow.article || ""} onChange={(e) => setEditingRow({...editingRow, article: e.target.value })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label>CLICK<input type="number" value={editingRow.clicks?? 0} onChange={(e) => setEditingRow({...editingRow, clicks: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
                <label>DISPLAY<input type="number" value={editingRow.display?? 0} onChange={(e) => setEditingRow({...editingRow, display: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <label>CTR (%)<input type="number" step="0.01" value={editingRow.ctr?? 0} onChange={(e) => setEditingRow({...editingRow, ctr: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
                <label>Ranking<input type="number" step="0.1" value={editingRow.ranking?? 0} onChange={(e) => setEditingRow({...editingRow, ranking: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
                <label>Sales<input type="number" value={editingRow.sales?? 0} onChange={(e) => setEditingRow({...editingRow, sales: Number(e.target.value) })} className="mt-1 w-full rounded-xl border bg-zinc-50 p-2.5 dark:bg-zinc-800" /></label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditingRow(null)} className="rounded-full border px-5 py-2 text-sm font-medium hover:bg-zinc-100">Cancel</button>
              <button onClick={handleSaveUpdate} className="rounded-full bg-[#c8102e] px-5 py-2 text-sm font-semibold text-white hover:opacity-90">Save changes</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}