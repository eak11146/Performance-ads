"use client";
import { ChevronLeft, ChevronRight, Eye, MessageCircle, MousePointerClick, Sparkles, WalletCards } from "lucide-react";

function formatCompact(value: number) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString("th-TH");
}

export function AdsHeroCarousel({ carouselItems, activeAd, carouselIndex, setCarouselIndex }: any) {
  return (
    <section className="mt-8 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-5 py-4 dark:border-zinc-700">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#c8102e]">Ads Hero / KOL Performance</p>
          <h2 className="mt-1 text-xl font-semibold">Best Performing Ads by Brand / Product</h2>
        </div>
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <Sparkles size={14} className="text-amber-500" />
          <span>{carouselItems.length} Creator records (Unique)</span>
        </div>
      </div>
      <div className="relative p-6 sm:p-9">
        <button onClick={() => setCarouselIndex((i: number) => (i - 1 + carouselItems.length) % Math.max(carouselItems.length, 1))} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-white p-2.5 shadow-md"><ChevronLeft size={20} /></button>
        <button onClick={() => setCarouselIndex((i: number) => (i + 1) % Math.max(carouselItems.length, 1))} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full border bg-white p-2.5 shadow-md"><ChevronRight size={20} /></button>

        <div className="grid gap-7 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-md bg-[#c8102e] px-3 py-1 text-xs font-bold text-white">KOL / AD CREATIVE</span>
              <span className="text-lg font-bold text-[#c8102e]">{activeAd.grade} ★ {activeAd.rating}</span>
              {activeAd.matchedCount > 0 && <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">เชื่อมโยง {activeAd.matchedCount} แคมเปญ</span>}
            </div>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60"><dt className="text-xs text-zinc-500">Brand</dt><dd className="mt-1 font-semibold">{activeAd.brand}</dd></div>
              <div className="rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800/60"><dt className="text-xs text-zinc-500">Product</dt><dd className="mt-1 font-semibold">{activeAd.product}</dd></div>
              <div className="rounded-lg bg-zinc-50 p-3 sm:col-span-2 dark:bg-zinc-800/60"><dt className="text-xs text-zinc-500">Campaign</dt><dd className="mt-1 font-semibold text-[#c8102e]">{activeAd.campaign}</dd></div>
              <div className="rounded-lg bg-zinc-50 p-3 sm:col-span-2 dark:bg-zinc-800/60"><dt className="text-xs text-zinc-500">Creator</dt><dd className="mt-1 font-semibold">{activeAd.creator}</dd></div>
            </dl>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w- lg:grid-cols-2">
            <div className="rounded-xl border bg-zinc-50 p-4"><div className="flex justify-between"><span className="text-xs text-zinc-500">Impressions</span><Eye size={18} className="text-[#c8102e]" /></div><p className="mt-2 text-2xl font-bold">{formatCompact(activeAd.impressions)}</p></div>
            <div className="rounded-xl border bg-zinc-50 p-4"><div className="flex justify-between"><span className="text-xs text-zinc-500">Clicks</span><MousePointerClick size={18} className="text-emerald-600" /></div><p className="mt-2 text-2xl font-bold">{formatCompact(activeAd.clicks)}</p><p className="text-xs text-zinc-400">CTR {activeAd.ctr.toFixed(2)}%</p></div>
            <div className="rounded-xl border bg-zinc-50 p-4"><div className="flex justify-between"><span className="text-xs text-zinc-500">Engagement</span><MessageCircle size={18} className="text-orange-500" /></div><p className="mt-2 text-2xl font-bold">{formatCompact(activeAd.engagement)}</p></div>
            <div className="rounded-xl border bg-zinc-50 p-4"><div className="flex justify-between"><span className="text-xs text-zinc-500">CPV</span><WalletCards size={18} /></div><p className="mt-2 text-2xl font-bold">฿{activeAd.cpv.toFixed(2)}</p></div>
          </div>
        </div>
        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {carouselItems.map((ad: any, index: number) => (
            <button key={ad.id} onClick={() => setCarouselIndex(index)} className={`rounded-full border px-3 py-1.5 text-xs font-medium ${index === carouselIndex? "border-[#c8102e] bg-[#c8102e] text-white" : "border-zinc-300 bg-white text-zinc-600"}`}>{ad.creator} - {ad.campaign.slice(0,15)}</button>
          ))}
        </div>
      </div>
    </section>
  );
}