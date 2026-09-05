import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

type CampaignInput = Record<string, unknown>;

const numericFields = new Set([
  "งบประมาณ",
  "การแสดงผล",
  "การดู TrueView",
  "TrueView: CPV เฉลี่ย",
  "CPM เฉลี่ย",
  "วิดีโอแสดงแล้วถึง 25%",
  "วิดีโอแสดงแล้วถึง 50%",
  "วิดีโอแสดงแล้วถึง 75%",
  "วิดีโอแสดงแล้วถึง 100%",
  "TrueView: อัตราการดู (ในสตรีม)",
  "TrueView: อัตราการดู (ในฟีด)",
  "TrueView: อัตราการดู (Shorts)",
  "การโต้ตอบ",
  "อัตราการโต้ตอบ",
  "คลิก",
  "CTR",
  "ค่าใช้จ่าย",
]);

async function getCollection() {
  const client = await clientPromise;
  return client.db("fieldnotes").collection("campaigns");
}

function parseMetric(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text) return "";
  const number = Number(text.replace(/[^\d.-]/g, ""));
  return Number.isNaN(number) ? text : number;
}

function cleanCampaign(row: CampaignInput) {
  return Object.fromEntries(
    Object.entries(row)
      .map(([field, value]) => {
        const cleanField = field.trim();
        return [cleanField, numericFields.has(cleanField) ? parseMetric(value) : String(value ?? "").trim()] as const;
      })
      .filter(([field, value]) => field !== "_id" && !/^__empty/i.test(field) && value !== ""),
  );
}

function isCampaignRow(row: Record<string, unknown>) {
  const campaign = String(row["แคมเปญ"] ?? "").trim();
  const status = String(row["สถานะ"] ?? "").trim();
  return Boolean(campaign || status) && !/^(แคมเปญ|campaign)$/i.test(campaign);
}

export async function GET() {
  try {
    const rows = await (await getCollection()).find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(rows.map((row) => Object.fromEntries(Object.entries(row).filter(([field]) => field !== "createdAt" && field !== "updatedAt"))));
  } catch (error) {
    console.error("GET /api/campaigns failed", error);
    return NextResponse.json({ error: "Unable to load campaigns" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { rows?: CampaignInput[] };
    if (!Array.isArray(body.rows) || !body.rows.length) {
      return NextResponse.json({ error: "At least one campaign row is required" }, { status: 400 });
    }
    const now = new Date();
    const documents = body.rows
      .map(cleanCampaign)
      .filter(isCampaignRow)
      .map((row) => ({ ...row, createdAt: now, updatedAt: now }));
    if (!documents.length) {
      return NextResponse.json({ error: "ไม่พบแถวข้อมูล campaign ที่ถูกต้อง" }, { status: 400 });
    }
    const result = await (await getCollection()).insertMany(documents);
    return NextResponse.json({ imported: result.insertedCount }, { status: 201 });
  } catch (error) {
    console.error("POST /api/campaigns failed", error);
    return NextResponse.json({ error: "Unable to import campaigns" }, { status: 500 });
  }
}
