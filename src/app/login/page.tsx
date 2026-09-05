"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import TopMenu from "@/components/top-menu";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("admin@performance.local");
  const [password, setPassword] = useState("demo1234");
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth").then((response) => {
      if (response.ok) router.replace("/dashboard");
    }).catch(() => undefined);
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const data = await response.json();
      setError(data.error || "Email or password is not correct.");
      return;
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-[#f4f1ea] text-slate-950">
      <TopMenu user={null} />
      <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-5 py-12">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-10">
        <div className="mb-10">
          <p className="mt-10 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700">Welcome back</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">Sign in to your workspace</h1>
          <p className="mt-3 text-sm leading-6 text-slate-500">Use a local demo account to preview the dashboard.</p>
        </div>
        <form className="space-y-5" onSubmit={handleLogin}>
          <label className="block text-sm font-medium text-slate-700">
            Email
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label className="block text-sm font-medium text-slate-700">
            Password
            <input className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-orange-600 focus:ring-2 focus:ring-orange-100" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
          <button className="w-full rounded-xl bg-slate-950 px-4 py-3 font-medium text-white transition-colors hover:bg-orange-700" type="submit">Sign in</button>
        </form>
        <div className="mt-7 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
            Admin: <span className="font-medium text-slate-700">admin@performance.local</span> / <span className="font-medium text-slate-700">PerformanceAdmin123!</span>
        </div>
      </section>
      </main>
    </div>
  );
}
