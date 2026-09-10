import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

/**
 * รูปแบบของแถวข้อมูล SEO ขาเข้า (สามารถเป็นคีย์ใดๆ ก็ได้จาก Spreadsheet หรือ JSON)
 */
type SeoRowInput = Record<string, unknown>;

/**
 * รายชื่อคำค้นหา (Aliases) สำหรับจับคู่หัวคอลัมน์ของไฟล์ Spreadsheet/CSV ให้ตรงกับฟิลด์มาตรฐาน
 * รองรับทั้งภาษาอังกฤษและภาษาไทย รวมถึงรูปแบบที่ส่งออกจากเครื่องมือยอดนิยม เช่น Google Search Console, Google Ads Keyword Planner
 */
const fieldAliases = {
  date: ["date", "วันที่", "day", "time", "เวลา", "วัน"],
  site: ["site", "website", "web", "เว็บไซต์", "เว็บ", "property", "domain", "url", "โดเมน"],
  keyword: [
    "keyword",
    "keywords",
    "query",
    "queries",
    "top queries",
    "top query",
    "ข้อความค้นหายอดนิยม",
    "คำค้นหา",
    "คีย์เวิร์ด",
    "คำค้น",
    "คำค้นหายอดนิยม",
    "search query",
    "search queries",
    "search term",
    "search terms",
  ],
  clicks: ["clicks", "click", "การคลิก", "คลิก", "จำนวนคลิก", "ยอดคลิก"],
  impressions: [
    "impressions",
    "impression",
    "การแสดงผล",
    "การแสดง",
    "impr",
    "impr.",
    "จำนวนการแสดงผล",
    "avg. monthly searches",
    "avg monthly searches",
    "monthly searches",
    "search volume",
    "ปริมาณการค้นหา",
    "ยอดวิว",
    "views",
  ],
  ctr: ["ctr", "click through rate", "อัตราการคลิกผ่าน", "อัตราการคลิก", "อัตราคลิก"],
  position: [
    "position",
    "avg position",
    "avg. position",
    "average position",
    "organic average position",
    "ตำแหน่ง",
    "ตำแหน่งเฉลี่ย",
    "อันดับ",
    "อันดับเฉลี่ย",
    "rank",
    "average rank",
  ],
};

/**
 * ฟังก์ชัน normalize: ปรับแต่งข้อความให้เป็นตัวพิมพ์เล็กและตัดเว้นวรรค/เครื่องหมายพิเศษออก
 * เพื่อนำไปเปรียบเทียบชื่อคอลัมน์ได้อย่างแม่นยำ
 */
function normalize(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s_\-./():]/g, "");
}

/**
 * ฟังก์ชัน columnFor: ค้นหาชื่อ Key ใน row ที่ตรงกับ aliases ที่กำหนด
 * ตรวจสอบทั้งแบบตรงเป๊ะ (Exact Match) และแบบตรวจหาคำที่มีอยู่ในชื่อ (Partial Match)
 */
function columnFor(row: SeoRowInput, aliases: string[]) {
  const keys = Object.keys(row);

  // 1. ตรวจสอบแบบตรงเป๊ะก่อน (Exact match)
  const exactKey = keys.find((key) =>
    aliases.some((alias) => normalize(key) === normalize(alias)),
  );
  if (exactKey) return exactKey;

  // 2. ตรวจสอบแบบค้นหาคำในข้อความ (Partial match) สำหรับชื่อหัวตารางยาวๆ
  return keys.find((key) => {
    const cKey = normalize(key);
    if (!cKey || cKey.length < 3) return false;
    return aliases.some((alias) => {
      const cAlias = normalize(alias);
      return (
        cAlias.length >= 3 &&
        (cKey.includes(cAlias) || cAlias.includes(cKey))
      );
    });
  });
}

/**
 * ฟังก์ชัน parseDate: แปลงค่าเป็น Date Object ที่ถูกต้อง
 * รองรับทั้งรูปแบบ Excel Serial Number, วว/ดด/ปปปป, พ.ศ., หรือ ISO string
 */
function parseDate(value: unknown): Date | null {
  const text = String(value ?? "").trim();
  if (!text) return null;

  // แปลงกรณีเป็น Excel Serial Number (เช่น 45185)
  const serial = Number(text);
  if (/^\d+(\.\d+)?$/.test(text) && serial > 1 && serial < 100000) {
    return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  }

  // รูปแบบ วันที่ เช่น DD/MM/YYYY หรือ YYYY-MM-DD
  const parts = text.match(/^(\d{1,4})[/-](\d{1,2})[/-](\d{1,4})$/);
  if (parts) {
    const first = Number(parts[1]);
    const month = Number(parts[2]);
    const last = Number(parts[3]);
    let year = first > 31 ? first : last;
    if (year >= 2400) year -= 543; // แปลง พ.ศ. เป็น ค.ศ.
    if (year < 100) year += year >= 50 ? 1957 : 2000;
    const day = first > 31 ? last : first;
    const result = new Date(Date.UTC(year, month - 1, day));
    return Number.isNaN(result.getTime()) ? null : result;
  }

  const result = new Date(text);
  return Number.isNaN(result.getTime()) ? null : result;
}

/**
 * ฟังก์ชัน metric: แปลงค่าตัวเลข โดยตัดเครื่องหมาย %, คอมม่า และเว้นวรรค
 * คืนค่าเป็นตัวเลข Number ที่ปลอดภัย (หากแปลงไม่ได้จะคืนค่า 0)
 */
function metric(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? "").replace(/[%,\s]/g, "");
  const number = parseFloat(cleaned);
  return Number.isFinite(number) ? number : 0;
}

/**
 * ฟังก์ชัน cleanRow: จัดระเบียบข้อมูลของแถว (Row) ให้เป็น Standard Schema
 * - สร้างฟิลด์มาตรฐานตัวพิมพ์เล็กเสมอ: date, site, keyword, clicks, impressions, ctr, position
 * - คำนวณ CTR อัตโนมัติหากมี clicks และ impressions แต่ไม่มี CTR ในไฟล์
 * - รักษาฟิลด์ดั้งเดิมอื่นๆ ไว้ทั้งหมด เพื่อความยืดหยุ่นของข้อมูล
 */
function cleanRow(row: SeoRowInput) {
  const cleaned: Record<string, unknown> = { ...row };

  // ตรวจหาชื่อคอลัมน์ดั้งเดิมที่แมปกับฟิลด์มาตรฐาน
  const dateKey = columnFor(row, fieldAliases.date);
  const siteKey = columnFor(row, fieldAliases.site);
  const keywordKey = columnFor(row, fieldAliases.keyword);
  const clicksKey = columnFor(row, fieldAliases.clicks);
  const impressionsKey = columnFor(row, fieldAliases.impressions);
  const ctrKey = columnFor(row, fieldAliases.ctr);
  const positionKey = columnFor(row, fieldAliases.position);

  // สกัดค่าตัวเลขและข้อความ
  const clicksVal = clicksKey !== undefined ? metric(row[clicksKey]) : metric(row.clicks);
  const impressionsVal = impressionsKey !== undefined ? metric(row[impressionsKey]) : metric(row.impressions);
  let ctrVal = ctrKey !== undefined ? metric(row[ctrKey]) : metric(row.ctr);
  if (ctrVal === 0 && impressionsVal > 0 && clicksVal > 0) {
    ctrVal = parseFloat(((clicksVal / impressionsVal) * 100).toFixed(2));
  }
  const positionVal = positionKey !== undefined ? metric(row[positionKey]) : metric(row.position);

  const keywordVal = String(
    (keywordKey !== undefined ? row[keywordKey] : row.keyword) ?? ""
  ).trim();

  const siteVal = String(
    (siteKey !== undefined ? row[siteKey] : row.site) ?? "default-site"
  ).trim();

  const rawDateVal = dateKey !== undefined ? row[dateKey] : row.date;
  const parsedDate = parseDate(rawDateVal);

  // กำหนดฟิลด์มาตรฐานตัวพิมพ์เล็กเพื่อความปลอดภัยในการเข้าถึงจากหน้าบ้าน (page.tsx)
  cleaned.date = parsedDate || rawDateVal || new Date().toISOString().slice(0, 10);
  cleaned.site = siteVal || "default-site";
  cleaned.keyword = keywordVal;
  cleaned.clicks = clicksVal;
  cleaned.impressions = impressionsVal;
  cleaned.ctr = ctrVal;
  cleaned.position = positionVal;

  return cleaned;
}

/**
 * ฟังก์ชัน getCollection: เชื่อมต่อไปยังฐานข้อมูล MongoDB
 * Database: "fieldnotes"
 * Collection: "seo_data"
 */
async function getCollection() {
  const client = await clientPromise;
  return client.db("fieldnotes").collection("seo_data");
}

/**
 * --------------------------------------------------------------------------
 * 1. GET: ดึงข้อมูล SEO ทั้งหมดจาก MongoDB
 * --------------------------------------------------------------------------
 * การทำงาน:
 * - ดึง Document ทั้งหมดจากคอลเลกชัน "seo_data"
 * - เรียงลำดับจากข้อมูลล่าสุด (createdAt: -1 หรือ date: -1)
 * - แปลง _id ของ MongoDB ให้เป็น string ก่อนส่งกลับไปให้หน้าเว็บ
 */
export async function GET() {
  try {
    console.log("[API-SEO-GET] กำลังเชื่อมต่อ MongoDB และดึงข้อมูล SEO ทั้งหมด...");
    const collection = await getCollection();
    const rows = await collection.find({}).sort({ createdAt: -1 }).toArray();

    console.log(`[API-SEO-GET] ดึงข้อมูลสำเร็จ พบจำนวนทั้งหมด: ${rows.length} รายการ`);

    const formattedRows = rows.map((doc) => {
      const { _id, ...rest } = doc;
      return {
        _id: _id.toString(),
        ...rest,
      };
    });

    return NextResponse.json(formattedRows);
  } catch (error) {
    console.error("[API-SEO-GET] เกิดข้อผิดพลาดในการดึงข้อมูล SEO:", error);
    return NextResponse.json(
      { error: "Unable to load SEO data", details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * 2. POST: นำเข้า (Import) ข้อมูล SEO รายแถวเข้าฐานข้อมูล MongoDB
 * --------------------------------------------------------------------------
 * การทำงาน:
 * 1. รับ JSON Request Body จาก Client: { rows: [...] }
 *    - ตัวแปร `body.rows`: คือ Array ของข้อมูลแถวที่ Client ส่งมา
 * 2. ตรวจสอบว่ามีข้อมูลส่งมาหรือไม่
 * 3. นำแต่ละแถวไปผ่านฟังก์ชัน `cleanRow()` เพื่อแปลงเป็น Standard Schema
 * 4. สร้างตัวแปร `rowsToInsert`:
 *    - ตัวแปร `rowsToInsert`: คือ Array ข้อมูลที่จะนำไป POST / บันทึกลง MongoDB
 *    - มีการใส่ timestamp `createdAt` และ `updatedAt`
 * 5. บันทึกลง MongoDB ด้วยคำสั่ง: `await collection.insertMany(rowsToInsert)`
 * 6. ส่ง Response กลับพร้อมจำนวนรายการที่บันทึกสำเร็จ `{ imported: result.insertedCount }`
 */
export async function POST(request: Request) {
  try {
    console.log("[API-SEO-POST] เริ่มต้นรับคำขออัปโหลดข้อมูล SEO (POST)...");

    // รับ JSON จาก Client
    const body = (await request.json()) as { rows?: SeoRowInput[] };

    // ตัวแปร body.rows คือข้อมูลแถวดิบที่ส่งมาจากหน้าบ้าน
    if (!Array.isArray(body.rows) || !body.rows.length) {
      console.warn("[API-SEO-POST] ข้อมูลไม่ถูกต้อง: ไม่พบอาเรย์ rows หรือ rows ว่างเปล่า");
      return NextResponse.json(
        { error: "At least one SEO row is required (ต้องการข้อมูลอย่างน้อย 1 แถว)" },
        { status: 400 },
      );
    }

    console.log(`[API-SEO-POST] ได้รับข้อมูลแถวดิบจำนวน: ${body.rows.length} แถว`);
    console.log("[API-SEO-POST] ตัวอย่างแถวดิบแรกที่ส่งมา:", JSON.stringify(body.rows[0]));

    const now = new Date();
    const collection = await getCollection();

    // =========================================================================
    // ตัวแปร rowsToInsert:
    // นี่คือตัวแปรหลักที่ใช้ Post / Insert ข้อมูลทั้งหมดลงในฐานข้อมูล MongoDB
    // โดยผ่านการ cleanRow และประทับเวลา createdAt, updatedAt
    // =========================================================================
    const rowsToInsert = body.rows.map((row) => {
      const processed = cleanRow(row);
      return {
        ...processed,
        createdAt: now,
        updatedAt: now,
      };
    });

    console.log("[API-SEO-POST] ข้อมูลผ่านการ Clean และจัดระเบียบเรียบร้อยแล้ว");
    console.log("[API-SEO-POST] ตัวอย่าง rowsToInsert[0] ที่จะบันทึก:", JSON.stringify(rowsToInsert[0], null, 2));

    // บันทึกข้อมูลลง MongoDB คอลเลกชัน "seo_data"
    const result = await collection.insertMany(rowsToInsert);

    console.log(`[API-SEO-POST] บันทึกลง MongoDB สำเร็จ! จำนวนที่เพิ่มได้ (insertedCount): ${result.insertedCount} รายการ`);

    return NextResponse.json(
      { imported: result.insertedCount, message: "Imported successfully" },
      { status: 201 },
    );
  } catch (error) {
    console.error("[API-SEO-POST] เกิดข้อผิดพลาดในการบันทึกข้อมูล SEO ลง MongoDB:", error);
    return NextResponse.json(
      { error: "Unable to import SEO data", details: String(error) },
      { status: 500 },
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * 3. PATCH: อัปเดต/แก้ไขข้อมูล SEO รายแถวตาม _id ใน MongoDB
 * --------------------------------------------------------------------------
 * การทำงาน:
 * 1. รับ id และข้อมูลฟิลด์ที่ต้องการแก้ไขจาก Request Body
 * 2. ตัวแปร `processedData`: คือข้อมูลที่ผ่านการ cleanRow เพื่อเตรียมอัปเดต
 * 3. อัปเดตใน MongoDB ด้วยคำสั่ง `findOneAndUpdate`
 */
/* export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string } & SeoRowInput;
    const { id, ...updateData } = body;

    console.log(`[API-SEO-PATCH] ได้รับคำขอแก้ไขแถว ID: ${id}`);

    if (!id || !ObjectId.isValid(id)) {
      console.warn(`[API-SEO-PATCH] Record ID ไม่ถูกต้อง: ${id}`);
      return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
    }

    const collection = await getCollection();

    // ตัวแปร processedData: ข้อมูลที่จะนำไปบันทึกทับใน MongoDB
    const processedData = cleanRow(updateData);
    delete processedData._id;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      {
        $set: {
          ...processedData,
          updatedAt: new Date(),
        },
      },
      { returnDocument: "after" },
    );

    if (!result) {
      console.warn(`[API-SEO-PATCH] ไม่พบข้อมูลแถวที่มี ID: ${id}`);
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    console.log(`[API-SEO-PATCH] แก้ไขข้อมูล ID: ${id} สำเร็จ!`);

    const { _id, ...rest } = result;
    return NextResponse.json({ _id: _id.toString(), ...rest });
  } catch (error) {
    console.error("[API-SEO-PATCH] เกิดข้อผิดพลาดในการแก้ไขข้อมูล:", error);
    return NextResponse.json(
      { error: "Unable to update SEO row", details: String(error) },
      { status: 500 },
    );
  }
} */

  export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { id?: string } & SeoRowInput;
    const { id, ...updateData } = body;

    console.log(`[API-SEO-PATCH] ได้รับคำขอแก้ไขแถว ID: ${id}`);

    if (!id || !ObjectId.isValid(id)) {
      console.warn(`[API-SEO-PATCH] Record ID ไม่ถูกต้อง: ${id}`);
      return NextResponse.json({ error: "Invalid record ID" }, { status: 400 });
    }

    const collection = await getCollection();

    const processedData = cleanRow(updateData);
    delete processedData._id;

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
      console.warn(`[API-SEO-PATCH] ไม่พบข้อมูลแถวที่มี ID: ${id}`);
      return NextResponse.json({ error: "Record not found" }, { status: 404 });
    }

    console.log(`[API-SEO-PATCH] แก้ไขข้อมูล ID: ${id} สำเร็จ!`);

    // ดึง Document หลังอัปเดต (รองรับ MongoDB driver ได้ทุกเวอร์ชัน)
    const updatedDoc =
      "value" in result && result.value ? result.value : result;

    const { _id, ...rest } = updatedDoc as Record<string, unknown>;
    return NextResponse.json({ _id: String(_id), ...rest });
  } catch (error) {
    console.error("[API-SEO-PATCH] เกิดข้อผิดพลาดในการแก้ไขข้อมูล:", error);
    return NextResponse.json(
      { error: "Unable to update SEO row", details: String(error) },
      { status: 500 }
    );
  }
}

/**
 * --------------------------------------------------------------------------
 * 4. DELETE: ลบข้อมูล SEO ตามรายการ ID ที่ส่งมา
 * --------------------------------------------------------------------------
 * การทำงาน:
 * 1. รับอาเรย์ `body.ids`: รายการของ _id ที่ต้องการลบ
 * 2. ตรวจสอบ ObjectId และลบออกจาก MongoDB ด้วยคำสั่ง `deleteMany`
 */
export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { ids?: string[] };
    console.log("[API-SEO-DELETE] ได้รับคำขอลบข้อมูล SEO ตามรายการ IDs:", body.ids);

    const collection = await getCollection();

    if (!Array.isArray(body.ids) || !body.ids.length) {
      return NextResponse.json(
        { error: "No IDs provided for deletion" },
        { status: 400 },
      );
    }

    const validObjectIds = body.ids
      .filter((id) => ObjectId.isValid(id))
      .map((id) => new ObjectId(id));

    if (!validObjectIds.length) {
      return NextResponse.json({ error: "Invalid IDs format" }, { status: 400 });
    }

    const result = await collection.deleteMany({
      _id: { $in: validObjectIds },
    });

    console.log(`[API-SEO-DELETE] ลบข้อมูลออกจาก MongoDB สำเร็จ จำนวน: ${result.deletedCount} รายการ`);

    return NextResponse.json({ deleted: result.deletedCount });
  } catch (error) {
    console.error("[API-SEO-DELETE] เกิดข้อผิดพลาดในการลบข้อมูล:", error);
    return NextResponse.json(
      { error: "Unable to delete SEO rows", details: String(error) },
      { status: 500 },
    );
  }
}