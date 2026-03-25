import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";
import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/supabase";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { url } = await req.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    // Step 1: Fetch the page HTML
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status}` },
        { status: 422 }
      );
    }

    const html = await response.text();

    // Step 2: Pre-process HTML to reduce token count — strip scripts, styles, keep text content
    const $ = cheerio.load(html);
    $("script, style, noscript, iframe, svg, img, video, audio, link, meta[http-equiv]").remove();

    // Get a text-heavy version: the title, meta descriptions, and body text
    const title = $("title").text().trim();
    const metaDesc = $('meta[name="description"]').attr("content") || "";
    const ogTitle = $('meta[property="og:title"]').attr("content") || "";
    const ogDesc = $('meta[property="og:description"]').attr("content") || "";

    // Get structured text from the body, preserving some structure
    const bodyText = $("body").text().replace(/\s+/g, " ").trim();
    // Truncate to ~6000 chars to stay within token limits
    const truncatedBody = bodyText.slice(0, 6000);

    const pageContext = [
      `URL: ${url}`,
      `Title: ${title}`,
      ogTitle ? `OG Title: ${ogTitle}` : "",
      metaDesc ? `Meta Description: ${metaDesc}` : "",
      ogDesc ? `OG Description: ${ogDesc}` : "",
      `Page Content:\n${truncatedBody}`,
    ].filter(Boolean).join("\n");

    // Step 3: LLM extraction
    const prompt = `Extract structured business data from this website content. Return ONLY valid JSON, no markdown or explanation.

${pageContext}

Return this exact JSON structure:
{
  "name": "business name (clean, no taglines or trademark symbols)",
  "business_type": "one of: bakery, restaurant, cafe, salon, barbershop, spa, dental, medical, fitness, retail, professional, other",
  "services": ["actual menu items or services with prices if available, e.g. 'Chocolate Chip Cookie - $4.50', 'Classic Haircut - $30'"],
  "hours": "business hours if found, or null",
  "location": "full address if found, or null",
  "phone": "phone number if found, or null",
  "pricing": "general pricing info or price range, or null",
  "policies": "return/cancellation/booking policies if found, or null",
  "description": "1-2 sentence description of what this business does"
}

IMPORTANT:
- For services: extract ACTUAL products/services/menu items, NOT marketing taglines like "Made in NYC" or "Baked Fresh Daily"
- Include prices next to services when visible (e.g. "Chocolate Chip Walnut Cookie - $4.50")
- If you can't find specific services, describe what they offer based on context
- business_type must be exactly one of the listed options`;

    const llmResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    });

    // Parse LLM response
    const llmText = llmResponse.choices[0]?.message?.content || "";
    let extracted: {
      name: string;
      business_type: string;
      services: string[];
      hours: string | null;
      location: string | null;
      phone: string | null;
      pricing: string | null;
      policies: string | null;
      description: string | null;
    };

    try {
      // Strip markdown code fences if present
      const jsonStr = llmText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      extracted = JSON.parse(jsonStr);
    } catch {
      console.error("Failed to parse LLM response:", llmText);
      // Fallback to basic cheerio extraction
      extracted = {
        name: ogTitle || title.split(/[|–—]/)[0].trim() || "Unknown Business",
        business_type: "other",
        services: [],
        hours: null,
        location: null,
        phone: null,
        pricing: null,
        policies: null,
        description: metaDesc || ogDesc || null,
      };
    }

    const businessData = {
      name: extracted.name.replace(/[™®©️\ufe0f]/g, "").trim(),
      url,
      business_type: extracted.business_type || "other",
      services: extracted.services || [],
      hours: extracted.hours || null,
      location: extracted.location || null,
      pricing: extracted.pricing || null,
      policies: extracted.policies || null,
      raw_html: {
        description: extracted.description || metaDesc || ogDesc || null,
        phone: extracted.phone || null,
        serviceCount: (extracted.services || []).length,
      },
    };

    // Step 4: Store in Supabase
    try {
      const { data, error } = await getSupabaseAdmin()
        .from("businesses")
        .insert(businessData)
        .select()
        .single();

      if (error) {
        console.error("Supabase insert error:", error);
        return NextResponse.json({ business: businessData, stored: false });
      }

      return NextResponse.json({ business: data, stored: true });
    } catch {
      return NextResponse.json({ business: businessData, stored: false });
    }
  } catch (err) {
    console.error("Crawl error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
