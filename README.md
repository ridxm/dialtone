# DIALTONE

**Paste a website. Get an AI phone agent in 30 seconds.**

Dialtone is a universal voice AI platform that turns any business website into a fully functional AI phone receptionist. No setup, no configuration, no training data needed — just a URL.

## What It Does

A business owner pastes their website URL into Dialtone. Our platform crawls the site, uses LLM-powered extraction to understand everything about the business — menu items with prices, hours, location, policies — and instantly spins up a voice AI agent that can answer phone calls on their behalf.

The agent doesn't just talk. It **acts**. It can book reservations, take orders, cancel appointments, reschedule, and log customer inquiries — all in real-time, all through natural voice conversation.

A live dashboard lets the business owner monitor every call, booking, and inquiry as it happens.

## How It Works

1. **Intelligent Web Scraping** — We crawl the business website and pass the raw content through GPT-4o to extract structured data: business name, type, services with pricing, hours, location, and policies. No regex hacking or brittle CSS selectors — the LLM understands context and pulls real menu items, not marketing copy.

2. **Industry-Aware Agent Generation** — Based on the extracted business type (bakery, restaurant, salon, dental office, etc.), we dynamically generate a system prompt with industry-appropriate language. A bakery agent talks about "orders" and "customers." A salon agent talks about "appointments" and "clients." A restaurant agent talks about "reservations" and "guests." The voice, tone, and vocabulary adapt automatically.

3. **Real-Time Voice Conversations** — Powered by Vapi's voice infrastructure with ElevenLabs for natural-sounding speech and Claude Sonnet for intelligence. The agent handles multi-turn conversations, asks clarifying questions, confirms details before taking action, and speaks like a real employee — not a chatbot reading a script.

4. **Live Tool Execution** — During a phone call, the agent can execute real actions through function calling: book a reservation, cancel an existing one, reschedule to a new time, or log a customer inquiry. Every action is immediately written to the database and appears on the dashboard in real-time.

5. **Adaptive Live Dashboard** — The owner dashboard subscribes to Supabase Realtime and updates instantly as calls come in, bookings are made, and inquiries are logged. The dashboard adapts its labels and categories to the business type — a bakery sees "Orders" and "Inquiries," while a dental office sees "Appointments" and "Inquiries."

## Features

- **30-second setup** — URL in, voice agent out
- **LLM-powered data extraction** — understands websites the way a human would
- **Industry-adaptive agents** — automatically adjusts language for 12+ business types
- **Voice-first actions** — book, cancel, reschedule, inquire — all through natural conversation
- **Real phone number** — agent answers actual phone calls, not just browser demos
- **Browser calling** — also supports in-browser voice calls via Vapi Web SDK
- **Live monitoring dashboard** — real-time feed of calls, bookings, and inquiries with Supabase Realtime
- **Structured data output** — every interaction produces clean, queryable records

## Built With

- **Next.js 16** — App Router, server actions, API routes
- **Vapi** — Voice AI infrastructure, phone numbers, Web SDK
- **ElevenLabs** — Natural voice synthesis (custom voice)
- **Claude Sonnet** — Conversational intelligence and function calling
- **GPT-4o Mini** — Web content extraction and structuring
- **Supabase** — Postgres database with Realtime subscriptions
- **Cheerio** — HTML preprocessing before LLM extraction
- **Tailwind CSS + shadcn/ui** — Industrial brutalist UI design
