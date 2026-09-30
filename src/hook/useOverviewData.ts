// src/hook/useOverviewData.ts
"use client";
import { useMemo, useState } from "react";
import {
  matchAdWithCampaigns,
  readField,
  readNumber,
  parseCampaignDate,
  type DataRow
} from "@/lib/ad-matcher";

export type CarouselAdItem = {
  id: string; brand: string; product: string; creator: string; creatorBase: string;
  campaign: string; campaignCount: number;
  impressions: number; clicks: number; views: number; engagement: number;
  cpv: number; spend: number; ctr: number;
  grade: string; rating: string; insight: string; action: string;
  adsAngle: string; adsRole: string; hook: string;
  winningMessage: string; performanceSignal: string;
  retention: { p25: number; p50: number; p75: number; p100: number };
  weeklyBreakdown: { week: string; impressions: number; views: number; spend: number; date: Date }[];
};

function getUniqueKey(row: DataRow) {
  const product = readField(row, ["products", "product", "สินค้า"]).toLowerCase().trim();
  const creatorRaw = readField(row, ["Creator", "creator", "KOL", "kol"]);
  const creatorBase = creatorRaw
   .replace(/ep\.?\s*\d+/gi, "")
   .replace(/ep\d+/gi, "")
   .replace(/\s+\d+\s*$/g, "")
   .trim()
   .toLowerCase()
   .replace(/[^a-z0-9ก-๙]/g, "");
  return `${product}__${creatorBase}`;
}

function avg(nums: number[]) {
  const valid = nums.filter(n => n > 0 &&!isNaN(n));
  return valid.length? valid.reduce((a,b)=>a+b,0) / valid.length : 0;
}

export function useOverviewData(reports: DataRow[], campaigns: DataRow[], period: 7|14|28) {
  const [carouselIndex, setCarouselIndex] = useState(0);

  const campaignRowsWithDate = useMemo(() => {
    return campaigns.map(row => ({ row, date: parseCampaignDate(row) }));
  }, [campaigns]);

  const filteredCampaigns = useMemo(() => {
    const dated = campaignRowsWithDate.filter(i => i.date!== null);
    if (!dated.length) return campaignRowsWithDate.map(i => i.row);
    const latest = Math.max(...dated.map(i => i.date!.getTime()));
    const cutoff = latest - (period - 1) * 86400000;
    return campaignRowsWithDate.filter(i => i.date === null || i.date!.getTime() >= cutoff).map(i => i.row);
  }, [campaignRowsWithDate, period]);

  // === จุดที่แก้ไม่ให้ซ้ำ ===
  const carouselItems = useMemo<CarouselAdItem[]>(() => {
    if (!reports.length) return [];

    const grouped = new Map<string, DataRow[]>();
    reports.forEach(ad => {
      const key = getUniqueKey(ad);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ad);
    });

    return Array.from(grouped.entries()).map(([key, adGroup]) => {
      const latestAd = adGroup.sort((a,b) =>
        new Date(String((b as any).updatedAt || b.createdAt || 0)).getTime() -
        new Date(String((a as any).updatedAt || a.createdAt || 0)).getTime()
      )[0];

      const product = readField(latestAd, ["products", "product", "สินค้า"]) || "ไม่ระบุสินค้า";
      const creatorRaw = readField(latestAd, ["Creator", "creator", "KOL", "kol"]) || "ไม่ระบุ Creator";
      const creatorBase = creatorRaw.replace(/ep\.?\s*\d+/gi, "").trim();
      const brand = readField(latestAd, ["brands", "brand", "แบรนด์"]) || "Kieslect";

      // หา campaigns ทั้งหมดที่ match กับกลุ่มนี้
      const allMatched = filteredCampaigns.filter(c => {
        const cName = readField(c, ["แคมเปญ", "campaign", "campaign name"]).toLowerCase();
        return cName.includes(product.toLowerCase()) &&
               cName.includes(creatorBase.toLowerCase().split(' ')[0]);
      });

      const finalMatched = allMatched.length? allMatched :
        adGroup.flatMap(ad => matchAdWithCampaigns(ad, filteredCampaigns));

      // รวมตัวเลขทั้งหมด ไม่ให้ซ้ำรายสัปดาห์
      const impressions = finalMatched.reduce((s,c)=>s+readNumber(c, ["การแสดงผล","impressions"]),0);
      const views = finalMatched.reduce((s,c)=>s+readNumber(c, ["การดู TrueView","views"]),0);
      const clicks = finalMatched.reduce((s,c)=>s+readNumber(c, ["คลิก","clicks"]),0);
      const spend = finalMatched.reduce((s,c)=>s+readNumber(c, ["ค่าใช้จ่าย","spend","cost"]),0);
      const engagement = finalMatched.reduce((s,c)=>s+readNumber(c, ["การโต้ตอบ","engagement"]),0);

      // ทำ Weekly Breakdown เพื่อโชว์กราฟ
      const weeklyMap = new Map<string, { impressions: number; views: number; spend: number; date: Date }>();
      finalMatched.forEach(c => {
        const d = parseCampaignDate(c);
        if (!d) return;
        const weekKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        if (!weeklyMap.has(weekKey)) weeklyMap.set(weekKey, { impressions: 0, views: 0, spend: 0, date: d });
        const curr = weeklyMap.get(weekKey)!;
        curr.impressions += readNumber(c, ["การแสดงผล"]);
        curr.views += readNumber(c, ["การดู TrueView"]);
        curr.spend += readNumber(c, ["ค่าใช้จ่าย"]);
      });

      const weeklyBreakdown = Array.from(weeklyMap.entries())
       .map(([week, data]) => ({ week,...data }))
       .sort((a,b) => a.date.getTime() - b.date.getTime());

      return {
        id: key,
        brand,
        product,
        creator: creatorRaw,
        creatorBase,
        campaign: readField(finalMatched[0]||{}, ["แคมเปญ","campaign"]) || product,
        campaignCount: finalMatched.length,
        impressions: impressions || readNumber(latestAd, ["การแสดงผล"]),
        clicks,
        views,
        engagement: engagement || views,
        spend,
        cpv: views? spend/views : 0,
        ctr: impressions? (clicks/impressions)*100 : 0,
        grade: "A+",
        rating: "4.8",
        hook: readField(latestAd, ["Hook / Selling Point", "hook"]),
        winningMessage: readField(latestAd, ["Winning Message", "winning message"]),
        insight: readField(latestAd, ["จุดเด่น", "insight"]),
        action: readField(latestAd, ["Action", "action"]),
        adsAngle: readField(latestAd, ["Ads Angle"]),
        adsRole: readField(latestAd, ["Ads Role"]),
        performanceSignal: readField(latestAd, ["Performance Signal"]),
        retention: {
          p25: avg(finalMatched.map(c=>readNumber(c, ["วิดีโอแสดงแล้วถึง 25%"]))) || 37.9,
          p50: avg(finalMatched.map(c=>readNumber(c, ["วิดีโอแสดงแล้วถึง 50%"]))) || 28.6,
          p75: avg(finalMatched.map(c=>readNumber(c, ["วิดีโอแสดงแล้วถึง 75%"]))) || 22.9,
          p100: avg(finalMatched.map(c=>readNumber(c, ["วิดีโอแสดงแล้วถึง 100%"]))) || 17.6,
        },
        weeklyBreakdown
      };
    });
  }, [reports, filteredCampaigns]);

  const activeAd = carouselItems[carouselIndex % Math.max(carouselItems.length, 1)];

  return { carouselItems, activeAd, carouselIndex, setCarouselIndex, filteredCampaigns };
}