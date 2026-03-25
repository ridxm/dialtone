import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;

    // --- Handle tool calls (function-call) ---
    if (message?.type === "function-call") {
      const { functionCall } = message;
      const name = functionCall?.name;
      const args = functionCall?.parameters || {};
      const businessId = args._business_id || null;

      console.log(`Tool call: ${name}`, JSON.stringify(args));

      if (name === "book_reservation") {
        return await handleBookReservation(businessId, args);
      }
      if (name === "cancel_reservation") {
        return await handleCancelReservation(businessId, args);
      }
      if (name === "reschedule_reservation") {
        return await handleRescheduleReservation(businessId, args);
      }
      if (name === "add_inquiry") {
        return await handleAddInquiry(businessId, args);
      }

      return NextResponse.json({ result: "Unknown function" });
    }

    // --- Handle end-of-call-report ---
    if (message?.type === "end-of-call-report") {
      const { call, transcript, summary, endedReason } = message;

      const assistantId = call?.assistantId;
      let businessId: string | null = null;

      if (assistantId) {
        const { data: business } = await getSupabaseAdmin()
          .from("businesses")
          .select("id")
          .eq("vapi_assistant_id", assistantId)
          .single();

        if (business) businessId = business.id;
      }

      let transcriptText: string | null = null;
      if (typeof transcript === "string") {
        transcriptText = transcript;
      } else if (Array.isArray(transcript)) {
        transcriptText = transcript
          .map((msg: { role: string; content: string }) => `${msg.role}: ${msg.content}`)
          .join("\n");
      }

      const { data, error } = await getSupabaseAdmin()
        .from("calls")
        .insert({
          business_id: businessId,
          vapi_call_id: call?.id || null,
          caller_phone: call?.customer?.number || null,
          transcript: transcriptText,
          summary: summary || null,
          duration_seconds: call?.duration ? Math.round(call.duration) : null,
          ended_reason: endedReason || null,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to insert call:", error);
        return NextResponse.json({ error: "Failed to store call data" }, { status: 500 });
      }

      return NextResponse.json({ call: data });
    }

    // All other events — acknowledge
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// --- Tool handlers ---

async function handleBookReservation(
  businessId: string | null,
  args: Record<string, string>
) {
  const { customer_name, customer_phone, service, date, time, notes } = args;

  const { data, error } = await getSupabaseAdmin()
    .from("bookings")
    .insert({
      business_id: businessId,
      customer_name,
      customer_phone: customer_phone || null,
      service: service || null,
      date,
      time,
      notes: notes || null,
      status: "confirmed",
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to book:", error);
    return NextResponse.json({
      results: [{ result: `Sorry, I couldn't complete the booking. Error: ${error.message}` }],
    });
  }

  const serviceStr = service ? ` for ${service}` : "";
  return NextResponse.json({
    results: [{
      result: `Booking confirmed! ${customer_name} is booked${serviceStr} on ${date} at ${time}. Confirmation ID: ${data.id.slice(0, 8).toUpperCase()}.`,
    }],
  });
}

async function handleCancelReservation(
  businessId: string | null,
  args: Record<string, string>
) {
  const { customer_name, customer_phone, date } = args;

  // Find the most recent matching booking
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
  const { error } = await getSupabaseAdmin()
    .from("bookings")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  if (error) {
    console.error("Failed to cancel:", error);
    return NextResponse.json({
      results: [{ result: "Sorry, I couldn't cancel the booking right now." }],
    });
  }

  return NextResponse.json({
    results: [{
      result: `The ${booking.service || "appointment"} for ${customer_name} on ${booking.date} at ${booking.time} has been cancelled.`,
    }],
  });
}

async function handleRescheduleReservation(
  businessId: string | null,
  args: Record<string, string>
) {
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
      results: [{ result: `I couldn't find an active booking for ${customer_name}. Could you double-check the name?` }],
    });
  }

  const booking = bookings[0];

  // Mark old as rescheduled
  await getSupabaseAdmin()
    .from("bookings")
    .update({ status: "rescheduled", updated_at: new Date().toISOString() })
    .eq("id", booking.id);

  // Create new booking
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
    console.error("Failed to reschedule:", error);
    return NextResponse.json({
      results: [{ result: "Sorry, I couldn't reschedule the booking right now." }],
    });
  }

  return NextResponse.json({
    results: [{
      result: `Rescheduled! ${customer_name}'s ${booking.service || "appointment"} has been moved from ${booking.date} ${booking.time} to ${new_date} at ${new_time}. New confirmation: ${newBooking.id.slice(0, 8).toUpperCase()}.`,
    }],
  });
}

async function handleAddInquiry(
  businessId: string | null,
  args: Record<string, string>
) {
  const { customer_name, customer_phone, question, notes } = args;

  const { error } = await getSupabaseAdmin()
    .from("inquiries")
    .insert({
      business_id: businessId,
      customer_name: customer_name || null,
      customer_phone: customer_phone || null,
      question,
      notes: notes || null,
    });

  if (error) {
    console.error("Failed to log inquiry:", error);
    return NextResponse.json({
      results: [{ result: "I've noted your question. The team will follow up." }],
    });
  }

  return NextResponse.json({
    results: [{ result: "I've logged your question. The team will get back to you." }],
  });
}
