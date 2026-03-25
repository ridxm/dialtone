import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { Business, BusinessType, BUSINESS_TYPE_CONFIG } from "@/lib/types";
import { BUSINESS_TYPE_CONFIG as CONFIG } from "@/lib/types";

const VAPI_API_KEY = process.env.VAPI_API_KEY!;

function buildSystemPrompt(business: Business): string {
  const btype = (business.business_type || "other") as BusinessType;
  const config = CONFIG[btype] || CONFIG.other;

  const rawHtml =
    typeof business.raw_html === "string"
      ? JSON.parse(business.raw_html)
      : business.raw_html;

  const desc = rawHtml?.description as string | undefined;
  const parts: string[] = [];

  // Identity
  parts.push(
    `You are the AI phone receptionist for ${business.name}. You speak as if you work there — say "we" and "our", never "they" or "the business".`
  );
  if (desc) parts.push(`About us: ${desc}`);

  // Role
  parts.push(config.bookingPrompt);

  // Business details
  const details: string[] = [];
  if (business.location) details.push(`Our location: ${business.location}`);
  if (business.hours) details.push(`Our hours: ${business.hours}`);
  if (rawHtml?.phone) details.push(`Our phone: ${rawHtml.phone}`);
  if (business.services.length > 0) {
    details.push(`What we offer:\n${business.services.slice(0, 20).map((s) => `  - ${s}`).join("\n")}`);
  }
  if (business.pricing) details.push(`Pricing: ${business.pricing}`);
  if (business.policies) details.push(`Our policies: ${business.policies}`);

  if (details.length > 0) {
    parts.push(`BUSINESS INFO:\n${details.join("\n")}`);
  }

  // Behavior
  const bw = config.bookingLabel.toLowerCase();
  parts.push(`HOW TO BEHAVE:
- You're on a PHONE CALL. Keep every response to 1-2 short sentences max. Be warm but brief.
- Never read out full lists. If asked about our menu/services, mention 2-3 highlights and ask what they're interested in.
- Never say "according to our records" or "based on the information I have". Just answer naturally.
- When a ${config.customerWord} wants to book a ${bw}, collect: their name, what they want, and when. Then use the book_reservation tool.
- When they want to cancel, get their name and use cancel_reservation.
- When they want to reschedule, get their name and the new date/time, then use reschedule_reservation.
- For general questions or feedback, use add_inquiry to log it.
- Confirm details before executing any tool: "So that's [name] for [service] on [date] at [time], does that sound right?"
- If you don't know something, say "I'm not sure about that — you can check our website at ${business.url} or I can have someone follow up with you."
- NEVER make up information. If we don't have hours listed, say "I don't have our exact hours right now."
- Do NOT repeat the same information twice. If you've already mentioned something, move the conversation forward.`);

  return parts.join("\n\n");
}

function buildTools(businessId: string) {
  return [
    {
      type: "function" as const,
      function: {
        name: "book_reservation",
        description:
          "Book a new reservation, appointment, order, or class for a customer.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Full name of the customer" },
            customer_phone: { type: "string", description: "Customer phone number if provided" },
            service: { type: "string", description: "The service, item, or type of appointment being booked" },
            date: { type: "string", description: "Date for the booking" },
            time: { type: "string", description: "Time for the booking" },
            notes: { type: "string", description: "Any additional notes or special requests" },
            _business_id: { type: "string", description: "Internal", default: businessId },
          },
          required: ["customer_name", "date", "time"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "cancel_reservation",
        description: "Cancel an existing reservation or appointment.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Name of the customer" },
            customer_phone: { type: "string", description: "Phone number to look up the booking" },
            date: { type: "string", description: "Date of the booking to cancel" },
            reason: { type: "string", description: "Reason for cancellation" },
            _business_id: { type: "string", description: "Internal", default: businessId },
          },
          required: ["customer_name"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "reschedule_reservation",
        description: "Reschedule an existing reservation to a new date/time.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Name of the customer" },
            customer_phone: { type: "string", description: "Phone number" },
            new_date: { type: "string", description: "New date" },
            new_time: { type: "string", description: "New time" },
            _business_id: { type: "string", description: "Internal", default: businessId },
          },
          required: ["customer_name", "new_date", "new_time"],
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "add_inquiry",
        description: "Log a customer question, complaint, or feedback.",
        parameters: {
          type: "object",
          properties: {
            customer_name: { type: "string", description: "Name of the caller" },
            customer_phone: { type: "string", description: "Phone number" },
            question: { type: "string", description: "The question or feedback" },
            notes: { type: "string", description: "Additional context" },
            _business_id: { type: "string", description: "Internal", default: businessId },
          },
          required: ["question"],
        },
      },
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { businessId, businessData } = body;

    let business: Business;

    if (businessData) {
      business = businessData as Business;
    } else if (businessId) {
      const { data, error: fetchError } = await getSupabaseAdmin()
        .from("businesses")
        .select("*")
        .eq("id", businessId)
        .single();

      if (fetchError || !data) {
        return NextResponse.json({ error: "Business not found" }, { status: 404 });
      }
      business = data as Business;
    } else {
      return NextResponse.json(
        { error: "businessId or businessData is required" },
        { status: 400 }
      );
    }

    const systemPrompt = buildSystemPrompt(business);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.WEBHOOK_URL || req.nextUrl.origin;
    const btype = (business.business_type || "other") as BusinessType;
    const config = CONFIG[btype] || CONFIG.other;
    const assistantName = `${business.name} Receptionist`.slice(0, 40);

    const vapiResponse = await fetch("https://api.vapi.ai/assistant", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: assistantName,
        model: {
          provider: "anthropic",
          model: "claude-sonnet-4-20250514",
          messages: [{ role: "system", content: systemPrompt }],
          tools: buildTools(business.id),
        },
        voice: {
          provider: "11labs",
          voiceId: "7EzWGsX10sAS4c9m9cPf",
          model: "eleven_turbo_v2_5",
        },
        firstMessage: `Hi, ${config.greeting}`,
        endCallMessage: "Thanks for calling! Have a great day.",
        serverUrl: `${appUrl}/api/webhook`,
        silenceTimeoutSeconds: 30,
        backchannelingEnabled: true,
        backgroundDenoisingEnabled: true,
      }),
    });

    if (!vapiResponse.ok) {
      const errBody = await vapiResponse.text();
      console.error("Vapi API error:", errBody);
      return NextResponse.json(
        { error: "Failed to create Vapi assistant", details: errBody },
        { status: 502 }
      );
    }

    const assistant = await vapiResponse.json();

    // Attach to phone number
    const PHONE_NUMBER_ID = "fc401cc4-3b21-4c3e-b36f-735f363a70d5";
    await fetch(`https://api.vapi.ai/phone-number/${PHONE_NUMBER_ID}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${VAPI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ assistantId: assistant.id }),
    });

    // Store assistant ID
    if (business.id) {
      await getSupabaseAdmin()
        .from("businesses")
        .update({ vapi_assistant_id: assistant.id })
        .eq("id", business.id);
    }

    return NextResponse.json({
      assistantId: assistant.id,
      businessId: business.id,
    });
  } catch (err) {
    console.error("Create agent error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
