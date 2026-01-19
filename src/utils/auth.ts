import type { User, Session, Env } from '../types';

// Simple password hashing using Web Crypto API (available in Workers)
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const passwordHash = await hashPassword(password);
  return passwordHash === hash;
}

export function generateSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function createSession(db: D1Database, userId: number): Promise<string> {
  const sessionId = generateSessionId();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days

  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(sessionId, userId, expiresAt).run();

  return sessionId;
}

export async function getSession(db: D1Database, sessionId: string): Promise<{ session: Session; user: User } | null> {
  const result = await db.prepare(`
    SELECT s.id, s.user_id, s.expires_at, u.id as uid, u.username, u.password_hash, u.created_at
    FROM sessions s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ? AND s.expires_at > datetime('now')
  `).bind(sessionId).first<{
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

export async function deleteSession(db: D1Database, sessionId: string): Promise<void> {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function cleanupExpiredSessions(db: D1Database): Promise<void> {
  await db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}
