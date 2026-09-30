// src/app/api/debug/schema/route.ts
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const client = await clientPromise;
    const db = client.db("fieldnotes");
    
    const collections = await db.listCollections().toArray();

    const result = await Promise.all(
      collections.map(async (colInfo) => {
        const colName = colInfo.name;
        if (colName.startsWith("system.")) return null;

        const collection = db.collection(colName);
        const count = await collection.countDocuments();
        const sample = await collection.findOne();
        const sample5 = await collection.find().limit(5).toArray();

        const allFields = new Set<string>();
        sample5.forEach((doc) => {
          Object.keys(doc).forEach((k) => allFields.add(k));
        });

        return {
          collection: colName,
          count,
          fields_in_db: Array.from(allFields),
          sample_document: sample,
        };
      })
    );

    return NextResponse.json(result.filter(Boolean));
  } catch (error) {
    console.error("GET /api/debug/schema failed", error);
    return NextResponse.json({ error: "Unable to load schema" }, { status: 500 });
  }
}