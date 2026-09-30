import { Filter } from "lucide-react";

export function PeriodFilter({ period, setPeriod, setCarouselIndex, count }: {
  period: 7|14|28, setPeriod: any, setCarouselIndex: any, count: number
}) {
  return (
    <section className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <span className="flex items-center gap-2 text-sm font-semibold">
        <Filter size={16} className="text-[#c8102e]" /> Period
      </span>
      {([7, 14, 28] as const).map((days) => (
        <button key={days} onClick={() => { setPeriod(days); setCarouselIndex(0); }}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${period === days? "bg-[#c8102e] text-white shadow-sm" : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-800"}`}>
          {days} Days
        </button>
      ))}
      <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
        {count? `${count} campaigns from Google Ads` : "Demo data"} · latest {period} days
      </span>
    </section>
  );
}