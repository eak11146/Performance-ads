// src/components/home/month-filter.tsx
export function MonthFilter({ months, selectedMonth, setSelectedMonth, count }: any) {
  return (
    <section className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border bg-white p-4 shadow-sm">
      <span className="text-sm font-semibold">Month</span>
      <button onClick={() => setSelectedMonth("all")} className={`rounded-lg px-4 py-2 text-sm ${selectedMonth==="all"?"bg-[#c8102e] text-white":"border"}`}>All Months</button>
      {months.map((m: string) => (
        <button key={m} onClick={() => setSelectedMonth(m)} className={`rounded-lg px-4 py-2 text-sm ${selectedMonth===m?"bg-[#c8102e] text-white":"border"}`}>
          {m}
        </button>
      ))}
      <span className="ml-auto text-xs text-zinc-500">{count} campaigns from Google Ads · {selectedMonth}</span>
    </section>
  );
}