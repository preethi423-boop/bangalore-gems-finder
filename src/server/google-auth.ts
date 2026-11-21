import { randomBytes } from "node:crypto";
import mysql, { type Pool, type ResultSetHeader, type RowDataPacket } from "mysql2/promise";
import { createRemoteJWKSet, jwtVerify } from "jose";

export type AuthUser = {
  id: number;
  email: string;
  name: string | null;
  picture_url: string | null;
};

type UserRow = RowDataPacket & AuthUser;

let pool: Pool | undefined;
const googleKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function getPool(): Pool {
  if (!pool) {
    pool = mysql.createPool({
      host: requiredEnv("DB_HOST"),
      port: Number(process.env.DB_PORT || 3306),
      database: requiredEnv("DB_NAME"),
      user: requiredEnv("DB_USER"),
      password: requiredEnv("DB_PASSWORD"),
      waitForConnections: true,
      connectionLimit: 5,
      charset: "utf8mb4",
    });
  }
  return pool;
}

function redirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || "https://dev.godinexus.com/api/auth/google/callback";
}

export function createState(): string {
  return randomBytes(32).toString("hex");
}

export function createSessionId(): string {
  return randomBytes(32).toString("hex");
}

export function getGoogleAuthorizationUrl(state: string): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", requiredEnv("GOOGLE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("access_type", "online");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function authenticateGoogleCode(code: string): Promise<{ user: AuthUser; sessionId: string }> {
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) throw new Error("Google token exchange failed");
  const tokens = (await tokenResponse.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error("Google did not return an ID token");

  const { payload } = await jwtVerify(tokens.id_token, googleKeys, {
    audience: requiredEnv("GOOGLE_CLIENT_ID"),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });

  if (!payload.sub || typeof payload.email !== "string" || payload.email_verified !== true) {
    throw new Error("Google account email is not verified");
  }

  const db = getPool();
  const [result] = await db.execute<ResultSetHeader>(
    `INSERT INTO users (google_sub, email, name, picture_url)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       email = VALUES(email),
       name = VALUES(name),
       picture_url = VALUES(picture_url),
       id = LAST_INSERT_ID(id)`,
    [payload.sub, payload.email, typeof payload.name === "string" ? payload.name : null, typeof payload.picture === "string" ? payload.picture : null],
  );

  const userId = Number(result.insertId);
  const sessionId = createSessionId();
  await db.execute(
    "INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))",
    [sessionId, userId],
  );

  return {
    user: {
      id: userId,
      email: payload.email,
      name: typeof payload.name === "string" ? payload.name : null,
      picture_url: typeof payload.picture === "string" ? payload.picture : null,
    },
    sessionId,
  };
}

export function readCookie(request: Request, name: string): string | undefined {
  const header = request.headers.get("cookie") || "";
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

export function serializeCookie(name: string, value: string, options: { maxAge: number; path?: string; secure?: boolean }): string {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Max-Age=${options.maxAge}`,
    `Path=${options.path || "/"}`,
    "HttpOnly",
    "SameSite=Lax",
    options.secure === false ? "" : "Secure",
  ].filter(Boolean).join("; ");
}

export async function getSessionUser(sessionId: string | undefined): Promise<AuthUser | null> {
  if (!sessionId) return null;
  const [rows] = await getPool().execute<UserRow[]>(
    `SELECT u.id, u.email, u.name, u.picture_url
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [sessionId],
  );
  return rows[0] || null;
}

export async function deleteSession(sessionId: string | undefined): Promise<void> {
  if (sessionId) await getPool().execute("DELETE FROM sessions WHERE id = ?", [sessionId]);
}

export function safeReturnTo(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}
