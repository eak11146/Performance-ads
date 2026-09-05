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
            key !== "_id" &&
            key !== "createdAt" &&
            key !== "updatedAt" &&
            !/^__empty/i.test(key) &&
            rows.some((item) => item[key]?.trim()),
        ),
      ),
    ),
  );
}

function isProductColumn(column: string) {
  return column === "สินค้า" || column.toLowerCase() === "product";
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
    const year = yearNumber < 100 ? (yearNumber >= 50 ? yearNumber + 1957 : yearNumber + 2000) : yearNumber >= 2400 ? yearNumber - 543 : yearNumber;
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

function normalizedHeader(value: string) {
  return value.toLowerCase().replace(/[\s_\-./]/g, "");
}

function parseReportSheet(sheet: XLSX.WorkSheet) {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "", raw: false });
  const headerIndex = matrix.findIndex((row) => {
    const headers = row.map((cell) => normalizedHeader(String(cell).trim()));
    return headers.includes("date") && (headers.includes("products") || headers.includes("product")) && (headers.includes("creator") || headers.includes("kol"));
  });
  if (headerIndex < 0) throw new Error("ไม่พบ header date, products และ Creator");

  const headers = matrix[headerIndex].map((cell) => String(cell).trim());
  return matrix.slice(headerIndex + 1)
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, String(row[index] ?? "").trim()]).filter(([header, value]) => header !== "" && value !== "")))
    .filter((row) => Object.keys(row).length > 0)
    .filter((row) => normalizedHeader(String(row.date || "")) !== "date");
}

export default function AdsReportPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [groupColumn, setGroupColumn] = useState("");
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState(
    "Upload Excel เพื่อเริ่มวิเคราะห์รายงาน Ads",
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<ReportRow>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth")
        .then(async (authResponse) => {
          if (!authResponse.ok) {
            router.replace("/login");
            return;
          }
          setIsAuthorized(true);
          const response = await fetch("/api/ad-reports");
          const data = await response.json();
          if (response.ok) {
            setReports(data);
            const loadedColumns = getColumns(data);
            setGroupColumn(
              loadedColumns.find(isProductColumn) || loadedColumns[0] || "",
            );
          }
        })
        .catch(() => setMessage("ไม่สามารถโหลดรายงานได้"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = parseReportSheet(sheet);
      setRows(parsed);
      const importedColumns = getColumns(parsed);
      setGroupColumn(
        importedColumns.find(isProductColumn) || importedColumns[0] || "",
      );
      setFileName(file.name);
      setMessage(
        `${parsed.length} แถวพร้อม preview แล้ว ตรวจสอบก่อนนำเข้า database`,
      );
    } catch {
      setRows([]);
      setMessage("ไม่สามารถอ่านไฟล์นี้ได้ กรุณาใช้ .xlsx, .xls หรือ .csv");
    }
  }

  async function importRows() {
    const response = await fetch("/api/ad-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rows }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "นำเข้าไม่สำเร็จ");
      return;
    }
    const refreshed = await fetch("/api/ad-reports").then((result) =>
      result.json(),
    );
    setReports(refreshed);
    setRows([]);
    setMessage(`นำเข้า ${data.imported} แถวสำเร็จ และแปลงคอลัมน์ date เป็น Date แล้ว`);
  }

  function startEditing(report: ReportRow) {
    setEditingId(report._id || null);
    setEditingRow({ ...report });
  }

  async function saveEdit() {
    if (!editingId) return;
    const response = await fetch("/api/ad-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editingRow, id: editingId }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "แก้ไขไม่สำเร็จ");
      return;
    }
    setReports((current) =>
      current.map((report) => (report._id === editingId ? data : report)),
    );
    setEditingId(null);
    setMessage("แก้ไขรายงานสำเร็จ");
  }

  async function deleteSelected(ids: string[], confirmMessage: string) {
    const validIds = ids.filter(Boolean);
    if (!validIds.length || !window.confirm(confirmMessage)) return;
    const response = await fetch("/api/ad-reports", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: validIds }),
    });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "ลบไม่สำเร็จ");
      return;
    }
    setReports((current) =>
      current.filter((report) => !validIds.includes(report._id || "")),
    );
    setSelectedIds((current) => current.filter((id) => !validIds.includes(id)));
    setMessage(`ลบ ${data.deleted} แถวสำเร็จ`);
  }

  const columns = getColumns([...reports, ...rows]);
  const savedIds = reports
    .map((report) => report._id)
    .filter((id): id is string => Boolean(id));
  const groupedReports = reports.reduce<Record<string, ReportRow[]>>(
    (result, report) => {
      const group = report[groupColumn] || "ไม่ระบุ";
      result[group] = result[group] || [];
      result[group].push(report);
      return result;
    },
    {},
  );
  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((selectedId) => selectedId !== id)
        : [...current, id],
    );
  }

  function renderValue(report: ReportRow, column: string) {
    if (editingId !== report._id) {
      if (isDateColumn(column) && toDateInputValue(report[column] || "")) {
        const dateValue = toDateInputValue(report[column] || "");
        return <time dateTime={dateValue}>{formatCellValue(report[column] || "", column)}</time>;
      }
      return formatCellValue(report[column] || "", column) || "-";
    }
    if (isDateColumn(column)) {
      return (
        <input
          className="rounded-lg border border-orange-300 px-2 py-1 text-sm"
          type="date"
          value={toDateInputValue(editingRow[column] || "")}
          onChange={(event) => setEditingRow({ ...editingRow, [column]: event.target.value })}
        />
      );
    }
    return (
      <textarea
        className="min-h-20 w-full rounded-lg border border-orange-300 px-2 py-1 text-sm"
        value={editingRow[column] || ""}
        onChange={(event) =>
          setEditingRow({ ...editingRow, [column]: event.target.value })
        }
      />
    );
  }

  if (!isAuthorized) {
    return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] text-sm text-slate-500 dark:text-zinc-400">Checking access...</main>;
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--background)] text-[var(--foreground)]">
      <TopMenu />
      <main className="px-4 py-8 sm:px-5 sm:py-12 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-300 pb-8 sm:mb-10 sm:flex-row sm:items-end dark:border-zinc-700">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">
              fieldnotes<span className="text-orange-600">.</span>
            </Link>
            <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
              Google Ads intelligence
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Ads report
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base dark:text-zinc-400">
              อัปโหลด Excel แล้วระบบจะใช้ column จากไฟล์จริงทั้งหมด โดยไม่ fix
              schema
            </p>
          </div>
          <Link
            href="/dashboard"
            className="text-sm font-medium text-zinc-600 underline underline-offset-4 dark:text-zinc-400"
          >
            Back to dashboard
          </Link>
        </div>
        <section className="rounded-2xl border border-dashed border-zinc-400 bg-white p-6 text-center shadow-sm dark:border-zinc-600 dark:bg-zinc-900 sm:p-8">
          <p className="text-lg font-semibold">Upload Google Ads Excel</p>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
            ระบบอ่าน header ทุกชื่ออัตโนมัติ และรองรับ column ใหม่ในอนาคต
          </p>
          <label className="mt-6 inline-flex cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-orange-700">
            Choose file
            <input
              className="sr-only"
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFile}
            />
          </label>
          {fileName && (
            <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">{fileName}</p>
          )}
          <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400" role="status">
            {message}
          </p>
        </section>
        {rows.length > 0 && (
          <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
              <h2 className="font-semibold">
                Auto-arranged preview ({rows.length})
              </h2>
              <button
                onClick={importRows}
                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700"
              >
                Import to database
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-wider text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  <tr>
                    {getColumns(rows).map((column) => (
                      <th className="px-5 py-3" key={column}>
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr className="border-t border-zinc-200 dark:border-zinc-700" key={index}>
                      {getColumns(rows).map((column) => (
                        <td
                          className="max-w-56 px-5 py-4 align-top text-zinc-700 dark:text-zinc-300"
                          key={column}
                        >
                            {formatCellValue(row[column], column)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <section
          className="mt-8 space-y-6 sm:mt-10"
          aria-labelledby="saved-reports-heading"
        >
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">
                Database records
              </p>
              <h2
                id="saved-reports-heading"
                className="mt-2 text-2xl font-semibold"
              >
                Reports grouped by column
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-zinc-600 dark:text-zinc-300">
                จัดกลุ่มด้วย
                <select
                  className="ml-2 max-w-[180px] rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800"
                  value={groupColumn}
                  onChange={(event) => setGroupColumn(event.target.value)}
                >
                  <option value="">ไม่จัดกลุ่ม</option>
                  {columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </label>
              {selectedIds.length > 0 && (
                <button
                  onClick={() =>
                    deleteSelected(
                      selectedIds,
                      `ต้องการลบ ${selectedIds.length} แถวที่เลือกหรือไม่?`,
                    )
                  }
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                >
                  ลบที่เลือก ({selectedIds.length})
                </button>
              )}
              <button
                onClick={() =>
                  deleteSelected(savedIds, "ต้องการลบข้อมูลทั้งหมดหรือไม่?")
                }
                disabled={!savedIds.length}
                className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ลบทั้งหมด
              </button>
            </div>
          </div>
          {Object.entries(groupedReports).map(([group, groupReports]) => (
            <div
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900"
              key={group}
            >
              <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-5 py-4 dark:border-zinc-700 dark:bg-zinc-800 sm:px-6">
                <h3 className="font-semibold">{group}</h3>
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  {groupReports.length} rows
                </span>
              </div>
              <div className="hidden overflow-x-auto md:block">
                <table className="w-full min-w-[1500px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    <tr>
                      <th className="w-12 px-5 py-3">
                        <input
                          type="checkbox"
                          checked={groupReports.every(
                            (report) =>
                              report._id && selectedIds.includes(report._id),
                          )}
                          onChange={() => {
                            const groupIds = groupReports
                              .map((report) => report._id)
                              .filter((id): id is string => Boolean(id));
                            setSelectedIds((current) =>
                              groupIds.every((id) => current.includes(id))
                                ? current.filter((id) => !groupIds.includes(id))
                                : Array.from(
                                    new Set([...current, ...groupIds]),
                                  ),
                            );
                          }}
                          aria-label={`เลือกทั้งหมดในกลุ่ม ${group}`}
                        />
                      </th>
                      {columns.map((column) => (
                        <th className="px-5 py-3" key={column}>
                          {column}
                        </th>
                      ))}
                      <th className="px-5 py-3">จัดการ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupReports.map((report, index) => (
                      <tr
                        className="border-t border-zinc-200 dark:border-zinc-700"
                        key={`${group}-${report._id || index}`}
                      >
                        <td className="px-5 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={Boolean(
                              report._id && selectedIds.includes(report._id),
                            )}
                            onChange={() =>
                              report._id && toggleSelected(report._id)
                            }
                            aria-label={`เลือก ${report[groupColumn] || "รายงาน"}`}
                          />
                        </td>
                        {columns.map((column) => (
                          <td
                            className="max-w-56 px-5 py-4 align-top text-zinc-700 dark:text-zinc-300"
                            key={column}
                          >
                            {renderValue(report, column)}
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-5 py-4 align-top">
                          <div className="flex gap-2">
                            {editingId === report._id ? (
                              <>
                                <button
                                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
                                  onClick={saveEdit}
                                >
                                  บันทึก
                                </button>
                                <button
                                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:text-zinc-200"
                                  onClick={() => setEditingId(null)}
                                >
                                  ยกเลิก
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:text-zinc-200"
                                  onClick={() => startEditing(report)}
                                >
                                  แก้ไข
                                </button>
                                <button
                                  className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700"
                                  onClick={() =>
                                    report._id &&
                                    deleteSelected(
                                      [report._id],
                                      "ต้องการลบรายงานแถวนี้หรือไม่?",
                                    )
                                  }
                                >
                                  ลบ
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="space-y-3 p-4 md:hidden">
                {groupReports.map((report, index) => (
                  <article
                    className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-700"
                    key={`${group}-mobile-${report._id || index}`}
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <label className="flex items-center gap-3 text-sm font-semibold">
                        <input
                          type="checkbox"
                          checked={Boolean(
                            report._id && selectedIds.includes(report._id),
                          )}
                          onChange={() =>
                            report._id && toggleSelected(report._id)
                          }
                        />
                        เลือกแถวนี้
                      </label>
                      <div className="flex gap-2">
                        {editingId === report._id ? (
                          <>
                            <button
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-medium text-white"
                              onClick={saveEdit}
                            >
                              บันทึก
                            </button>
                            <button
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:text-zinc-200"
                              onClick={() => setEditingId(null)}
                            >
                              ยกเลิก
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              className="rounded-lg border border-zinc-300 px-3 py-2 text-xs dark:border-zinc-600 dark:text-zinc-200"
                              onClick={() => startEditing(report)}
                            >
                              แก้ไข
                            </button>
                            <button
                              className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-700"
                              onClick={() =>
                                report._id &&
                                deleteSelected(
                                  [report._id],
                                  "ต้องการลบรายงานแถวนี้หรือไม่?",
                                )
                              }
                            >
                              ลบ
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                    <dl className="grid gap-3">
                      {columns.map((column) => (
                        <div
                          className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-700"
                          key={column}
                        >
                          <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                            {column}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap break-words text-sm text-zinc-700 dark:text-zinc-300">
                            {renderValue(report, column)}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                ))}
              </div>
            </div>
          ))}
          {!reports.length && (
            <div className="rounded-2xl border border-zinc-200 bg-white px-6 py-10 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              ยังไม่มีข้อมูลรายงานใน database
            </div>
          )}
        </section>
      </div>
      </main>
    </div>
  );
}
