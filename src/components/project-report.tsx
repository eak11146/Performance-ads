"use client";

import { useEffect, useState } from "react";

type Project = { _id: string; status: string };
type ChartMode = "bar" | "pie";

const colors = ["#ea580c", "#0284c7", "#059669", "#64748b", "#ca8a04"];

export default function ProjectReport() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [mode, setMode] = useState<ChartMode>("bar");
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/projects")
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || "Unable to load report");
          setProjects(data);
        })
        .catch((loadError: Error) => setError(loadError.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const summary = projects.reduce<Record<string, number>>((result, project) => {
    result[project.status] = (result[project.status] || 0) + 1;
    return result;
  }, {});
  const entries = Object.entries(summary);
  const total = projects.length || 1;
  const pieBackground = entries.length
    ? `conic-gradient(${entries.map(([, ], index) => `${colors[index % colors.length]} ${(entries.slice(0, index).reduce((sum, [, value]) => sum + value, 0) / total) * 360}deg ${((entries.slice(0, index + 1).reduce((sum, [, value]) => sum + value, 0)) / total) * 360}deg`).join(", ")})`
    : "#e2e8f0";

  return (
    <section className="mt-12" aria-labelledby="report-heading">
      <div className="mb-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Reports</p><h2 id="report-heading" className="mt-2 text-2xl font-semibold tracking-tight">Project status report</h2></div>
        <div className="flex rounded-full border border-slate-300 bg-white p-1 text-sm" aria-label="Chart type">
          <button className={`rounded-full px-4 py-2 ${mode === "bar" ? "bg-slate-950 text-white" : "text-slate-600"}`} onClick={() => setMode("bar")}>Bar chart</button>
          <button className={`rounded-full px-4 py-2 ${mode === "pie" ? "bg-slate-950 text-white" : "text-slate-600"}`} onClick={() => setMode("pie")}>Pie chart</button>
        </div>
      </div>
      <div className="grid gap-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-[220px_1fr] md:items-center">
        {mode === "pie" ? <div className="mx-auto h-48 w-48 rounded-full" style={{ background: pieBackground }} aria-label="Project status pie chart" /> : <div className="flex h-48 items-end justify-center gap-5 border-b border-l border-slate-200 px-5 pb-0">{entries.map(([status, count], index) => <div key={status} className="flex h-full flex-col items-center justify-end gap-2"><span className="text-xs font-semibold text-slate-600">{count}</span><div className="w-12 rounded-t-lg" style={{ height: `${Math.max((count / total) * 100, 8)}%`, backgroundColor: colors[index % colors.length] }} /><span className="max-w-20 text-center text-xs text-slate-500">{status}</span></div>)}</div>}
        <div className="space-y-3">{error && <p className="text-sm text-red-600" role="alert">{error}</p>}{entries.map(([status, count], index) => <div key={status} className="flex items-center justify-between gap-4 text-sm"><span className="flex items-center gap-2 text-slate-600"><span className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />{status}</span><span className="font-semibold">{count} project{count === 1 ? "" : "s"}</span></div>)}{!entries.length && !error && <p className="text-sm text-slate-500">No project data available.</p>}</div>
      </div>
    </section>
  );
}
