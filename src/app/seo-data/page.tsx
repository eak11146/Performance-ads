 "use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
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
  keyword: [
    "keyword",
    "keywords",
    "query",
    "queries",
    "top queries",
    "top query",
    "ข้อความค้นหายอดนิยม",
    "คำค้นหา",
    "คีย์เวิร์ด",
    "คำค้น",
    "คำค้นหายอดนิยม",
    "search query",
    "search queries",
    "search term",
    "search terms",
  ],
  clicks: ["clicks", "click", "การคลิก", "คลิก", "จำนวนคลิก", "ยอดคลิก"],
  impressions: [
    "impressions",
    "impression",
    "การแสดงผล",
    "การแสดง",
    "impr",
    "impr.",
    "จำนวนการแสดงผล",
    "avg. monthly searches",
    "avg monthly searches",
    "monthly searches",
    "search volume",
    "ปริมาณการค้นหา",
    "ยอดวิว",
    "views",
  ],
  ctr: ["ctr", "click through rate", "อัตราการคลิกผ่าน", "อัตราการคลิก", "อัตราคลิก"],
  position: [
    "position",
    "avg position",
    "avg. position",
    "average position",
    "organic average position",
    "ตำแหน่ง",
    "ตำแหน่งเฉลี่ย",
    "อันดับ",
    "อันดับเฉลี่ย",
    "rank",
    "average rank",
  ],
};

const clean = (value: unknown) =>
  String(value || "")
    .toLowerCase()
    .replace(/[\s_\-./():]/g, "");

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
    return (
      cAlias.length >= 3 &&
      (cHeader.includes(cAlias) || cAlias.includes(cHeader))
    );
  });
}

function matchField(header: string, aliases: string[]) {
  return isExactMatch(header, aliases) || isPartialMatch(header, aliases);
}

const number = (value: string | number | undefined | null) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[%,\s]/g, "");
  const parsed = parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseSheet(
  sheet: XLSX.WorkSheet,
  defaultSite: string,
  defaultDate: string
): SheetRow[] {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  if (!matrix.length) {
    throw new Error("ไฟล์ว่างเปล่า ไม่มีข้อมูล");
  }

  let headerAt = matrix.findIndex(
    (line) =>
      Array.isArray(line) &&
      line.filter((c) => String(c).trim()).length >= 2 &&
      line.some((value) => isExactMatch(String(value), fields.keyword))
  );

  if (headerAt < 0) {
    headerAt = matrix.findIndex(
      (line) =>
        Array.isArray(line) &&
        line.some((value) => isExactMatch(String(value), fields.keyword))
    );
  }

  if (headerAt < 0) {
    headerAt = matrix.findIndex(
      (line) =>
        Array.isArray(line) &&
        line.filter((c) => String(c).trim()).length >= 2 &&
        line.some((value) => isPartialMatch(String(value), fields.keyword))
    );
  }

  if (headerAt < 0) {
    const sampleHeaders = (matrix[0] || [])
      .map((c) => String(c).trim())
      .filter(Boolean)
      .slice(0, 8)
      .join(", ");
    throw new Error(
      `ไม่พบคอลัมน์ Keyword หรือ Query ในไฟล์นี้ (หัวตารางที่พบ: ${sampleHeaders || "ไม่พบหัวตาราง"})`
    );
  }

  const rawHeaders = (matrix[headerAt] || []).map((v) => String(v ?? "").trim());
  const colIndex: { [key: string]: number } = {};
  rawHeaders.forEach((header, idx) => {
    if (!header) return;
    if (colIndex.keyword === undefined && matchField(header, fields.keyword)) {
      colIndex.keyword = idx;
    } else if (colIndex.clicks === undefined && matchField(header, fields.clicks)) {
      colIndex.clicks = idx;
    } else if (colIndex.impressions === undefined && matchField(header, fields.impressions)) {
      colIndex.impressions = idx;
    } else if (colIndex.ctr === undefined && matchField(header, fields.ctr)) {
      colIndex.ctr = idx;
    } else if (colIndex.position === undefined && matchField(header, fields.position)) {
      colIndex.position = idx;
    } else if (colIndex.site === undefined && matchField(header, fields.site)) {
      colIndex.site = idx;
    } else if (colIndex.date === undefined && matchField(header, fields.date)) {
      colIndex.date = idx;
    }
  });

  const parsedRows: SheetRow[] = [];

  for (let i = headerAt + 1; i < matrix.length; i++) {
    const line = matrix[i];
    if (!Array.isArray(line)) continue;

    const kw =
      colIndex.keyword !== undefined
        ? String(line[colIndex.keyword] ?? "").trim()
        : "";
    if (!kw) continue;

    const clicksVal =
      colIndex.clicks !== undefined ? number(line[colIndex.clicks] as string) : 0;
    const impressionsVal =
      colIndex.impressions !== undefined
        ? number(line[colIndex.impressions] as string)
        : 0;

    let ctrVal =
      colIndex.ctr !== undefined ? number(line[colIndex.ctr] as string) : 0;
    if (ctrVal === 0 && impressionsVal > 0 && clicksVal > 0) {
      ctrVal = parseFloat(((clicksVal / impressionsVal) * 100).toFixed(2));
    }

    const positionVal =
      colIndex.position !== undefined
        ? number(line[colIndex.position] as string)
        : 0;

    const siteVal =
      colIndex.site !== undefined
        ? String(line[colIndex.site] ?? "").trim()
        : "";

    const dateVal =
      colIndex.date !== undefined
        ? String(line[colIndex.date] ?? "").trim()
        : "";

    const finalDate = dateVal || defaultDate || new Date().toISOString().slice(0, 10);
    const finalSite = siteVal || defaultSite || "default-site";

    parsedRows.push({
      date: finalDate,
      site: finalSite,
      keyword: kw,
      clicks: clicksVal,
      impressions: impressionsVal,
      ctr: ctrVal,
      position: positionVal,
      Date: finalDate,
      Site: finalSite,
      Keyword: kw,
      Clicks: clicksVal,
      Impressions: impressionsVal,
      CTR: ctrVal,
      Position: positionVal,
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
  const [message, setMessage] = useState(
    "Select a spreadsheet (.xlsx, .xls, .csv). Site and Date are filled automatically if absent."
  );
  const [loading, setLoading] = useState(false);

  // สถานะสำหรับ Modal และ Data ในการแก้ไขข้อมูล
  const [editingRow, setEditingRow] = useState<SeoRow | null>(null);

  const [page, setPage] = useState(1);
  const pageSize = 10;

  const load = async () => {
    try {
      const response = await fetch("/api/seo-data", { cache: "no-store" });
      const data = await response.json();
      if (response.ok) {
        setSaved(Array.isArray(data) ? data : []);
      } else {
        console.error("Failed to load SEO data:", data);
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
      const rows = parseSheet(firstSheet, site, date);

      if (!rows.length) {
        throw new Error("ไม่พบแถวข้อมูลที่สามารถนำเข้าได้ในไฟล์นี้");
      }

      setPreview(rows);
      setFileName(file.name);
      setMessage(
        `พร้อมนำเข้า ${rows.length} แถวจากไฟล์ "${file.name}" กรุณาตรวจสอบและกด "Import data"`
      );
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

    const payload = { rows: preview };

    try {
      const response = await fetch("/api/seo-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "เกิดข้อผิดพลาดในการนำเข้าข้อมูล");
        return;
      }

      setPreview([]);
      setPage(1);
      setMessage(`นำเข้าข้อมูลสำเร็จแล้วทั้งหมด ${data.imported} รายการ`);
      await load();
    } catch (error) {
      console.error(error);
      setMessage("ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  }

  /**
   * ฟังก์ชัน handleDeleteRow: ส่ง Request ลบรายการแถวตาม _id
   */
  async function handleDeleteRow(id?: string) {
    if (!id) return;
    if (!confirm("คุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้?")) return;

    try {
      const response = await fetch("/api/seo-data", {
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

  /**
   * ฟังก์ชัน handleSaveUpdate: ส่ง Request แก้ไขข้อมูลแถวผ่าน PATCH
   */
  async function handleSaveUpdate() {
    if (!editingRow || !editingRow._id) return;

    try {
      const response = await fetch("/api/seo-data", {
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
  const columns = ["Date", "Site", "Keyword", "Clicks", "Impressions", "CTR", "Position", "Actions"];
  const sites = useMemo(
    () => new Set(saved.map((row) => row.site || (row as unknown as SheetRow).Site || "")).size,
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
                SEO performance
              </p>
              <h1 className="mt-3 text-4xl font-semibold">SEO data center</h1>
            </div>
            <Link
              href="/dashboard"
              className="text-sm underline underline-offset-4"
            >
              Back to dashboard
            </Link>
          </div>

          <section className="grid gap-4 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:grid-cols-2">
            <label className="text-sm font-medium">
              Default website
              <input
                value={site}
                onChange={(event) => setSite(event.target.value)}
                placeholder="zmi.co.th"
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <label className="text-sm font-medium">
              Default date
              <input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 font-normal dark:border-zinc-600 dark:bg-zinc-800"
              />
            </label>
            <div className="sm:col-span-2 rounded-xl border border-dashed border-zinc-400 p-7 text-center">
              <p className="font-semibold">Upload SEO spreadsheet</p>
              <p className="mt-1 text-sm text-zinc-500">
                Needs Keyword / Query. Other fields are auto-mapped and Site/Date fill from above.
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
                    {preview.slice(0, 30).map((row, index) => (
                      <tr
                        key={index}
                        className="border-t border-zinc-200 dark:border-zinc-700"
                      >
                        <td className="px-4 py-3">{String(row.date || row.Date || "-")}</td>
                        <td className="px-4 py-3">{String(row.site || row.Site || "-")}</td>
                        <td className="px-4 py-3">{String(row.keyword || row.Keyword || "-")}</td>
                        <td className="px-4 py-3">
                          {number(row.clicks ?? row.Clicks).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {number(row.impressions ?? row.Impressions).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {number(row.ctr ?? row.CTR).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3">
                          {number(row.position ?? row.Position).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <section className="mt-7 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex justify-between p-5">
              <h2 className="font-semibold">Saved keyword data</h2>
              <span className="text-sm text-zinc-500">
                {saved.length} rows · {sites} sites
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
                      <td
                        colSpan={columns.length}
                        className="px-4 py-8 text-center text-zinc-500"
                      >
                        ยังไม่มีข้อมูล SEO ในระบบ (กรุณาอัปโหลดไฟล์ Excel หรือ CSV ด้านบน)
                      </td>
                    </tr>
                  ) : (
                    shown.map((row, idx) => {
                      const rowDate = row.date || (row as unknown as SheetRow).Date;
                      const rowSite = row.site || (row as unknown as SheetRow).Site;
                      const rowKeyword = row.keyword || (row as unknown as SheetRow).Keyword;
                      const rowClicks = row.clicks ?? (row as unknown as SheetRow).Clicks;
                      const rowImpressions =
                        row.impressions ?? (row as unknown as SheetRow).Impressions;
                      const rowCtr = row.ctr ?? (row as unknown as SheetRow).CTR;
                      const rowPosition =
                        row.position ?? (row as unknown as SheetRow).Position;

                      return (
                        <tr
                          key={row._id || idx}
                          className="border-t border-zinc-200 dark:border-zinc-700"
                        >
                          <td className="px-4 py-3">
                            {rowDate ? String(rowDate).slice(0, 10) : "-"}
                          </td>
                          <td className="px-4 py-3">{String(rowSite || "-")}</td>
                          <td className="px-4 py-3">{String(rowKeyword || "-")}</td>
                          <td className="px-4 py-3">{number(rowClicks).toLocaleString()}</td>
                          <td className="px-4 py-3">
                            {number(rowImpressions).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">{number(rowCtr).toFixed(2)}%</td>
                          <td className="px-4 py-3">{number(rowPosition).toFixed(1)}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingRow(row)}
                                className="rounded px-2.5 py-1 text-xs font-medium text-blue-600 border border-blue-200 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-950/50"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteRow(row._id)}
                                className="rounded px-2.5 py-1 text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
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

      {/* Modal ป๊อบอัพสำหรับแก้ไขข้อมูล */}
      {editingRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h3 className="text-lg font-semibold border-b pb-3 dark:border-zinc-700">
              Edit SEO Record
            </h3>
            <div className="mt-4 grid gap-3 text-sm">
              <label>
                Date
                <input
                  type="date"
                  value={
                    editingRow.date
                      ? new Date(editingRow.date).toISOString().slice(0, 10)
                      : ""
                  }
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, date: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </label>
              <label>
                Site
                {/*  เปลี่ยน input  ไป  selectbox   
                <input
                  type="text"
                  value={editingRow.site || ""}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, site: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                /> */}
                <select
                  value={editingRow.site || ""}
                  onChange={(e) =>
                    setEditingRow({
                      ...editingRow, site: e.target.value  })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800">
                  <option value="zmithailland">Zmithailland</option>
                  <option value="thaisuperphone" >Thaisuperphone</option>
                  <option value="imilabthailand" >Imilabthailand</option>
                   <option value="isuper">Isuper</option>   
                </select>
              </label>
              <label>
                Keyword
                <input
                  type="text"
                  value={editingRow.keyword || ""}
                  onChange={(e) =>
                    setEditingRow({ ...editingRow, keyword: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  Clicks
                  <input
                    type="number"
                    value={editingRow.clicks ?? 0}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        clicks: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label>
                  Impressions
                  <input
                    type="number"
                    value={editingRow.impressions ?? 0}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        impressions: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label>
                  CTR (%)
                  <input
                    type="number"
                    step="0.01"
                    value={editingRow.ctr ?? 0}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        ctr: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
                <label>
                  Position
                  <input
                    type="number"
                    step="0.1"
                    value={editingRow.position ?? 0}
                    onChange={(e) =>
                      setEditingRow({
                        ...editingRow,
                        position: Number(e.target.value),
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-800"
                  />
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingRow(null)}
                className="rounded-lg px-4 py-2 text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"
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