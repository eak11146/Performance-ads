// src/app/dashboard/overview/overview-client.tsx
"use client";

import { useOverviewData } from "@/hook/useOverviewData"; // <-- แก้ตรงนี้เป็น hook เอกพจน์

type Props = {
  initialReports: any[];
  initialCampaigns: any[];
  initialSeoRaw: any[];
  initialPerfRaw: any[];
};

export default function OverviewClient({ initialReports, initialCampaigns }: Props) {
  // ตอนนี้ไฟล์นี้จะไม่แดงแล้ว
  return <div>Test hook: {initialReports.length} reports</div>;
}