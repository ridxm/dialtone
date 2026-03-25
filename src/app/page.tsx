"use client";

import { useState, useEffect, useRef } from "react";

type Phase = "idle" | "crawling" | "creating" | "live";

type CrawlBusiness = {
  id?: string;
  name: string;
  url: string;
  services: string[];
  hours: string | null;
  location: string | null;
  pricing: string | null;
  policies: string | null;
  raw_html: { description?: string; phone?: string; serviceCount?: number };
};

type TerminalLine = { label: string; value: string };

export default function Home() {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [business, setBusiness] = useState<CrawlBusiness | null>(null);
  const [agentBusinessId, setAgentBusinessId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [visibleLines, setVisibleLines] = useState<TerminalLine[]>([]);
  const linesRef = useRef<TerminalLine[]>([]);

  // Terminal-style line-by-line reveal
  function streamLines(lines: TerminalLine[]) {
    linesRef.current = lines;
    setVisibleLines([]);
    lines.forEach((line, i) => {
      setTimeout(() => {
        setVisibleLines((prev) => [...prev, line]);
      }, (i + 1) * 300);
    });
  }

  useEffect(() => {
    if (!business || phase !== "creating") return;
    const lines: TerminalLine[] = [];
    if (business.name) lines.push({ label: "NAME", value: business.name });
    if (business.location) lines.push({ label: "LOCATION", value: business.location });
    if (business.hours) lines.push({ label: "HOURS", value: business.hours });
    if (business.services.length > 0)
      lines.push({ label: "SERVICES", value: business.services.slice(0, 8).join(" · ") });
    if (business.policies) lines.push({ label: "POLICIES", value: business.policies });
    if (business.raw_html?.phone)
      lines.push({ label: "PHONE", value: business.raw_html.phone });
    streamLines(lines);
  }, [business, phase]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;

    setError("");
    setBusiness(null);
    setAgentBusinessId(null);
    setVisibleLines([]);
    setPhase("crawling");

    try {
      const crawlRes = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      if (!crawlRes.ok) {
        const err = await crawlRes.json();
        throw new Error(err.error || "Crawl failed");
      }

      const { business: biz, stored } = await crawlRes.json();
      setBusiness(biz);
      setPhase("creating");

      const createBody =
        stored && biz.id ? { businessId: biz.id } : { businessData: biz };

      const agentRes = await fetch("/api/create-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createBody),
      });

      if (!agentRes.ok) {
        const err = await agentRes.json();
        throw new Error(err.error || "Agent creation failed");
      }

      const { businessId } = await agentRes.json();
      setAgentBusinessId(businessId);
      setPhase("live");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setPhase("idle");
    }
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      {/* Header */}
      <div className="w-full max-w-2xl mb-16">
        <h1 className="text-5xl sm:text-7xl font-bold tracking-tighter uppercase">
          DIALTONE
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-muted-foreground">
          Paste your website. We answer your phone.
        </p>
      </div>

      {/* URL Input */}
      {phase === "idle" && (
        <form onSubmit={handleSubmit} className="w-full max-w-2xl animate-fade-up">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourbusiness.com"
              required
              className="flex-1 bg-white border border-foreground px-4 py-3 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-coral transition-colors"
            />
            <button
              type="submit"
              className="bg-coral text-black font-bold tracking-wider px-8 py-3 font-mono text-sm uppercase hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer"
            >
              CREATE AGENT
            </button>
          </div>
          {error && <p className="mt-3 text-coral font-mono text-sm">{error}</p>}
        </form>
      )}

      {/* Crawling State */}
      {phase === "crawling" && (
        <div className="w-full max-w-2xl animate-fade-up">
          <div className="border border-foreground bg-white p-6">
            <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground">
              <span className="inline-block w-2 h-2 bg-coral animate-pulse" />
              <span className="uppercase tracking-widest">CRAWLING...</span>
              <span className="animate-blink">_</span>
            </div>
          </div>
        </div>
      )}

      {/* Creating Agent — Terminal Stream */}
      {phase === "creating" && (
        <div className="w-full max-w-2xl animate-fade-up">
          <div className="border border-foreground bg-white p-6 space-y-1">
            <div className="flex items-center gap-3 font-mono text-sm text-muted-foreground mb-4">
              <span className="inline-block w-2 h-2 bg-coral animate-pulse" />
              <span className="uppercase tracking-widest">CREATING AGENT...</span>
            </div>
            {visibleLines.map((line, i) => (
              <div key={i} className="animate-typewriter font-mono text-sm">
                <span className="text-muted-foreground uppercase">{line.label}:</span>{" "}
                <span className="text-foreground">{line.value}</span>
              </div>
            ))}
            {visibleLines.length < linesRef.current.length && (
              <span className="font-mono text-sm text-muted-foreground animate-blink">_</span>
            )}
          </div>
        </div>
      )}

      {/* Live Phase */}
      {phase === "live" && agentBusinessId && (
        <div className="w-full max-w-2xl space-y-6 animate-fade-up">
          {/* Terminal output with all data */}
          <div className="border border-foreground bg-white p-6 space-y-1">
            {visibleLines.map((line, i) => (
              <div key={i} className="font-mono text-sm">
                <span className="text-muted-foreground uppercase">{line.label}:</span>{" "}
                <span className="text-foreground">{line.value}</span>
              </div>
            ))}
          </div>

          {/* Live badge */}
          <div className="flex items-center gap-4">
            <div className="relative flex items-center justify-center">
              <span className="absolute w-4 h-4 bg-green/40 animate-pulse-ring" />
              <span className="relative w-3 h-3 bg-green" />
            </div>
            <span className="text-2xl font-bold tracking-wider text-green uppercase">
              LIVE
            </span>
          </div>

          <p className="font-mono text-muted-foreground">Your AI agent is ready.</p>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={`/call/${agentBusinessId}`}
              className="inline-flex items-center justify-center bg-coral text-black font-bold tracking-wider px-8 py-4 font-mono text-sm uppercase hover:brightness-110 transition-all"
            >
              CALL YOUR AGENT
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center justify-center border border-foreground text-muted-foreground font-bold tracking-wider px-8 py-4 font-mono text-sm uppercase hover:text-foreground transition-all"
            >
              VIEW DASHBOARD
            </a>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="w-full max-w-2xl mt-20 pt-8 border-t border-foreground/20">
        <p className="font-mono text-xs text-muted-foreground tracking-widest uppercase">
          DIALTONE — AI phone agents for every business
        </p>
      </div>
    </main>
  );
}
