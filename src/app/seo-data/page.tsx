"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Trash2, Upload, Search, Edit3, BarChart3 } from "lucide-react";
import TopMenu from "@/components/top-menu";

type SeoRow = {
  _id?: string;
  date: string;
  site: string;
  keyword: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  createdAt?: string;
};

type SheetRow = Record<string, string | number>;

const fields = {
  date: ["date", "day", "time", "วันที่", "วัน", "เวลา"],
  site: ["site", "website", "web", "property", "domain", "url", "เว็บไซต์", "เว็บ", "โดเมน"],
  keyword: ["keyword","keywords","query","queries","top queries","ข้อความค้นหายอดนิยม","คำค้นหา","คีย์เวิร์ด","search query"],
  clicks: ["clicks","click","การคลิก","คลิก"],
  impressions: ["impressions","impression","การแสดงผล","search volume","views"],
  ctr: ["ctr","click through rate","อัตราการคลิก"],
  position: ["position","avg position","ตำแหน่ง","อันดับ","rank"],
};

const clean = (value: unknown) => String(value || "").toLowerCase().replace(/[\s_\-./():]/g, "");
function isExactMatch(header: string, aliases: string[]) {
  const cHeader = clean(header);
  if (!cHeader) return false;
  return aliases.some((alias) => cHeader === clean(alias));
}
function isPartialMatch(header: string, aliases: string[]) {
  const cHeader = clean(header);
  if (!cHeader || cHeader.length < 3) return false;
  return aliases.some((alias) => {
    const cAlias = clean(alias);
    return cAlias.length >= 3 && (cHeader.includes(cAlias) || cAlias.includes(cHeader));
  });
}
function matchField(header: string, aliases: string[]) {
  return isExactMatch(header, aliases) || isPartialMatch(header, aliases);
}
const number = (value: string | number | undefined | null) => {
  if (typeof value === "number") return Number.isFinite(value)? value : 0;
  const cleaned = String(value?? "").replace(/[%,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed)? parsed : 0;
};

function parseSheet(sheet: XLSX.WorkSheet, defaultSite: string, defaultDate: string): SheetRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  if (!matrix.length) throw new Error("ไฟล์ว่างเปล่า");
  let headerAt = matrix.findIndex((line) => Array.isArray(line) && line.some((v) => isExactMatch(String(v), fields.keyword)));
  if (headerAt < 0) headerAt = matrix.findIndex((line) => Array.isArray(line) && line.some((v) => isPartialMatch(String(v), fields.keyword)));
  if (headerAt < 0) throw new Error("ไม่พบคอลัมน์ Keyword ในไฟล์นี้");
  const rawHeaders = (matrix[headerAt] || []).map((v) => String(v?? "").trim());
  const colIndex: { [key: string]: number } = {};
  rawHeaders.forEach((header, idx) => {
    if (!header) return;
    if (colIndex.keyword === undefined && matchField(header, fields.keyword)) colIndex.keyword = idx;
    else if (colIndex.clicks === undefined && matchField(header, fields.clicks)) colIndex.clicks = idx;
    else if (colIndex.impressions === undefined && matchField(header, fields.impressions)) colIndex.impressions = idx;
    else if (colIndex.ctr === undefined && matchField(header, fields.ctr)) colIndex.ctr = idx;
    else if (colIndex.position === undefined && matchField(header, fields.position)) colIndex.position = idx;
    else if (colIndex.site === undefined && matchField(header, fields.site)) colIndex.site = idx;
    else if (colIndex.date === undefined && matchField(header, fields.date)) colIndex.date = idx;
  });
  const parsedRows: SheetRow[] = [];
  for (let i = headerAt + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (!Array.isArray(line)) continue;
    const kw = colIndex.keyword!== undefined? String(line[colIndex.keyword]?? "").trim() : "";
    if (!kw) continue;
    const clicksVal = colIndex.clicks!== undefined? number(line[colIndex.clicks] as string) : 0;
    const impressionsVal = colIndex.impressions!== undefined? number(line[colIndex.impressions] as string) : 0;
    let ctrVal = colIndex.ctr!== undefined? number(line[colIndex.ctr] as string) : 0;
    if (ctrVal === 0 && impressionsVal > 0 && clicksVal > 0) ctrVal = parseFloat(((clicksVal / impressionsVal) * 100).toFixed(2));
    const positionVal = colIndex.position!== undefined? number(line[colIndex.position] as string) : 0;
    const siteVal = colIndex.site!== undefined? String(line[colIndex.site]?? "").trim() : "";
    const dateVal = colIndex.date!== undefined? String(line[colIndex.date]?? "").trim() : "";
    const finalDate = dateVal || defaultDate || new Date().toISOString().slice(0, 10);
    const finalSite = siteVal || defaultSite || "default-site";
    parsedRows.push({
      date: finalDate, site: finalSite, keyword: kw, clicks: clicksVal, impressions: impressionsVal, ctr: ctrVal, position: positionVal,
      Date: finalDate, Site: finalSite, Keyword: kw, Clicks: clicksVal, Impressions: impressionsVal, CTR: ctrVal, Position: positionVal,
    });
  }
  return parsedRows;
}

export default function SeoDataPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [saved, setSaved] = useState<SeoRow[]>([]);
  const [preview, setPreview] = useState<SheetRow[]>([]);
  const [site, setSite] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Select a spreadsheet (.xlsx,.xls,.csv). Site and Date are filled automatically if absent.");
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<SeoRow | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const pageSize = 15;

  const load = async () => {
    try {
      const response = await fetch("/api/seo-data", { cache: "no-store" });
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
      const rows = parseSheet(firstSheet, site, date);
      if (!rows.length) throw new Error("ไม่พบแถวข้อมูล");
      setPreview(rows);
      setFileName(file.name);
      setMessage(`พร้อมนำเข้า ${rows.length} แถวจากไฟล์ "${file.name}"`);
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
      const response = await fetch("/api/seo-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows: preview }) });
      const data = await response.json();
      if (!response.ok) { setMessage(data.error || "นำเข้าไม่สำเร็จ"); return; }
      setPreview([]); setPage(1); setMessage(`นำเข้าสำเร็จ ${data.imported} รายการ`); await load();
    } catch { setMessage("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้"); } finally { setLoading(false); }
  }

  async function handleDeleteRow(id?: string) {
    if (!id) return;
    if (!confirm("ลบรายการนี้?")) return;
    try {
      const response = await fetch("/api/seo-data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: [id] }) });
      if (response.ok) { setSelectedIds((cur) => cur.filter((s) => s!== id)); await load(); }
      else { const err = await response.json(); alert(err.error || "ลบไม่ได้"); }
    } catch { alert("ลบไม่ได้"); }
  }

  async function handleBulkDelete(ids: string[]) {
    if (!ids.length) return;
    if (!confirm(`ต้องการลบ ${ids.length} แถวที่เลือกหรือไม่?`)) return;
    try {
      const res = await fetch("/api/seo-data", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) });
      const data = await res.json();
      if (!res.ok) { alert(data.error || "ลบไม่สำเร็จ"); return; }
      setSelectedIds([]); await load();
    } catch { alert("ลบไม่สำเร็จ"); }
  }

  async function handleDeleteAll() {
    if (!saved.length) return;
    if (!confirm(`ต้องการลบทั้งหมด ${saved.length} แถวหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้`)) return;
    const allIds = saved.map((r) => r._id).filter((id): id is string => Boolean(id));
    await handleBulkDelete(allIds);
  }

  async function handleSaveUpdate() {
    if (!editingRow ||!editingRow._id) return;
    try {
      const response = await fetch("/api/seo-data", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editingRow._id,...editingRow }) });
      if (response.ok) { setEditingRow(null); await load(); }
      else { const err = await response.json(); alert(err.error || "อัปเดตไม่ได้"); }
    } catch { alert("อัปเดตไม่ได้"); }
  }

  const shown = saved.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(saved.length / pageSize));
  const savedIds = saved.map((r) => r._id).filter((id): id is string => Boolean(id));
  const allSelected = savedIds.length > 0 && savedIds.every((id) => selectedIds.includes(id));
  const visibleIds = shown.map((r) => r._id).filter((id): id is string => Boolean(id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));

  const sites = useMemo(() => new Set(saved.map((row) => row.site)).size, [saved]);

  if (!authorized) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-zinc-500">Checking access…</main>;
  }

  return (
    <div className="min-h-screen bg-[#fcfaf7] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <TopMenu />
      <main className="px-5 py-10 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-200 pb-8 dark:border-zinc-700 sm:flex-row sm:items-end">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.2em] text-[#c8102e]"><BarChart3 size={14} /> SEO performance</p>
              <h1 className="mt-3 text-4xl font-bold tracking-tight">SEO data center</h1>
              <p className="mt-2 text-sm text-zinc-500">จัดการ Keyword, Clicks, Impressions และ Ranking แบบรวมศูนย์</p>
            </div>
            <Link href="/dashboard" className="text-sm font-medium text-zinc-500 underline underline-offset-4 hover:text-zinc-800">Back to dashboard</Link>
          </div>

          <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold">Default website
                <input value={site} onChange={(e) => setSite(e.target.value)} placeholder="zmi.co.th" className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#c8102e] focus:ring-2 focus:ring-[#c8102e]/10 dark:border-zinc-700 dark:bg-zinc-800" />
              </label>
              <label className="text-sm font-semibold">Default date
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm font-normal outline-none focus:border-[#c8102e] focus:ring-2 focus:ring-[#c8102e]/10 dark:border-zinc-700 dark:bg-zinc-800" />
              </label>
            </div>
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/50 p-8 text-center dark:border-zinc-600 dark:bg-zinc-800/30">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800"><Upload className="text-[#c8102e]" size={20} /></div>
              <p className="mt-3 font-semibold">Upload SEO spreadsheet</p>
              <p className="mt-1 text-sm text-zinc-500">Needs Keyword / Query. Other fields auto-mapped.</p>
              <label className={`mt-5 inline-flex cursor-pointer rounded-full bg-zinc-950 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#c8102e] ${loading? "opacity-50 pointer-events-none" : ""}`}>
                Choose.xlsx,.xls or.csv
                <input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={upload} disabled={loading} />
              </label>
              {fileName && <p className="mt-3 text-sm font-medium text-zinc-700">{fileName}</p>}
              <p className="mt-2 text-sm text-zinc-500">{message}</p>
            </div>
          </section>

          {preview.length > 0 && (
            <section className="mt-6 overflow-hidden rounded-2xl border border-amber-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between bg-amber-50 px-5 py-4 dark:bg-amber-950/20">
                <h2 className="font-semibold">Preview — {preview.length} rows</h2>
                <button onClick={importRows} disabled={loading} className="rounded-full bg-[#c8102e] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">{loading? "Importing..." : "Import data"}</button>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full min-w- text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-50 text-xs uppercase text-zinc-500 dark:bg-zinc-800"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Site</th><th className="px-4 py-3">Keyword</th><th className="px-4 py-3 text-right">Clicks</th><th className="px-4 py-3 text-right">Impressions</th><th className="px-4 py-3 text-right">CTR</th><th className="px-4 py-3 text-right">Pos</th></tr></thead>
                  <tbody>{preview.slice(0, 30).map((row, i) => (
                    <tr key={i} className="border-t border-zinc-100 dark:border-zinc-800"><td className="px-4 py-2">{String(row.date).slice(0, 10)}</td><td className="px-4 py-2">{String(row.site)}</td><td className="px-4 py-2 max-w- truncate" title={String(row.keyword)}>{String(row.keyword)}</td><td className="px-4 py-2 text-right">{number(row.clicks).toLocaleString()}</td><td className="px-4 py-2 text-right">{number(row.impressions).toLocaleString()}</td><td className="px-4 py-2 text-right">{number(row.ctr).toFixed(2)}%</td><td className="px-4 py-2 text-right">{number(row.position).toFixed(1)}</td></tr>
                  ))}</tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 font-semibold"><Search size={16} className="text-[#c8102e]" /> Saved keyword data</h2>
                <p className="mt-1 text-xs text-zinc-500">{saved.length} rows • {sites} sites • Page {page}/{pages} • เลือก {selectedIds.length}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {selectedIds.length > 0 && (
                  <button onClick={() => handleBulkDelete(selectedIds)} className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"><Trash2 size={14} /> ลบที่เลือก ({selectedIds.length})</button>
                )}
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
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Site</th>
                    <th className="px-4 py-3">Keyword</th>
                    <th className="px-4 py-3 text-right">Clicks</th>
                    <th className="px-4 py-3 text-right">Impr.</th>
                    <th className="px-4 py-3 text-right">CTR</th>
                    <th className="px-4 py-3 text-right">Pos</th>
                    <th className="w- px-4 py-3 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0? (
                    <tr><td colSpan={9} className="px-4 py-16 text-center text-zinc-500">ยังไม่มีข้อมูล SEO ในระบบ กรุณาอัปโหลดไฟล์ด้านบน</td></tr>
                  ) : (
                    shown.map((row, idx) => (
                      <tr key={row._id || idx} className="border-t border-zinc-100 odd:bg-white even:bg-zinc-50/50 hover:bg-amber-50/50 dark:border-zinc-800 dark:odd:bg-zinc-900 dark:even:bg-zinc-800/30">
                        <td className="px-4 py-3 text-center"><input type="checkbox" checked={Boolean(row._id && selectedIds.includes(row._id))} onChange={() => row._id && setSelectedIds((cur) => cur.includes(row._id!)? cur.filter((id) => id!== row._id) : [...cur, row._id!])} /></td>
                        <td className="px-4 py-3 text-zinc-600">{row.date?.slice(0, 10) || "-"}</td>
                        <td className="px-4 py-3"><span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-medium dark:bg-zinc-800">{row.site || "-"}</span></td>
                        <td className="px-4 py-3 max-w- truncate font-medium" title={row.keyword}>{row.keyword || "-"}</td>
                        <td className="px-4 py-3 text-right">{number(row.clicks).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right text-zinc-500">{number(row.impressions).toLocaleString()}</td>
                        <td className="px-4 py-3 text-right">{number(row.ctr).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-semibold">{number(row.position).toFixed(1)}</td>
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
            <h3 className="border-b pb-3 text-lg font-semibold dark:border-zinc-700">Edit SEO Record</h3>
            <div className="mt-4 grid gap-3 text-sm">
              <label>Date<input type="date" value={editingRow.date? new Date(editingRow.date).toISOString().slice(0, 10) : ""} onChange={(e) => setEditingRow({...editingRow, date: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800" /></label>
              <label>Site
                <select value={editingRow.site || ""} onChange={(e) => setEditingRow({...editingRow, site: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800">
                  <option value="zmithailand">Zmithailand</option>
                  <option value="thaisuperphone">Thaisuperphone</option>
                  <option value="imilabthailand">Imilabthailand</option>
                  <option value="isuper">Isuper</option> 
                </select>
              </label>
              <label>Keyword<input type="text" value={editingRow.keyword || ""} onChange={(e) => setEditingRow({...editingRow, keyword: e.target.value })} className="mt-1 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-700 dark:bg-zinc-800" /></label>
              <div className="grid grid-cols-2 gap-3">
                <label>Clicks<input type="number" value={editingRow.clicks?? 0} onChange={(e) => setEditingRow({...editingRow, clicks: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 dark:bg-zinc-800" /></label>
                <label>Impressions<input type="number" value={editingRow.impressions?? 0} onChange={(e) => setEditingRow({...editingRow, impressions: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 dark:bg-zinc-800" /></label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>CTR (%)<input type="number" step="0.01" value={editingRow.ctr?? 0} onChange={(e) => setEditingRow({...editingRow, ctr: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 dark:bg-zinc-800" /></label>
                <label>Position<input type="number" step="0.1" value={editingRow.position?? 0} onChange={(e) => setEditingRow({...editingRow, position: Number(e.target.value) })} className="mt-1 w-full rounded-xl border p-2.5 dark:bg-zinc-800" /></label>
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