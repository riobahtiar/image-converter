/**
 * Honeypot Endpoint: Fake Batch Convert
 *
 * This endpoint doesn't exist in the real app.
 * Only bots scraping for endpoints would access it.
 * Accessing this automatically flags the user as a bot.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { blockIdentifier } from "@/lib/security/blocker";

export async function POST(request: Request) {
  console.warn("[HONEYPOT] Batch convert endpoint accessed - likely bot");

  try {
    // Get session and IP
    const session = await getSession();
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    // Log the attempt
    console.warn("[HONEYPOT] Bot detected", {
      sessionId: session.sessionId,
      ip,
      endpoint: "/api/honeypot/batch-convert",
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    // Block this identifier
    await blockIdentifier(session.sessionId, "honeypot:batch-convert", 24 * 60 * 60); // 24 hours

    // Return fake response to not reveal it's a trap
    return NextResponse.json(
      {
        error: "Feature not available",
        message: "Batch convert is a premium feature",
      },
      { status: 403 }
    );
  } catch (error) {
    console.error("[HONEYPOT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
