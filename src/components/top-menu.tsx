"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, LogOut, Moon, Sun } from "lucide-react";
import type { DemoUser } from "@/data/users";

type TopMenuProps = {
  user?: DemoUser | null;
};

export default function TopMenu({ user }: TopMenuProps) {
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<DemoUser | null>(null);
  const resolvedUser = user === undefined ? sessionUser : user;

  useEffect(() => {
    if (user !== undefined) return;
    const timer = window.setTimeout(() => {
      fetch("/api/auth")
        .then(async (response) => {
          if (!response.ok) return;
          const data = await response.json() as { user?: DemoUser };
          setSessionUser(data.user ?? null);
        })
        .catch(() => setSessionUser(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [user]);

  function toggleTheme() {
    const nextTheme = document.documentElement.classList.contains("dark") ? "light" : "dark";
    document.documentElement.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("performance-theme", nextTheme);
  }

  async function handleSignOut() {
    await fetch("/api/auth", { method: "DELETE" });
    router.replace("/dashboard");
  }

  return (
    <header className="border-b border-zinc-200 bg-[var(--background)]/95 dark:border-zinc-700">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 lg:px-8" aria-label="Main navigation">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-semibold tracking-tight"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#c8102e] text-white"><BarChart3 size={17} /></span>Performance<span className="text-[#c8102e]">.</span></Link>
        <div className="flex items-center gap-6 text-sm font-medium text-zinc-500 dark:text-zinc-400">
          <Link className="text-zinc-950 dark:text-zinc-100" href="/dashboard">Overview</Link>
          {resolvedUser && <Link className="transition-colors hover:text-zinc-950 dark:hover:text-white" href="/ads-report">Ads report</Link>}
          {resolvedUser && <Link className="transition-colors hover:text-zinc-950 dark:hover:text-white" href="/campaigns">Campaigns</Link>}
          {resolvedUser && <Link className="transition-colors hover:text-zinc-950 dark:hover:text-white" href="/seo-data">SEO data</Link>}
          {!resolvedUser && <Link className="rounded-lg border border-zinc-300 px-3 py-2 text-zinc-700 transition-colors hover:border-[#c8102e] hover:text-[#c8102e] dark:border-zinc-600 dark:text-zinc-200" href="/login">Login</Link>}
        </div>
        <div className="flex items-center gap-3">
          {resolvedUser && <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{resolvedUser.name}</p><p className="text-xs text-zinc-500 dark:text-zinc-400">{resolvedUser.role}</p></div>}
          <button aria-label="Toggle theme" title="Toggle theme" onClick={toggleTheme} className="rounded-lg border border-zinc-300 p-2 text-zinc-600 transition-colors hover:border-[#c8102e] hover:text-[#c8102e] dark:border-zinc-600 dark:text-zinc-300"><Sun className="hidden dark:block" size={17} /><Moon className="dark:hidden" size={17} /></button>
          {resolvedUser && <button aria-label="Sign out" title="Sign out" onClick={handleSignOut} className="rounded-lg border border-zinc-300 p-2 text-zinc-600 transition-colors hover:border-[#c8102e] hover:text-[#c8102e] dark:border-zinc-600 dark:text-zinc-300"><LogOut size={17} /></button>}
        </div>
      </nav>
    </header>
  );
}
