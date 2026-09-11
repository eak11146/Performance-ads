"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
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

// ฟังก์ชันแปลงค่าตัวเลขย่อ (เช่น 52.9k -> 52900, 3.38m -> 3380000, 1.60% -> 1.60)
const parseFormattedNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const str = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
  if (!str) return 0;

  if (str.endsWith("%")) {
    const num = parseFloat(str.replace("%", ""));
    return Number.isFinite(num) ? num : 0;
  }
  if (str.endsWith("k")) {
    const num = parseFloat(str.replace("k", ""));
    return Number.isFinite(num) ? num * 1000 : 0;
  }
  if (str.endsWith("m")) {
    const num = parseFloat(str.replace("m", ""));
    return Number.isFinite(num) ? num * 1000000 : 0;
  }

  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseSheet(sheet: XLSX.WorkSheet): SheetRow[] {
  // อ่าน Excel แบบ Matrix โดยไม่สนหัวตาราง
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    throw new Error("ไฟล์ว่างเปล่า ไม่มีข้อมูล");
  }

  const parsedRows: SheetRow[] = [];

  for (let i = 0; i < matrix.length; i++) {
    const line = matrix[i];
    if (!Array.isArray(line)) continue;

    // กรองเอาเซลล์ที่ไม่ว่าง
    const cleanCells = line.map((cell) => String(cell ?? "").trim());

    // ข้ามแถวที่ไม่มีข้อมูลหรือเป็นแถวว่าง
    if (cleanCells.every((cell) => !cell)) continue;

    // ตรวจสอบว่าแถวนี้มีข้อมูลหลักอย่างน้อย 2-3 ช่องขึ้นไป
    const monthVal = cleanCells[0] || "";
    const websiteVal = cleanCells[1] || "";

    // ถ้าแถวไม่มี Month หรือ Website ให้ข้าม (เช่น แถวเว้นวรรค)
    if (!monthVal && !websiteVal) continue;

    const clicksVal = parseFormattedNumber(cleanCells[2]);
    const displayVal = parseFormattedNumber(cleanCells[3]);
    let ctrVal = parseFormattedNumber(cleanCells[4]);

    // คำนวณ CTR อัตโนมัติหากไม่มีค่าส่งมา
    if (ctrVal === 0 && displayVal > 0 && clicksVal > 0) {
      ctrVal = parseFloat(((clicksVal / displayVal) * 100).toFixed(2));
    }

    const rankingVal = parseFormattedNumber(cleanCells[5]);
    const salesVal = parseFormattedNumber(cleanCells[6]);
    const articleVal = cleanCells[7] || "-";

    parsedRows.push({
      month: monthVal,
      website: websiteVal,
      clicks: clicksVal,
      display: displayVal,
      ctr: ctrVal,
      ranking: rankingVal,
      sales: salesVal,
      article: articleVal,
    });
  }

  return parsedRows;
}

export default function PerformanceDataPage() {
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);
  const [saved, setSaved] = useState<PerformanceRow[]>([]);
  const [preview, setPreview] = useState<SheetRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState(
    "เลือกไฟล์ Excel หรือ CSV ที่มีโครงสร้างข้อมูลเรียงตามลำดับคอลัมน์"
  );
  const [loading, setLoading] = useState(false);
  const [editingRow, setEditingRow] = useState<PerformanceRow | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    try {
      const response = await fetch("/api/performance", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setSaved(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to load data:", data);
      }
    } catch (err) {
      console.error("Network error:", err);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/auth")
        .then(async (response) => {
          if (!response.ok) return router.replace("/login");
          setAuthorized(true);
          await load();
        })
        .catch(() => router.replace("/login"));
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

      try {
        book = XLSX.read(buffer, { type: "array" });
      } catch {
        const bytes = new Uint8Array(buffer);
        let text = "";
        if (bytes[0] === 0xff && bytes[1] === 0xfe) {
          text = new TextDecoder("utf-16le").decode(buffer);
        } else {
          text = new TextDecoder("utf-8").decode(buffer);
        }
        book = XLSX.read(text, { type: "string" });
      }

      const firstSheet = book.Sheets[book.SheetNames[0]];
      const rows = parseSheet(firstSheet);

      if (!rows.length) {
        throw new Error("ไม่พบแถวข้อมูลที่สามารถนำเข้าได้ในไฟล์นี้");
      }

      setPreview(rows);
      setFileName(file.name);
      setMessage(`พร้อมนำเข้า ${rows.length} รายการจากไฟล์ "${file.name}"`);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error);
      setPreview([]);
      setMessage(`เกิดข้อผิดพลาดในการอ่านไฟล์: ${errMsg}`);
    } finally {
      setLoading(false);
      event.target.value = "";
    }
  }

  async function importRows() {
    if (!preview.length) return;

    setLoading(true);
    setMessage(`กำลังบันทึกข้อมูล ${preview.length} รายการลงในระบบ...`);

    try {
      const response = await fetch("/api/performance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: preview }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
        return;
      }

      setPreview([]);
      setPage(1);
      setMessage(`นำเข้าข้อมูลสำเร็จแล้วทั้งหมด ${data.imported || preview.length} รายการ`);
      await load();
    } catch (error) {
      console.error(error);
      setMessage("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteRow(id?: string) {
    if (!id) return;
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) return;

    try {
      const response = await fetch("/api/performance", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [id] }),
      });

      if (response.ok) {
        await load();
      } else {
        const err = await response.json();
        alert(`เกิดข้อผิดพลาด: ${err.error || "ไม่สามารถลบข้อมูลได้"}`);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert("เกิดข้อผิดพลาดในการลบข้อมูล");
    }
  }

  async function handleSaveUpdate() {
    if (!editingRow || !editingRow._id) return;

    try {
      const response = await fetch("/api/performance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingRow._id,
          ...editingRow,
        }),
      });

      if (response.ok) {
        setEditingRow(null);
        await load();
      } else {
        const err = await response.json();
        alert(`เกิดข้อผิดพลาด: ${err.error || "ไม่สามารถอัปเดตข้อมูลได้"}`);
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("เกิดข้อผิดพลาดในการอัปเดตข้อมูล");
    }
  }

  const shown = saved.slice((page - 1) * pageSize, page * pageSize);
  const pages = Math.max(1, Math.ceil(saved.length / pageSize));

  const columns = ["Month", "Website", "CLICK", "DISPLAY", "AVR.CTR", "Ranking", "Sales", "Article", "Actions"];

  const websiteCount = useMemo(
    () => new Set(saved.map((row) => row.website || "")).size,
    [saved]
  );

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-zinc-500">
        Checking access…
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-zinc-950 dark:bg-zinc-950 dark:text-zinc-100">
      <TopMenu />
      <main className="px-5 py-12 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-10 flex items-end justify-between border-b border-zinc-300 pb-8 dark:border-zinc-700">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[.2em] text-[#c8102e]">
                Performance Data Management
              </p>
              <h1 className="mt-3 text-4xl font-semibold">Performance Overview</h1>
            </div>
            <Link href="/dashboard" className="text-sm underline underline-offset-4">
              Back to dashboard
            </Link>
          </div>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="rounded-xl border border-dashed border-zinc-400 p-7 text-center">
              <p className="font-semibold">Upload Excel / CSV File</p>
              <p className="mt-1 text-sm text-zinc-500">
                เรียงคอลัมน์: Month | Website | CLICK | DISPLAY | AVR.CTR | ranking | sales | article
              </p>
              <label
                className={`mt-5 inline-flex cursor-pointer rounded-full bg-zinc-950 px-5 py-3 text-sm font-medium text-white hover:bg-[#c8102e] dark:bg-white dark:text-zinc-950 ${
                  loading ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                Choose .xlsx, .xls or .csv
                <input
                  className="sr-only"
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={upload}
                  disabled={loading}
                />
              </label>
              {fileName && <p className="mt-3 text-sm font-medium">{fileName}</p>}
              <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
            </div>
          </section>

          {/* Preview Section */}
          {preview.length > 0 && (
            <section className="mt-7 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
              <div className="flex items-center justify-between p-5">
                <h2 className="font-semibold">Preview — {preview.length} rows</h2>
                <button
                  onClick={importRows}
                  disabled={loading}
                  className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                >
                  {loading ? "Importing..." : "Import data"}
                </button>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full min-w-[700px] text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-100 text-xs dark:bg-zinc-800">
                    <tr>
                      {columns.slice(0, -1).map((column) => (
                        <th key={column} className="px-4 py-3">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, index) => (
                      <tr key={index} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="px-4 py-3 font-medium">{String(row.month)}</td>
                        <td className="px-4 py-3">{String(row.website)}</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.clicks).toLocaleString()}</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.display).toLocaleString()}</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.ctr).toFixed(2)}%</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.ranking).toFixed(1)}</td>
                        <td className="px-4 py-3">฿{parseFormattedNumber(row.sales).toLocaleString()}</td>
                        <td className="px-4 py-3">{String(row.article)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Saved Data Section */}
          <section className="mt-7 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex justify-between p-5">
              <h2 className="font-semibold">Saved Performance Data</h2>
              <span className="text-sm text-zinc-500">
                {saved.length} rows · {websiteCount} websites
              </span>
            </div>
            <div className="overflow-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-zinc-100 text-xs dark:bg-zinc-800">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-8 text-center text-zinc-500">
                        ยังไม่มีข้อมูล Performance ในระบบ (กรุณาอัปโหลดไฟล์ Excel)
                      </td>
                    </tr>
                  ) : (
                    shown.map((row, idx) => (
                      <tr key={row._id || idx} className="border-t border-zinc-200 dark:border-zinc-700">
                        <td className="px-4 py-3 font-medium">{row.month || "-"}</td>
                        <td className="px-4 py-3">{row.website || "-"}</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.clicks).toLocaleString()}</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.display).toLocaleString()}</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.ctr).toFixed(2)}%</td>
                        <td className="px-4 py-3">{parseFormattedNumber(row.ranking).toFixed(1)}</td>
                        <td className="px-4 py-3">฿{parseFormattedNumber(row.sales).toLocaleString()}</td>
                        <td className="px-4 py-3">{row.article || "-"}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingRow(row)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteRow(row._id)}
                              className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {saved.length > pageSize && (
              <div className="flex items-center justify-between border-t border-zinc-200 p-4 dark:border-zinc-700">
                <span className="text-sm text-zinc-500">
                  Page {page} / {pages}
                </span>
                <div className="flex gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    disabled={page === pages}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded border px-3 py-1 text-sm disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Modal ป๊อบอัพแก้ไขข้อมูล */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold border-b pb-3 dark:border-zinc-700">
              Edit Record
            </h3>
            <div className="mt-4 grid gap-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <label>
                  Month
                  <input
                    type="text"
                    value={editingRow.month || ""}
                    onChange={(e) => setEditingRow({ ...editingRow, month: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label>
                  Website
                  <input
                    type="text"
                    value={editingRow.website || ""}
                    onChange={(e) => setEditingRow({ ...editingRow, website: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
              </div>

              <label>
                Article
                <input
                  type="text"
                  value={editingRow.article || ""}
                  onChange={(e) => setEditingRow({ ...editingRow, article: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </label>

              <div className="grid grid-cols-2 gap-3">
                <label>
                  CLICK
                  <input
                    type="number"
                    value={editingRow.clicks ?? 0}
                    onChange={(e) => setEditingRow({ ...editingRow, clicks: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label>
                  DISPLAY
                  <input
                    type="number"
                    value={editingRow.display ?? 0}
                    onChange={(e) => setEditingRow({ ...editingRow, display: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <label>
                  AVR.CTR (%)
                  <input
                    type="number"
                    step="0.01"
                    value={editingRow.ctr ?? 0}
                    onChange={(e) => setEditingRow({ ...editingRow, ctr: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label>
                  Ranking
                  <input
                    type="number"
                    step="0.1"
                    value={editingRow.ranking ?? 0}
                    onChange={(e) => setEditingRow({ ...editingRow, ranking: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label>
                  Sales
                  <input
                    type="number"
                    value={editingRow.sales ?? 0}
                    onChange={(e) => setEditingRow({ ...editingRow, sales: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingRow(null)}
                className="rounded-lg px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUpdate}
                className="rounded-lg bg-[#c8102e] px-4 py-2 text-sm text-white hover:opacity-90"
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}