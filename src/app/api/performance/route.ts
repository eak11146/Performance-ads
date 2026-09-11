import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

type PerformanceRowInput = Record<string, unknown>;

const parseFormattedNumber = (value: unknown): number => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const str = String(value ?? "").trim().toLowerCase().replace(/,/g, "");
  if (!str) return 0;

  if (str.endsWith("%")) {
    const num = parseFloat(str.replace("%", ""));
    return Number.isFinite(num) ? num : 0;
  }
  if (str.endsWith("k")) {
    const num = parseFloat(str.replace("k", ""));
    return Number.isFinite(num) ? num * 1000 : 0;
  }
  if (str.endsWith("m")) {
    const num = parseFloat(str.replace("m", ""));
    return Number.isFinite(num) ? num * 1000000 : 0;
  }

  const parsed = parseFloat(str);
  return Number.isFinite(parsed) ? parsed : 0;
};

function cleanRow(row: PerformanceRowInput) {
  return {
    month: String(row.month || "").trim(),
    website: String(row.website || "").trim(),
    clicks: parseFormattedNumber(row.clicks),
    display: parseFormattedNumber(row.display),
    ctr: parseFormattedNumber(row.ctr),
    ranking: parseFormattedNumber(row.ranking),
    sales: parseFormattedNumber(row.sales),
    article: String(row.article || "-").trim(),
  };
}

async function getCollection() {
  const client = await clientPromise;
  return client.db("fieldnotes").collection("performance");
}

export async function GET() {
  try {
    const collection = await getCollection();
    const rows = await collection.find({}).sort({ createdAt: -1 }).toArray();

    const formattedRows = rows.map((doc) => {
      const { _id, ...rest } = doc;
      return {
        _id: _id.toString(),
        ...rest,
      };
    });

    return NextResponse.json(formattedRows);
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to load performance data", details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { rows?: PerformanceRowInput[] };

    if (!Array.isArray(body.rows) || !body.rows.length) {
      return NextResponse.json({ error: "At least one row is required" }, { status: 400 });
    }

    const now = new Date();
    const collection = await getCollection();

    const rowsToInsert = body.rows.map((row) => ({
      ...cleanRow(row),
      createdAt: now,
      updatedAt: now,
    }));

    const result = await collection.insertMany(rowsToInsert);

    return NextResponse.json(
      { imported: result.insertedCount, message: "Imported successfully" },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to import performance data", details: String(error) },
      { status: 500 }
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string } & PerformanceRowInput;
    const { id, ...updateData } = body;

    if (!id || !ObjectId.isValid(id)) {
      return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
    }

    const collection = await getCollection();
    const processedData = cleanRow(updateData);

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...processedData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" }
    );

    if (!result) {
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    const updatedDoc = "value" in result && result.value ? result.value : result;
    const { _id, ...rest } = updatedDoc as Record<string, unknown>;

    return NextResponse.json({ _id: String(_id), ...rest });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to update performance row", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    const collection = await getCollection();

    if (!Array.isArray(body.ids) || !body.ids.length) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    const validObjectIds = body.ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    const result = await collection.deleteMany({
      _id: { $in: validObjectIds },
    });

    return NextResponse.json({ deleted: result.deletedCount });
  } catch (error) {
    return NextResponse.json(
      { error: "Unable to delete performance rows", details: String(error) },
      { status: 500 }
    );
  }
}