/**
 * Honeypot Endpoint: Fake Admin Panel
 *
 * This endpoint doesn't exist.
 * Scanner bots looking for admin panels will trigger this.
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { blockIdentifier } from "@/lib/security/blocker";

export async function GET(request: Request) {
  console.warn("[HONEYPOT] Admin panel accessed - likely scanner bot");

  try {
    const session = await getSession();
    const ip = request.headers.get("x-forwarded-for") || "unknown";

    console.warn("[HONEYPOT] Scanner detected", {
      sessionId: session.sessionId,
      ip,
      endpoint: "/api/honeypot/admin",
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString(),
    });

    // Block for 48 hours (more severe for admin scanning)
    await blockIdentifier(session.sessionId, "honeypot:admin", 48 * 60 * 60);

    // Return fake 404 to not reveal it's a trap
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("[HONEYPOT] Error:", error);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}

export async function POST(request: Request) {
  return GET(request);
}
