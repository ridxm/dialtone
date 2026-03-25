"use client";

import { useCallback, useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Business, BusinessType, Call, Booking, Inquiry } from "@/lib/types";
import { BUSINESS_TYPE_CONFIG } from "@/lib/types";

export default function DashboardPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [business, setBusiness] = useState<Business | null>(null);
  const [loading, setLoading] = useState(true);
  const [newCallIds, setNewCallIds] = useState<Set<string>>(new Set());
  const [newBookingIds, setNewBookingIds] = useState<Set<string>>(new Set());
  const [newInquiryIds, setNewInquiryIds] = useState<Set<string>>(new Set());

  const btype = (business?.business_type || "other") as BusinessType;
  const config = BUSINESS_TYPE_CONFIG[btype] || BUSINESS_TYPE_CONFIG.other;

  useEffect(() => {
    async function load() {
      const sb = getSupabase();
      const [callsRes, bookingsRes, inquiriesRes, businessRes] = await Promise.all([
        sb.from("calls").select("*").order("created_at", { ascending: false }),
        sb.from("bookings").select("*").order("created_at", { ascending: false }),
        sb.from("inquiries").select("*").order("created_at", { ascending: false }),
        sb.from("businesses").select("*").order("created_at", { ascending: false }).limit(1).single(),
      ]);

      if (callsRes.data) setCalls(callsRes.data as Call[]);
      if (bookingsRes.data) setBookings(bookingsRes.data as Booking[]);
      if (inquiriesRes.data) setInquiries(inquiriesRes.data as Inquiry[]);
      if (businessRes.data) setBusiness(businessRes.data as Business);
      setLoading(false);
    }
    load();
  }, []);

  const flashNew = useCallback(
    (id: string, setter: React.Dispatch<React.SetStateAction<Set<string>>>) => {
      setter((prev) => new Set(prev).add(id));
      setTimeout(() => {
        setter((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 600);
    },
    []
  );

  useEffect(() => {
    const sb = getSupabase();
    const channel = sb
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "calls" }, (p) => {
        const row = p.new as Call;
        setCalls((prev) => [row, ...prev]);
        flashNew(row.id, setNewCallIds);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, (p) => {
        const row = p.new as Booking;
        setBookings((prev) => [row, ...prev]);
        flashNew(row.id, setNewBookingIds);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings" }, (p) => {
        const row = p.new as Booking;
        setBookings((prev) => prev.map((b) => (b.id === row.id ? row : b)));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "inquiries" }, (p) => {
        const row = p.new as Inquiry;
        setInquiries((prev) => [row, ...prev]);
        flashNew(row.id, setNewInquiryIds);
      })
      .subscribe();

    return () => {
      sb.removeChannel(channel);
    };
  }, [flashNew]);

  const totalCalls = calls.length;
  const confirmedBookings = bookings.filter((b) => b.status === "confirmed").length;
  const avgDuration =
    calls.length > 0
      ? Math.round(calls.reduce((sum, c) => sum + (c.duration_seconds ?? 0), 0) / calls.length)
      : 0;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-3 w-3 bg-coral animate-pulse" />
          <span className="font-mono text-xs uppercase tracking-widest text-muted-foreground">LOADING</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Status Bar */}
      <header className="w-full border-b border-foreground bg-cream px-6 py-3">
        <div className="flex items-center gap-6 font-mono text-xs uppercase tracking-widest flex-wrap">
          <a href="/" className="font-bold text-sm tracking-[0.3em] hover:text-coral transition-colors mr-4">
            DIALTONE
          </a>
          <span className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 bg-green" />
            <span>AGENT: <span className="font-bold text-green">LIVE</span></span>
          </span>
          <Sep />
          <span>CALLS: <span className="font-bold text-coral">{totalCalls}</span></span>
          <Sep />
          <span>{config.bookingLabelPlural}: <span className="font-bold text-coral">{confirmedBookings}</span></span>
          <Sep />
          <span>AVG DURATION: <span className="font-bold">{fmtDuration(avgDuration)}</span></span>
          {business && (
            <>
              <Sep />
              <span>BUSINESS: <span className="font-bold">{business.name}</span></span>
            </>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          {/* Left: Activity Feed */}
          <div className="space-y-6">
            {/* Bookings / Orders / Reservations / Appointments */}
            <section>
              <SectionHeader title={config.bookingLabelPlural} count={confirmedBookings} />
              {bookings.length === 0 ? (
                <EmptyState label={`NO ${config.bookingLabelPlural} YET`} />
              ) : (
                <div className="flex flex-col gap-3">
                  {bookings.map((b) => (
                    <BookingCard key={b.id} booking={b} isNew={newBookingIds.has(b.id)} label={config.bookingLabel} />
                  ))}
                </div>
              )}
            </section>

            {/* Inquiries */}
            <section>
              <SectionHeader title="INQUIRIES" count={inquiries.length} />
              {inquiries.length === 0 ? (
                <EmptyState label="NO INQUIRIES YET" />
              ) : (
                <div className="flex flex-col gap-3">
                  {inquiries.map((inq) => (
                    <InquiryCard key={inq.id} inquiry={inq} isNew={newInquiryIds.has(inq.id)} />
                  ))}
                </div>
              )}
            </section>

            {/* Calls */}
            <section>
              <SectionHeader title="CALL LOG" count={totalCalls} />
              {calls.length === 0 ? (
                <EmptyState label="WAITING FOR CALLS" />
              ) : (
                <div className="flex flex-col gap-3">
                  {calls.map((call) => (
                    <CallCard key={call.id} call={call} isNew={newCallIds.has(call.id)} bookingLabel={config.bookingLabel} />
                  ))}
                </div>
              )}
            </section>
          </div>

          {/* Right: Business Profile */}
          <aside>
            <h2 className="font-bold text-sm uppercase tracking-widest mb-4">BUSINESS</h2>
            <div className="sticky top-6">
              <BusinessPanel business={business} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

// --- Helpers ---

function Sep() {
  return <span className="text-muted-foreground">|</span>;
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <h2 className="font-bold text-sm uppercase tracking-widest">{title}</h2>
      {count > 0 && (
        <span className="bg-coral text-black font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
          {count}
        </span>
      )}
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="border border-foreground bg-white p-10 flex flex-col items-center justify-center">
      <div className="mb-3 h-2 w-2 bg-coral animate-pulse" />
      <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
    </div>
  );
}

// --- Booking Card ---

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green text-white",
  cancelled: "bg-foreground/10 text-muted-foreground",
  rescheduled: "bg-amber text-black",
};

function BookingCard({ booking, isNew, label }: { booking: Booking; isNew: boolean; label: string }) {
  const style = STATUS_STYLES[booking.status] || STATUS_STYLES.confirmed;

  return (
    <div className={`border border-foreground bg-white p-4 ${isNew ? "animate-slide-in" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${style}`}>
            {booking.status === "confirmed" ? label : booking.status}
          </span>
          <span className="font-bold text-sm">{booking.customer_name}</span>
        </div>
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(booking.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-4 font-mono text-xs mt-2">
        {booking.service && (
          <div>
            <span className="text-muted-foreground uppercase">SERVICE</span>
            <p className="text-foreground font-bold mt-0.5">{booking.service}</p>
          </div>
        )}
        <div>
          <span className="text-muted-foreground uppercase">DATE</span>
          <p className="text-foreground font-bold mt-0.5">{booking.date}</p>
        </div>
        <div>
          <span className="text-muted-foreground uppercase">TIME</span>
          <p className="text-foreground font-bold mt-0.5">{booking.time}</p>
        </div>
      </div>

      {booking.customer_phone && (
        <div className="font-mono text-xs text-muted-foreground mt-2">
          PHONE: <span className="text-coral">{booking.customer_phone}</span>
        </div>
      )}
      {booking.notes && <p className="text-xs text-muted-foreground mt-1">{booking.notes}</p>}
    </div>
  );
}

// --- Call Card ---

function inferIntent(call: Call, bookingLabel: string): { label: string; color: string } {
  const text = (call.summary || call.transcript || "").toLowerCase();
  if (text.includes("book") || text.includes("appointment") || text.includes("reserv") || text.includes("order"))
    return { label: bookingLabel, color: "bg-green text-white" };
  if (text.includes("cancel"))
    return { label: "CANCEL", color: "bg-foreground/80 text-white" };
  if (text.includes("reschedul"))
    return { label: "RESCHEDULE", color: "bg-amber text-black" };
  if (text.includes("price") || text.includes("cost") || text.includes("how much") || text.includes("?"))
    return { label: "QUESTION", color: "bg-foreground/10 text-foreground" };
  return { label: "CALL", color: "bg-foreground/10 text-muted-foreground" };
}

function CallCard({ call, isNew, bookingLabel }: { call: Call; isNew: boolean; bookingLabel: string }) {
  const intent = inferIntent(call, bookingLabel);
  const ts = new Date(call.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });

  return (
    <div className={`border border-foreground bg-white p-4 ${isNew ? "animate-slide-in" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 ${intent.color}`}>
          {intent.label}
        </span>
        <span className="font-mono text-xs text-muted-foreground">{ts}</span>
      </div>
      {call.summary && <p className="text-sm mb-2">{call.summary}</p>}
      {call.ended_reason && (
        <p className="font-mono text-xs text-muted-foreground mb-2 uppercase">{call.ended_reason}</p>
      )}
      <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
        <span>DURATION: <span className="text-foreground font-bold">{fmtDuration(call.duration_seconds ?? 0)}</span></span>
        <span>·</span>
        <span>{timeAgo(call.created_at)}</span>
        {call.caller_phone && (
          <>
            <span>·</span>
            <span className="text-coral">{call.caller_phone}</span>
          </>
        )}
      </div>
    </div>
  );
}

// --- Inquiry Card ---

function InquiryCard({ inquiry, isNew }: { inquiry: Inquiry; isNew: boolean }) {
  return (
    <div className={`border border-foreground bg-white p-4 ${isNew ? "animate-slide-in" : ""}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-foreground/10 text-foreground">
          INQUIRY
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {new Date(inquiry.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })}
        </span>
      </div>
      <p className="text-sm mb-2">{inquiry.question}</p>
      <div className="flex items-center gap-4 font-mono text-xs text-muted-foreground">
        {inquiry.customer_name && <span>FROM: <span className="text-foreground font-bold">{inquiry.customer_name}</span></span>}
        {inquiry.customer_phone && (
          <>
            <span>·</span>
            <span className="text-coral">{inquiry.customer_phone}</span>
          </>
        )}
      </div>
      {inquiry.notes && <p className="text-xs text-muted-foreground mt-1">{inquiry.notes}</p>}
    </div>
  );
}

// --- Business Panel ---

function BusinessPanel({ business }: { business: Business | null }) {
  if (!business) {
    return (
      <div className="border border-foreground border-dashed bg-white p-6">
        <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">NO BUSINESS CONNECTED</p>
      </div>
    );
  }

  return (
    <div className="border border-foreground bg-white p-5 space-y-4">
      <div>
        <h3 className="font-bold text-lg uppercase tracking-tight">{business.name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <p className="font-mono text-xs text-muted-foreground">{business.url}</p>
          {business.business_type && (
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 bg-coral text-black">
              {business.business_type}
            </span>
          )}
        </div>
      </div>
      <div className="border-t border-foreground/20" />
      {business.location && <Field label="LOCATION" value={business.location} />}
      {business.hours && <Field label="HOURS" value={business.hours} />}
      {business.services.length > 0 && (
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">SERVICES</span>
          <div className="mt-1 flex flex-col gap-1">
            {business.services.slice(0, 12).map((s, i) => (
              <span key={i} className="font-mono text-xs text-foreground">{s}</span>
            ))}
          </div>
        </div>
      )}
      {business.policies && <Field label="POLICIES" value={business.policies} />}
      <div className="border-t border-foreground/20" />
      {business.vapi_assistant_id && (
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">AGENT ID</span>
          <p className="font-mono text-xs mt-1 text-muted-foreground break-all">{business.vapi_assistant_id}</p>
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <p className="text-sm mt-1">{value}</p>
    </div>
  );
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s AGO`;
  if (diff < 3600) return `${Math.floor(diff / 60)} MIN AGO`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h AGO`;
  return new Date(dateStr).toLocaleDateString();
}
