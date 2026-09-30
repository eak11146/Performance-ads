"use client";

import {
  Award,
  Flame,
  Layers,
  ListTodo,
  Sparkles,
  Target,
  TrendingDown,
} from "lucide-react";

type RetentionPoint = { x: number; y: number; val: number; label: string };

type Props = {
  activeAd: any;
  hookLines: string[];
  adsRoles: string[];
  retentionChartData: {
    areaPath: string;
    linePath: string;
    points: RetentionPoint[];
  };
  dropOffs: {
    items: { from: string; to: string; delta: number; drop?: number }[];
    maxDrop: { from: string; to: string; delta: number; drop?: number };
  };
  period: number;
  error: string;
};

export function ExecutiveInsights({
  activeAd,
  hookLines,
  adsRoles,
  retentionChartData,
  dropOffs,
  period,
  error,
}: Props) {
  return (
    <section className="mt-8 grid gap-6 lg:grid-cols-2">
      {/* Card 1: Performance Highlights */}
      <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                Executive Summary
              </p>
              <h2 className="mt-1 text-xl font-bold">Performance Highlights</h2>
            </div>
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              {activeAd?.creator || "-"}
            </span>
          </div>

          <div className="mt-5 space-y-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <Target size={15} className="text-[#c8102e]" />
                <span>Hook / Selling Point</span>
              </div>
              <div className="mt-2.5 space-y-2">
                {hookLines.map((line: string, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 rounded-lg bg-zinc-50/80 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#c8102e]" />
                    <span className="font-medium leading-relaxed">{line}</span>
                  </div>
                ))}
              </div>
            </div>

            {adsRoles && adsRoles.length > 0 && (
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <Layers size={15} className="text-indigo-600 dark:text-indigo-400" />
                  <span>Ads Role</span>
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {adsRoles.map((role: string, idx: number) => (
                    <span
                      key={idx}
                      className="rounded-lg border border-indigo-200 bg-indigo-50/70 px-3 py-1 text-xs font-semibold text-indigo-700 dark:border-indigo-800/80 dark:bg-indigo-950/40 dark:text-indigo-300"
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {activeAd?.winningMessage && (
              <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  <Award size={15} className="text-amber-500" />
                  <span>Winning Message</span>
                </div>
                <div className="mt-2.5 rounded-xl border-l-4 border-amber-500 bg-amber-50/50 p-3.5 text-sm font-medium leading-relaxed text-zinc-800 dark:border-amber-400 dark:bg-amber-950/20 dark:text-zinc-200">
                  {activeAd.winningMessage}
                </div>
              </div>
            )}

            <div className="border-t border-zinc-100 pt-4 dark:border-zinc-800">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                <ListTodo size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span>Next Action</span>
              </div>
              <div className="mt-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-sm font-medium leading-relaxed text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950/20 dark:text-emerald-200">
                {activeAd?.action || "ยังไม่ได้ระบุ Action สำหรับ Creator นี้"}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
          <span>สินค้า: {activeAd?.product || "-"}</span>
          <span>แบรนด์: {activeAd?.brand || "-"}</span>
        </div>
      </div>

      {/* Card 2: Video Retention */}
      <div className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
        <div>
          <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">
                Video Retention & Drop-off
              </p>
              <h2 className="mt-1 text-xl font-bold">Executive Insights</h2>
            </div>
            <div className="flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-[#c8102e] dark:bg-red-950/40">
              <TrendingDown size={14} />
              <span>4-Point Trend</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800/80 dark:bg-zinc-800/30">
            <div className="mb-2 flex items-center justify-between px-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Video Retention Trend (25% → 100%)
              </span>
              <span className="text- font-medium text-zinc-400">
                {activeAd?.creator || ""}
              </span>
            </div>

            <div className="relative w-full">
              <svg viewBox="0 0 460 145" className="h-auto w-full overflow-visible" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="stockRetentionGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#c8102e" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#c8102e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <line x1="30" y1="35" x2="430" y2="35" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth={1} />
                <line x1="30" y1="75" x2="430" y2="75" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth={1} />
                <line x1="30" y1="115" x2="430" y2="115" stroke="currentColor" strokeDasharray="3 3" className="text-zinc-200 dark:text-zinc-800" strokeWidth={1} />
                <path d={retentionChartData.areaPath} fill="url(#stockRetentionGrad2)" />
                <path d={retentionChartData.linePath} fill="none" stroke="#c8102e" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                {retentionChartData.points.map((pt, idx) => (
                  <g key={idx}>
                    <circle cx={pt.x} cy={pt.y} r={8} fill="#c8102e" opacity={0.18} />
                    <circle cx={pt.x} cy={pt.y} r={4.5} fill="#ffffff" stroke="#c8102e" strokeWidth={2.5} />
                    <text x={pt.x} y={pt.y - 10} textAnchor="middle" className="fill-zinc-900 text- font-bold">
                      {pt.val.toFixed(2)}%
                    </text>
                    <text x={pt.x} y={140} textAnchor="middle" className="fill-zinc-400 text- font-semibold">
                      {pt.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Drop-off Analysis
              </span>
              <span className="text- text-zinc-400">percentage points</span>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-2.5">
              {dropOffs.items.map((item) => {
                const isHighest = item.from === dropOffs.maxDrop.from;
                return (
                  <div
                    key={`${item.from}-${item.to}`}
                    className={`rounded-xl p-2.5 text-center transition ${isHighest? "border border-[#c8102e]/40 bg-[#c8102e]/5 shadow-sm" : "border border-zinc-100 bg-zinc-50/70"}`}
                  >
                    <div className="flex items-center justify-center gap-1 text- font-medium text-zinc-500">
                      <span>{item.from} → {item.to}</span>
                      {isHighest && <Flame size={12} className="text-[#c8102e]" />}
                    </div>
                    <p className={`mt-1 text-sm font-bold ${isHighest? "text-[#c8102e]" : "text-zinc-700"}`}>
                      {item.delta > 0? `+${item.delta}` : item.delta} pp
                    </p>
                    {isHighest && (
                      <span className="mt-1 inline-block rounded bg-[#c8102e]/15 px-1.5 py-0.5 text- font-bold text-[#c8102e]">
                        Drop สูงสุด
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-2.5 flex items-center justify-between rounded-lg border border-[#c8102e]/25 bg-[#c8102e]/5 px-3 py-2 text-xs text-[#c8102e]">
              <span className="font-medium">
                Drop-off มากสุด: <strong>{dropOffs.maxDrop.from} → {dropOffs.maxDrop.to}</strong> ({dropOffs.maxDrop.delta} pp)
              </span>
              <Flame size={14} className="flex-shrink-0 text-[#c8102e]" />
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-zinc-200/80 bg-zinc-50/80 p-3.5 dark:border-zinc-800 dark:bg-zinc-800/50">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-amber-500" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                Performance Signal
              </span>
            </div>
            <p className="mt-2 text-xs font-medium leading-relaxed text-zinc-700 dark:text-zinc-300">
              {activeAd?.performanceSignal || "-"}
            </p>
          </div>
        </div>

        <div className="mt-4 border-t border-zinc-100 pt-3 text-xs text-zinc-400 dark:border-zinc-800">
          ช่วงข้อมูล: ล่าสุด {period} วัน · {error || "ข้อมูลพร้อมใช้งาน"}
        </div>
      </div>
    </section>
  );
}