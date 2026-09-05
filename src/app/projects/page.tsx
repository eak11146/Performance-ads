"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TopMenu from "@/components/top-menu";

type Project = { _id: string; name: string; owner: string; status: string; progress: number; due: string };

type FormData = Omit<Project, "_id">;
const emptyForm: FormData = { name: "", owner: "", status: "Planned", progress: 0, due: "" };

export default function ProjectsPage() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState("Loading projects...");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/auth").then((response) => {
        if (!response.ok) {
          router.replace("/login");
          return;
        }
        setIsAuthorized(true);
      }).catch(() => router.replace("/login"));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  async function loadProjects() {
    const response = await fetch("/api/projects");
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load projects");
    setProjects(data);
    setMessage(data.length ? "" : "No projects yet");
  }

  useEffect(() => {
    if (!isAuthorized) return;
    const timer = window.setTimeout(() => {
      loadProjects().catch((error: Error) => setMessage(error.message));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isAuthorized]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("Saving...");
    const method = editingId ? "PATCH" : "POST";
    const body = editingId ? { ...form, id: editingId } : form;
    const response = await fetch("/api/projects", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) { setMessage(data.error || "Save failed"); return; }
    setForm(emptyForm);
    setEditingId(null);
    await loadProjects();
  }

  async function handleDelete(id: string) {
    const response = await fetch("/api/projects", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (!response.ok) { const data = await response.json(); setMessage(data.error || "Delete failed"); return; }
    await loadProjects();
  }

  function startEditing(project: Project) {
    setEditingId(project._id);
    setForm({ name: project.name, owner: project.owner, status: project.status, progress: project.progress, due: project.due });
    setMessage("");
  }

  if (!isAuthorized) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f1ea] text-sm text-slate-500">Checking access...</main>;
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-slate-950">
      <TopMenu />
      <main className="px-5 py-12 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-10 flex flex-col justify-between gap-4 border-b border-slate-300 pb-8 sm:flex-row sm:items-end">
          <div><Link href="/" className="text-lg font-semibold tracking-tight">fieldnotes<span className="text-orange-600">.</span></Link><p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">MongoDB CRUD test</p><h1 className="mt-3 text-4xl font-semibold tracking-tight">Projects</h1><p className="mt-3 text-slate-600">Create, read, update, and delete records from the database.</p></div>
          <Link href="/dashboard" className="text-sm font-medium text-slate-600 underline underline-offset-4">Back to dashboard</Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
          <form onSubmit={handleSubmit} className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold">{editingId ? "Edit project" : "New project"}</h2>
            <div className="mt-5 space-y-4">
              <label className="block text-sm font-medium">Name<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
              <label className="block text-sm font-medium">Owner<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.owner} onChange={(event) => setForm({ ...form, owner: event.target.value })} required /></label>
              <label className="block text-sm font-medium">Status<select className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}><option>Planned</option><option>In progress</option><option>Review</option><option>On track</option></select></label>
              <label className="block text-sm font-medium">Progress (%)<input className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" type="number" min="0" max="100" value={form.progress} onChange={(event) => setForm({ ...form, progress: Number(event.target.value) })} /></label>
              <label className="block text-sm font-medium">Due date<input className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2" type="date" value={form.due} onChange={(event) => setForm({ ...form, due: event.target.value })} /></label>
            </div>
            <div className="mt-6 flex gap-2"><button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700" type="submit">{editingId ? "Update" : "Create"}</button>{editingId && <button className="rounded-lg border border-slate-300 px-4 py-2 text-sm" type="button" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancel</button>}</div>
            {message && <p className="mt-4 text-sm text-slate-500" role="status">{message}</p>}
          </form>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 px-6 py-4"><h2 className="font-semibold">All projects</h2></div><ul>{projects.map((project) => <li key={project._id} className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 last:border-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{project.name}</p><p className="mt-1 text-sm text-slate-500">{project.owner} · {project.status} · {project.progress}% · {project.due}</p></div><div className="flex gap-2"><button className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:border-slate-950" onClick={() => startEditing(project)}>Edit</button><button className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50" onClick={() => handleDelete(project._id)}>Delete</button></div></li>)}</ul>{!projects.length && <p className="px-6 py-10 text-sm text-slate-500">{message}</p>}</section>
        </div>
      </div>
      </main>
    </div>
  );
}
