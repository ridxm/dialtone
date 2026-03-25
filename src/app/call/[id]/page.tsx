"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import type { Business } from "@/lib/types";

type CallStatus = "idle" | "connecting" | "active" | "ended";

export default function CallPage() {
  const { id } = useParams<{ id: string }>();
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [callStatus, setCallStatus] = useState<CallStatus>("idle");
  const [error, setError] = useState("");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vapiRef = useRef<any>(null);

  useEffect(() => {
    async function loadBusiness() {
      const { data, error } = await getSupabase()
        .from("businesses")
        .select("*")
        .eq("id", id)
        .single();

      if (error || !data) {
        setError("Business not found");
      } else {
        setBusiness(data as Business);
      }
      setLoading(false);
    }
    loadBusiness();
  }, [id]);

  const startCall = useCallback(async () => {
    if (!business?.vapi_assistant_id) return;

    setCallStatus("connecting");
    setError("");

    try {
      const VapiModule = await import("@vapi-ai/web");
      const Vapi = VapiModule.default;
      const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY ?? "");
      vapiRef.current = vapi;

      vapi.on("call-start", () => setCallStatus("active"));
      vapi.on("call-end", () => setCallStatus("ended"));
      vapi.on("error", () => {
        setError("Call failed");
        setCallStatus("idle");
      });

      await vapi.start(business.vapi_assistant_id);
    } catch {
      setError("Failed to start call");
      setCallStatus("idle");
    }
  }, [business]);

  const endCall = useCallback(() => {
    vapiRef.current?.stop();
    setCallStatus("ended");
  }, []);

  if (loading) {
    return (
      <main className="flex-1 flex items-center justify-center">
        <span className="font-mono text-sm text-muted-foreground tracking-widest uppercase">
          LOADING...
        </span>
      </main>
    );
  }

  if (error && !business) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center gap-6">
        <p className="text-coral font-mono text-sm">{error}</p>
        <a
          href="/"
          className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          &larr; BACK
        </a>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-20">
      <div className="w-full max-w-md flex flex-col items-center text-center space-y-10">
        {/* Business name & status */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tighter uppercase">
            {business?.name}
          </h1>
          <div className="flex items-center justify-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            <span className="w-2 h-2 bg-green" />
            AI AGENT · LIVE
          </div>
        </div>

        {/* Business info summary */}
        {business && (
          <div className="w-full border border-foreground bg-white p-5 text-left space-y-2">
            {business.services.length > 0 && (
              <div className="font-mono text-sm">
                <span className="text-muted-foreground uppercase">SERVICES:</span>{" "}
                {business.services.slice(0, 5).join(" · ")}
              </div>
            )}
            {business.hours && (
              <div className="font-mono text-sm">
                <span className="text-muted-foreground uppercase">HOURS:</span>{" "}
                {business.hours}
              </div>
            )}
            {business.location && (
              <div className="font-mono text-sm">
                <span className="text-muted-foreground uppercase">LOCATION:</span>{" "}
                {business.location}
              </div>
            )}
          </div>
        )}

        {/* Call controls */}
        {callStatus === "idle" && (
          <button
            onClick={startCall}
            className="w-full bg-coral text-black font-bold tracking-wider px-8 py-5 font-mono text-sm uppercase hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer animate-fade-up"
          >
            SPEAK WITH AGENT
          </button>
        )}

        {callStatus === "connecting" && (
          <div className="space-y-4 animate-fade-up">
            <div className="flex items-center justify-center gap-3 font-mono text-sm text-muted-foreground">
              <span className="w-2 h-2 bg-coral animate-pulse" />
              CONNECTING...
            </div>
          </div>
        )}

        {callStatus === "active" && (
          <div className="space-y-8 animate-fade-up">
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex items-center justify-center">
                <span className="absolute w-8 h-8 bg-green/30 animate-pulse-ring" />
                <span className="absolute w-5 h-5 bg-green/50 animate-pulse" />
                <span className="relative w-3 h-3 bg-green" />
              </div>
              <span className="font-mono text-sm text-green tracking-[0.3em] uppercase">
                CONNECTED
              </span>
            </div>

            <button
              onClick={endCall}
              className="w-full border border-foreground text-muted-foreground font-bold tracking-wider px-8 py-4 font-mono text-sm uppercase hover:text-foreground transition-all cursor-pointer"
            >
              END CALL
            </button>
          </div>
        )}

        {callStatus === "ended" && (
          <div className="space-y-6 animate-fade-up">
            <div className="flex items-center justify-center gap-3 font-mono text-sm text-muted-foreground uppercase tracking-widest">
              CALL COMPLETE
            </div>

            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={() => setCallStatus("idle")}
                className="w-full bg-coral text-black font-bold tracking-wider px-8 py-4 font-mono text-sm uppercase hover:brightness-110 transition-all cursor-pointer"
              >
                CALL AGAIN
              </button>
              <a
                href="/dashboard"
                className="inline-flex items-center justify-center border border-foreground text-muted-foreground font-bold tracking-wider px-8 py-4 font-mono text-sm uppercase hover:text-foreground transition-all"
              >
                VIEW DASHBOARD
              </a>
            </div>
          </div>
        )}

        {error && callStatus !== "idle" && (
          <p className="text-coral font-mono text-sm">{error}</p>
        )}

        <a
          href="/"
          className="font-mono text-xs text-muted-foreground tracking-widest uppercase hover:text-foreground transition-colors"
        >
          &larr; DIALTONE
        </a>
      </div>
    </main>
  );
}
