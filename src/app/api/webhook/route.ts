import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Look up business from assistant ID
async function resolveBusinessId(body: Record<string, unknown>): Promise<string | null> {
  // Try from message.call.assistantId (tool calls and end-of-call)
  const msg = body.message as Record<string, unknown> | undefined;
  const call = msg?.call as Record<string, unknown> | undefined;
  const assistantId = call?.assistantId as string | undefined;

  if (assistantId) {
    const { data } = await getSupabaseAdmin()
      .from("businesses")
      .select("id")
      .eq("vapi_assistant_id", assistantId)
      .single();
    if (data) return data.id;
  }

  // Fallback: try _business_id from tool args
  const fc = msg?.functionCall as Record<string, unknown> | undefined;
  const params = fc?.parameters as Record<string, string> | undefined;
  if (params?._business_id) return params._business_id;

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;
    const msgType = message?.type;

    console.log("WEBHOOK:", msgType, JSON.stringify(body).slice(0, 300));

    // Resolve business for all event types
    const businessId = await resolveBusinessId(body);

    // --- Tool calls ---
    if (msgType === "function-call") {
      const fc = message.functionCall;
      const name = fc?.name;
      const args = fc?.parameters || {};

      console.log(`TOOL: ${name}`, JSON.stringify(args));

      if (name === "book_reservation") return await handleBook(businessId, args);
      if (name === "cancel_reservation") return await handleCancel(businessId, args);
      if (name === "reschedule_reservation") return await handleReschedule(businessId, args);
      if (name === "add_inquiry") return await handleInquiry(businessId, args);

      return NextResponse.json({ results: [{ result: "Done." }] });
    }

    // --- End of call report ---
    if (msgType === "end-of-call-report") {
      const { call, transcript, summary, endedReason } = message;

      let transcriptText: string | null = null;
      if (typeof transcript === "string") {
        transcriptText = transcript;
      } else if (Array.isArray(transcript)) {
        transcriptText = transcript
          .map((m: { role: string; content: string }) => `${m.role}: ${m.content}`)
          .join("\n");
      }

      const callData = {
        business_id: businessId,
        transcript: transcriptText,
        summary: summary || null,
        duration_seconds: call?.duration ? Math.round(call.duration) : null,
        outcome: endedReason || null,
        caller_type: call?.customer?.number ? "phone" : "browser",
      };

      console.log("INSERT CALL:", JSON.stringify(callData));

      const { data, error } = await getSupabaseAdmin()
        .from("calls")
        .insert(callData)
        .select()
        .single();

      if (error) {
        console.error("CALL INSERT ERROR:", JSON.stringify(error));
        // Try without business_id as fallback
        const { data: d2, error: e2 } = await getSupabaseAdmin()
          .from("calls")
          .insert({ ...callData, business_id: null })
          .select()
          .single();
        if (e2) {
          console.error("CALL INSERT ERROR (no biz):", JSON.stringify(e2));
          return NextResponse.json({ error: "Failed to store call" }, { status: 500 });
        }
        return NextResponse.json({ call: d2 });
      }

      return NextResponse.json({ call: data });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("WEBHOOK CRASH:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// --- Tool handlers ---

async function handleBook(businessId: string | null, args: Record<string, string>) {
  const { customer_name, customer_phone, service, date, time, notes } = args;

  const { data, error } = await getSupabaseAdmin()
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name: customer_name || "Unknown",
      customer_phone: customer_phone || null,
      service: service || null,
      date: date || "TBD",
      time: time || "TBD",
      notes: notes || null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    console.error("BOOK ERROR:", JSON.stringify(error));
    return NextResponse.json({
      results: [{ result: "I've noted the booking request. Someone will confirm shortly." }],
    });
  }

  const svc = service ? ` for ${service}` : "";
  return NextResponse.json({
    results: [{
      result: `Booking confirmed! ${customer_name} is booked${svc} on ${date} at ${time}. Confirmation ID: ${data.id.slice(0, 8).toUpperCase()}.`,
    }],
  });
}

async function handleCancel(businessId: string | null, args: Record<string, string>) {
  const { customer_name, customer_phone, date } = args;

  let query = getSupabaseAdmin()
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .ilike("customer_name", `%${customer_name}%`);

  if (businessId) query = query.eq("business_id", businessId);
  if (date) query = query.eq("date", date);
  if (customer_phone) query = query.eq("customer_phone", customer_phone);

  const { data: bookings } = await query.order("created_at", { ascending: false }).limit(1);

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({
      results: [{ result: `I couldn't find an active booking for ${customer_name}. Could you double-check the name or date?` }],
    });
  }

  const booking = bookings[0];
  await getSupabaseAdmin()
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  return NextResponse.json({
    results: [{
      result: `The ${booking.service || "booking"} for ${customer_name} on ${booking.date} at ${booking.time} has been cancelled.`,
    }],
  });
}

async function handleReschedule(businessId: string | null, args: Record<string, string>) {
  const { customer_name, customer_phone, new_date, new_time } = args;

  let query = getSupabaseAdmin()
    .from("bookings")
    .select("*")
    .eq("status", "confirmed")
    .ilike("customer_name", `%${customer_name}%`);

  if (businessId) query = query.eq("business_id", businessId);
  if (customer_phone) query = query.eq("customer_phone", customer_phone);

  const { data: bookings } = await query.order("created_at", { ascending: false }).limit(1);

  if (!bookings || bookings.length === 0) {
    return NextResponse.json({
      results: [{ result: `I couldn't find an active booking for ${customer_name}.` }],
    });
  }

  const booking = bookings[0];

  await getSupabaseAdmin()
    .from("bookings")
    .update({ status: "rescheduled", updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  const { data: newBooking, error } = await getSupabaseAdmin()
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name,
      customer_phone: booking.customer_phone,
      service: booking.service,
      date: new_date,
      time: new_time,
      notes: `Rescheduled from ${booking.date} ${booking.time}`,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({
      results: [{ result: "Sorry, I couldn't reschedule right now." }],
    });
  }

  return NextResponse.json({
    results: [{
      result: `Rescheduled! Moved from ${booking.date} ${booking.time} to ${new_date} at ${new_time}. New confirmation: ${newBooking.id.slice(0, 8).toUpperCase()}.`,
    }],
  });
}

async function handleInquiry(businessId: string | null, args: Record<string, string>) {
  const { customer_name, customer_phone, question, notes } = args;

  await getSupabaseAdmin()
    .from("inquiries")
    .insert({
      business_id: businessId,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      question: question || "General inquiry",
      notes: notes || null,
    });

  return NextResponse.json({
    results: [{ result: "I've logged your question. The team will get back to you." }],
  });
}
