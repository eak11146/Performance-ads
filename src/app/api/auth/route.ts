import { createHmac, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

const scrypt = promisify(scryptCallback);
const sessionCookie = "performance-session";
const adminEmail = "admin@performance.local";
const adminPassword = "PerformanceAdmin123!";
const authSecret = process.env.AUTH_SECRET || "development-performance-secret";

type UserRecord = {
  email: string;
  name: string;
  role: string;
  passwordHash: string;
  passwordSalt: string;
};

async function getUsers() {
  const client = await clientPromise;
  return client.db("fieldnotes").collection<UserRecord>("users");
}

async function ensureCollections() {
  const client = await clientPromise;
  const db = client.db("fieldnotes");
  for (const name of ["users", "campaigns", "ad_reports"]) {
    const exists = await db.listCollections({ name }, { nameOnly: true }).hasNext();
    if (!exists) await db.createCollection(name);
  }
}

async function hashPassword(password: string, salt: string) {
  const derivedKey = await scrypt(password, salt, 64) as Buffer;
  return derivedKey.toString("hex");
}

function signSession(email: string) {
  return createHmac("sha256", authSecret).update(email).digest("hex");
}

function createSession(email: string) {
  return `${Buffer.from(email).toString("base64url")}.${signSession(email)}`;
}

function readSession(request: Request) {
  const cookie = request.headers.get("cookie")?.match(new RegExp(`${sessionCookie}=([^;]+)`))?.[1];
  if (!cookie) return null;
  const [encodedEmail, signature] = cookie.split(".");
  if (!encodedEmail || !signature) return null;
  const email = Buffer.from(encodedEmail, "base64url").toString("utf8");
  const expected = signSession(email);
  if (signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  return email;
}

async function ensureAdmin() {
  await ensureCollections();
  const users = await getUsers();
  const existing = await users.findOne({ email: adminEmail });
  if (existing) return existing;
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = await hashPassword(adminPassword, passwordSalt);
  const admin: UserRecord = { email: adminEmail, name: "Performance Admin", role: "Workspace admin", passwordHash, passwordSalt };
  await users.insertOne(admin);
  return admin;
}

function publicUser(user: UserRecord) {
  return { email: user.email, name: user.name, role: user.role };
}

export async function GET(request: Request) {
  try {
    await ensureAdmin();
    const email = readSession(request);
    if (!email) return NextResponse.json({ user: null }, { status: 401 });
    const user = await (await getUsers()).findOne({ email });
    if (!user) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({ user: publicUser(user) });
  } catch (error) {
    console.error("GET /api/auth failed", error);
    return NextResponse.json({ error: "Unable to check authentication" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await ensureAdmin();
    const body = await request.json() as { email?: string; password?: string };
    const email = body.email?.trim().toLowerCase();
    if (!email || !body.password) return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    const user = await (await getUsers()).findOne({ email });
    if (!user) return NextResponse.json({ error: "Email or password is not correct" }, { status: 401 });
    const passwordHash = await hashPassword(body.password, user.passwordSalt);
    if (passwordHash.length !== user.passwordHash.length || !timingSafeEqual(Buffer.from(passwordHash), Buffer.from(user.passwordHash))) {
      return NextResponse.json({ error: "Email or password is not correct" }, { status: 401 });
    }
    const response = NextResponse.json({ user: publicUser(user) });
    response.cookies.set(sessionCookie, createSession(user.email), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 8 });
    return response;
  } catch (error) {
    console.error("POST /api/auth failed", error);
    return NextResponse.json({ error: "Unable to sign in" }, { status: 500 });
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, expires: new Date(0), path: "/" });
  return response;
}
