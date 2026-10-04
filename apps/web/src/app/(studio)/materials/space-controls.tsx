"use client";
import { Input } from "@wonder/ui";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export function SpaceSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(initial);
  return (
    <form
      role="search"
      className="relative w-full lg:w-80"
      onSubmit={(e) => {
        e.preventDefault();
        const p = new URLSearchParams(params.toString());
        if (q.trim()) p.set("q", q.trim());
        else p.delete("q");
        router.push(`/materials?${p.toString()}`);
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" aria-hidden />
      <label htmlFor="space-q" className="sr-only">
        Search your space
      </label>
      <Input id="space-q" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your material and creations…" className="pl-10" />
    </form>
  );
}
