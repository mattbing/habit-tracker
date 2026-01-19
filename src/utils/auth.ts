import type { User, Session } from "../types";

// 50k iterations is a reasonable balance for Cloudflare Workers CPU limits
// while still providing strong protection against brute force attacks
const PBKDF2_ITERATIONS = 50000;
const SALT_LENGTH = 16;
const HASH_LENGTH = 32;

/**
 * Hashes a password using PBKDF2-SHA256 with a random salt.
 *
 * Args:
 *   password: The plaintext password to hash.
 *
 * Returns:
 *   A string in the format "salt_hex:hash_hex" for storage.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    HASH_LENGTH * 8
  );

  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `${saltHex}:${hashHex}`;
}

/**
 * Verifies a password against a stored hash.
 *
 * Args:
 *   password: The plaintext password to verify.
 *   storedHash: The stored hash in "salt_hex:hash_hex" format.
 *
 * Returns:
 *   True if the password matches, false otherwise.
 */
export async function verifyPassword(
  password: string,
  storedHash: string
): Promise<boolean> {
  const parts = storedHash.split(":");

  // Handle legacy SHA-256 hashes (no salt, 64 char hex)
  if (parts.length === 1 && storedHash.length === 64) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashHex = Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return hashHex === storedHash;
  }

  if (parts.length !== 2) {
    return false;
  }

  const [saltHex, expectedHashHex] = parts;

  // Convert salt from hex to Uint8Array
  const salt = new Uint8Array(
    saltHex.match(/.{2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const encoder = new TextEncoder();
  const passwordKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: PBKDF2_ITERATIONS,
      hash: "SHA-256",
    },
    passwordKey,
    HASH_LENGTH * 8
  );

  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (hashHex.length !== expectedHashHex.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < hashHex.length; i++) {
    result |= hashHex.charCodeAt(i) ^ expectedHashHex.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Generates a cryptographically secure session ID.
 *
 * Returns:
 *   A 64-character hex string (32 bytes of entropy).
 */
export function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a new session for a user.
 *
 * Args:
 *   db: The D1 database instance.
 *   userId: The ID of the user to create a session for.
 *
 * Returns:
 *   The session ID string.
 */
export async function createSession(
  db: D1Database,
  userId: number
): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  await db
    .prepare("INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)")
    .bind(sessionId, userId, expiresAt)
    .run();

  return sessionId;
}

/**
 * Retrieves a valid session and its associated user.
 *
 * Args:
 *   db: The D1 database instance.
 *   sessionId: The session ID to look up.
 *
 * Returns:
 *   The session and user objects, or null if not found/expired.
 */
export async function getSession(
  db: D1Database,
  sessionId: string
): Promise<{ session: Session; user: User } | null> {
  const result = await db
    .prepare(
      `
    SELECT s.id, s.user_id, s.expires_at, u.id as uid, u.username, u.password_hash, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `
    )
    .bind(sessionId)
    .first<{
      id: string;
      user_id: number;
      expires_at: string;
      uid: number;
      username: string;
      password_hash: string;
      created_at: string;
    }>();

  if (!result) return null;

  return {
    session: {
      id: result.id,
      user_id: result.user_id,
      expires_at: result.expires_at,
    },
    user: {
      id: result.uid,
      username: result.username,
      password_hash: result.password_hash,
      created_at: result.created_at,
    },
  };
}

/**
 * Deletes a session from the database.
 *
 * Args:
 *   db: The D1 database instance.
 *   sessionId: The session ID to delete.
 */
export async function deleteSession(
  db: D1Database,
  sessionId: string
): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE id = ?").bind(sessionId).run();
}

/**
 * Removes all expired sessions from the database.
 *
 * Args:
 *   db: The D1 database instance.
 */
export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}
