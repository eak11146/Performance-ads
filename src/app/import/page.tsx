"use client";

import { ChangeEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import TopMenu from "@/components/top-menu";

type ImportedRow = Record<string, string | number>;

function normalizeKey(key: string) {
  return key.trim();
}

export default function ImportPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [rows, setRows] = useState<ImportedRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [message, setMessage] = useState("Choose an Excel file to preview its data.");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth").then((response) => {
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        setIsAuthorized(true);
      }).catch(() => router.replace("/login"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: "" });
      const normalized = parsed.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeKey(key), value])));
      setRows(normalized);
      setColumns(Array.from(new Set(normalized.flatMap((row) => Object.keys(row)))));
      setFileName(file.name);
      setMessage(`${normalized.length} rows loaded. Review the preview before importing.`);
    } catch {
      setRows([]);
      setColumns([]);
      setMessage("Unable to read this file. Please choose a valid Excel or CSV file.");
    }
  }

  async function importRows() {
    const response = await fetch("/api/ad-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rows }) });
    const data = await response.json();
    if (!response.ok) {
      setMessage(data.error || "Unable to import report rows.");
      return;
    }
    setMessage(`${data.imported} rows imported into Performance Reporting.`);
    setRows([]);
    setColumns([]);
  }

  if (!isAuthorized) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-slate-500">Checking access...</main>;
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-slate-950">
      <TopMenu />
      <main className="px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-4 border-b border-slate-300 pb-8 sm:flex-row sm:items-end"><div><Link href="/" className="text-lg font-semibold tracking-tight">fieldnotes<span className="text-orange-600">.</span></Link><p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Data import</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Import Excel data</h1><p className="mt-3 text-slate-600">Upload a spreadsheet and turn its first sheet into an arranged table automatically.</p></div><Link href="/dashboard" className="text-sm font-medium text-slate-600 underline underline-offset-4">Back to dashboard</Link></div>
        <section className="rounded-2xl border border-dashed border-slate-400 bg-white p-8 text-center shadow-sm"><p className="text-lg font-semibold">Upload spreadsheet</p><p className="mt-2 text-sm text-slate-500">Supported: .xlsx, .xls, .csv</p><label className="mt-6 inline-flex cursor-pointer rounded-full bg-slate-950 px-5 py-3 text-sm font-medium text-white hover:bg-orange-700">Choose file<input className="sr-only" type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} /></label>{fileName && <p className="mt-4 text-sm text-slate-600">{fileName}</p>}<p className="mt-4 text-sm text-slate-500" role="status">{message}</p></section>
        {rows.length > 0 && <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h2 className="font-semibold">Auto-arranged preview</h2><button onClick={importRows} className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700">Import {rows.length} rows</button></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr>{columns.map((column) => <th className="px-6 py-3" key={column}>{column.replace(/_/g, " ")}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr className="border-t border-slate-200" key={index}>{columns.map((column) => <td className="px-6 py-4 text-slate-700" key={column}>{String(row[column] ?? "")}</td>)}</tr>)}</tbody></table></div></section>}
      </div>
      </main>
    </div>
  );
}
