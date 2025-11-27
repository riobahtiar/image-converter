import { randomBytes } from "node:crypto";
import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Session data structure
 * Stores user session information for file isolation
 */
export interface SessionData {
  /** Unique session identifier */
  sessionId: string;
  /** Timestamp when session was created */
  createdAt: number;
  /** Timestamp of last activity */
  lastActivity: number;
}

/**
 * Session configuration
 * Uses iron-session for encrypted, stateless cookie-based sessions
 */
const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET as string,
  cookieName: "imgconv_session",
  cookieOptions: {
    httpOnly: true, // Prevent XSS attacks
    secure: process.env.NODE_ENV === "production", // HTTPS only in production
    sameSite: "lax", // CSRF protection
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  },
  ttl: 60 * 60 * 24, // 24 hours TTL
};

/**
 * Get or create a user session
 * Automatically creates session on first visit
 *
 * @returns Session object with sessionId and metadata
 * @throws Error if SESSION_SECRET is not configured
 */
export async function getSession() {
  if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET is not configured. Please set it in your .env file.");
  }

  if (process.env.SESSION_SECRET.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long for security.");
  }

  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  // Initialize session if it doesn't exist
  if (!session.sessionId) {
    session.sessionId = generateSessionId();
    session.createdAt = Date.now();
    session.lastActivity = Date.now();
    await session.save();
  }

  // Update last activity timestamp
  session.lastActivity = Date.now();
  await session.save();

  return session;
}

/**
 * Generate a cryptographically secure session ID
 *
 * @returns Base64url-encoded random session ID (32 bytes)
 * @example
 * const sessionId = generateSessionId();
 * // Returns: "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0"
 */
export function generateSessionId(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * Destroy a user session
 * Clears session data and removes cookie
 *
 * @returns Promise that resolves when session is destroyed
 */
export async function destroySession() {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);
  session.destroy();
}

/**
 * Check if session is expired (older than 24 hours with no activity)
 *
 * @param session - Session object to check
 * @returns True if session is expired
 */
export function isSessionExpired(session: SessionData): boolean {
  const now = Date.now();
  const maxAge = 60 * 60 * 24 * 1000; // 24 hours in milliseconds
  return now - session.lastActivity > maxAge;
}
