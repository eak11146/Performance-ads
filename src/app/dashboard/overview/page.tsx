// src/app/dashboard/overview/page.tsx
import OverviewClient from "./overview-client";

export const dynamic = "force-dynamic";

async function fetchSafe<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return fallback;
    return (await res.json())?? fallback;
  } catch { return fallback; }
}

export default async function Page() {
  const [reports, campaigns, seoRaw, perfRaw] = await Promise.all([
    fetchSafe("/api/ad-reports", []),
    fetchSafe("/api/campaigns", []),
    fetchSafe("/api/seo-data", []),
    fetchSafe("/api/performance", []),
  ]);

  return <OverviewClient initialReports={reports} initialCampaigns={campaigns} initialSeoRaw={seoRaw} initialPerfRaw={perfRaw} />;
}