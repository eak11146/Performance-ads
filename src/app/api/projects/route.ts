import { NextResponse } from "next/server";
import { ObjectId } from "mongodb";
import clientPromise from "@/lib/mongodb";

export const runtime = "nodejs";

type ProjectInput = {
  name?: string;
  owner?: string;
  status?: string;
  progress?: number;
  due?: string;
};

async function getCollection() {
  const client = await clientPromise;
  return client.db("fieldnotes").collection("projects");
}

export async function GET() {
  try {
    const collection = await getCollection();
    const projects = await collection.find({}).sort({ createdAt: -1 }).toArray();
    return NextResponse.json(projects);
  } catch (error) {
    console.error("GET /api/projects failed", error);
    return NextResponse.json({ error: "Unable to load projects" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ProjectInput;
    if (!body.name?.trim() || !body.owner?.trim()) {
      return NextResponse.json({ error: "Name and owner are required" }, { status: 400 });
    }

    const project = {
      name: body.name.trim(),
      owner: body.owner.trim(),
      status: body.status?.trim() || "Planned",
      progress: Math.min(100, Math.max(0, Number(body.progress) || 0)),
      due: body.due?.trim() || "No due date",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const collection = await getCollection();
    const result = await collection.insertOne(project);
    return NextResponse.json({ _id: result.insertedId, ...project }, { status: 201 });
  } catch (error) {
    console.error("POST /api/projects failed", error);
    return NextResponse.json({ error: "Unable to create project" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as ProjectInput & { id?: string };
    if (!body.id || !ObjectId.isValid(body.id)) {
      return NextResponse.json({ error: "A valid project id is required" }, { status: 400 });
    }
    const update = {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.owner !== undefined && { owner: body.owner.trim() }),
      ...(body.status !== undefined && { status: body.status.trim() }),
      ...(body.progress !== undefined && { progress: Math.min(100, Math.max(0, Number(body.progress) || 0)) }),
      ...(body.due !== undefined && { due: body.due.trim() }),
      updatedAt: new Date(),
    };
    const collection = await getCollection();
    const result = await collection.findOneAndUpdate({ _id: new ObjectId(body.id) }, { $set: update }, { returnDocument: "after" });
    if (!result) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json(result);
  } catch (error) {
    console.error("PATCH /api/projects failed", error);
    return NextResponse.json({ error: "Unable to update project" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id || !ObjectId.isValid(body.id)) {
      return NextResponse.json({ error: "A valid project id is required" }, { status: 400 });
    }
    const collection = await getCollection();
    const result = await collection.deleteOne({ _id: new ObjectId(body.id) });
    if (!result.deletedCount) return NextResponse.json({ error: "Project not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/projects failed", error);
    return NextResponse.json({ error: "Unable to delete project" }, { status: 500 });
  }
}
