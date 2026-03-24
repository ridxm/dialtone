# DIALTONE

Universal voice AI agent platform. Paste a business website URL,
AI crawls it, spins up a voice agent in 30 seconds.

## Stack
- Next.js 15 App Router, TypeScript
- Vapi (voice agent creation + Web SDK)
- Cartesia (voice provider)
- Cheerio (web scraping)
- Supabase (Postgres + Realtime)
- Tailwind + shadcn/ui

## Design Direction
Industrial brutalist. Same aesthetic as ANSR.
- Background: #1A1A1A
- Surface: #2A2A2A
- Cream text: #F5F0E8
- Coral accent: #E85D3A
- Monospace: JetBrains Mono / Consolas
- No rounded corners
- Thin borders (1px #333)
- Uppercase monospace labels

## Key Files
- /src/app/api/crawl/route.ts — scrapes URL with cheerio
- /src/app/api/create-agent/route.ts — creates Vapi assistant
- /src/app/api/webhook/route.ts — receives Vapi call data
- /src/app/page.tsx — landing page with URL input
- /src/app/dashboard/page.tsx — live call feed
- /src/app/call/[id]/page.tsx — browser call interface

## Rules
- No rounded corners anywhere
- All labels uppercase monospace
- Coral (#E85D3A) for CTAs and status badges
- Cream (#F5F0E8) for primary text on dark backgrounds
- Animate new call cards in from top
```

---