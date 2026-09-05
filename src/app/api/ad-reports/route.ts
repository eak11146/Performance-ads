import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

type AdReportInput = Record<string, unknown>;

async function getCollection() {
  const client = await clientPromise;
  return client.db("fieldnotes").collection("ad_reports");
}

function isDateField(field: string) {
  const normalized = field.toLowerCase().replace(/[\s_\-./]/g, "");
  return normalized === "date" || normalized === "วันที่";
}

function normalizeYear(year: number) {
  if (year >= 2400) return year - 543;
  if (year < 100) return year >= 50 ? year + 1957 : year + 2000;
  return year;
}

function parseDateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value ?? "").trim();
  if (!text) return "";

  const serial = Number(text);
  if (/^\d+(\.\d+)?$/.test(text) && serial > 1 && serial < 100000) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
    if (!Number.isNaN(excelDate.getTime())) return excelDate;
  }

  const numericParts = text.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (numericParts) {
    const first = Number(numericParts[1]);
    const second = Number(numericParts[2]);
    const third = Number(numericParts[3]);
    const year = normalizeYear(first > 31 ? first : third);
    const month = second;
    const day = first > 31 ? third : first;
    const parsed = new Date(Date.UTC(year, month - 1, day));
    if (parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day) return parsed;
  }

  const monthText = text.match(/^(?:\d{1,2}[\s/-])?([A-Za-z]{3,9})[\s/-](\d{2,4})$/i);
  if (monthText) {
    const year = normalizeYear(Number(monthText[2]));
    const month = new Date(`${monthText[1]} 1, 2000`).getMonth();
    if (month >= 0) return new Date(Date.UTC(year, month, 1));
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed;
}

function cleanReport(row: AdReportInput) {
  return Object.fromEntries(
    Object.entries(row)
      .map(([field, value]) => {
        const cleanField = field.trim();
        return [cleanField, isDateField(cleanField) ? parseDateValue(value) : String(value ?? "").trim()] as const;
      })
      .filter(([field, value]) => field !== "_id" && field !== "id" && !/^__empty/i.test(field) && value !== ""),
  );
}

function normalizedField(field: string) {
  return field.toLowerCase().replace(/[\s_\-./]/g, "");
}

function isDataReport(row: Record<string, unknown>) {
  const values = Object.entries(row).reduce<Record<string, string>>((result, [field, value]) => {
    result[normalizedField(field)] = String(value ?? "").trim();
    return result;
  }, {});
  const hasDate = Boolean(values.date || values["วันที่"]);
  const hasProduct = Boolean(values.products || values.product || values["สินค้า"]);
  const hasCreator = Boolean(values.creator || values.kol);
  const isRepeatedHeader = [values.date, values.products || values.product, values.creator || values.kol].every((value) => /^(date|products?|creator|kol)$/i.test(value));
  return hasDate && hasProduct && hasCreator && !isRepeatedHeader;
}

export async function GET() {
  try {
    const reports = await (await getCollection()).find({}).sort({ createdAt: -1 }).toArray();
    const cleanedReports = reports.map((report) => Object.fromEntries(
      Object.entries(report).filter(([field, value]) => field === "_id" || (field !== "createdAt" && field !== "updatedAt" && !/^__empty/i.test(field) && String(value ?? "").trim() !== "")),
    ));
    return NextResponse.json(cleanedReports);
  } catch (error) {
    console.error("GET /api/ad-reports failed", error);
    return NextResponse.json({ error: "Unable to load ad reports" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { rows?: AdReportInput[] };
    if (!Array.isArray(body.rows) || !body.rows.length) {
      return NextResponse.json({ error: "At least one report row is required" }, { status: 400 });
    }

    const now = new Date();
    const documents = body.rows
      .map(cleanReport)
      .filter(isDataReport)
      .filter((row) => Object.keys(row).length > 0)
      .map((row) => ({ ...row, createdAt: now, updatedAt: now }));
    if (!documents.length) {
      return NextResponse.json({ error: "ไม่พบแถวข้อมูลที่มี date, products และ Creator" }, { status: 400 });
    }
    const result = await (await getCollection()).insertMany(documents);
    return NextResponse.json({ imported: result.insertedCount }, { status: 201 });
  } catch (error) {
    console.error("POST /api/ad-reports failed", error);
    return NextResponse.json({ error: "Unable to import ad reports" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as AdReportInput & { id?: string };
    if (!body.id || !ObjectId.isValid(body.id)) {
      return NextResponse.json({ error: "A valid report id is required" }, { status: 400 });
    }
    const cleaned = cleanReport(body);
    const unset = Object.fromEntries(
      Object.entries(body)
        .filter(([field, value]) => field !== "id" && field !== "_id" && String(value ?? "").trim() === "")
        .map(([field]) => [field.trim(), ""]),
    );
    const collection = await getCollection();
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(body.id) },
      { $set: { ...cleaned, updatedAt: new Date() }, ...(Object.keys(unset).length ? { $unset: unset } : {}) },
      { returnDocument: "after" },
    );
    if (!result) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/ad-reports failed", error);
    return NextResponse.json({ error: "Unable to update ad report" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string; ids?: string[] };
    const ids = body.ids?.length ? body.ids : body.id ? [body.id] : [];
    if (!ids.length || ids.some((id) => !ObjectId.isValid(id))) {
      return NextResponse.json({ error: "A valid report id is required" }, { status: 400 });
    }
    const result = await (await getCollection()).deleteMany({ _id: { $in: ids.map((id) => new ObjectId(id)) } });
    if (!result.deletedCount) return NextResponse.json({ error: "Report not found" }, { status: 404 });
    return NextResponse.json({ success: true, deleted: result.deletedCount });
  } catch (error) {
    console.error("DELETE /api/ad-reports failed", error);
    return NextResponse.json({ error: "Unable to delete ad report" }, { status: 500 });
  }
}
