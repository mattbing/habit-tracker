interface JWKKey {
  kid: string;
  kty: string;
  n: string;
  e: string;
  alg: string;
  use: string;
}

interface JWKSet {
  keys: JWKKey[];
}

interface JWTHeader {
  kid: string;
  alg: string;
  typ: string;
}

interface JWTPayload {
  email: string;
  iss: string;
  aud: string[];
  exp: number;
  iat: number;
  sub: string;
}

let cachedKeys: JWKSet | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function base64UrlDecode(str: string): Uint8Array {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  // Pad with = if needed
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function fetchPublicKeys(teamDomain: string): Promise<JWKSet> {
  const url = `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch Access public keys: ${response.status}`);
  }
  return response.json();
}

async function getPublicKeys(teamDomain: string, forceRefresh = false): Promise<JWKSet> {
  const now = Date.now();
  if (!forceRefresh && cachedKeys && now < cacheExpiry) {
    return cachedKeys;
  }
  cachedKeys = await fetchPublicKeys(teamDomain);
  cacheExpiry = now + CACHE_TTL_MS;
  return cachedKeys;
}

function decodeJWTParts(token: string): { header: JWTHeader; payload: JWTPayload; signatureInput: string; signature: Uint8Array } {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format");
  }

  const header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0]))) as JWTHeader;
  const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1]))) as JWTPayload;
  const signatureInput = `${parts[0]}.${parts[1]}`;
  const signature = base64UrlDecode(parts[2]);

  return { header, payload, signatureInput, signature };
}

async function verifySignature(
  key: JWKKey,
  signatureInput: string,
  signature: Uint8Array
): Promise<boolean> {
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    { kty: key.kty, n: key.n, e: key.e, alg: key.alg },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    signature,
    new TextEncoder().encode(signatureInput)
  );
}

/**
 * Validates a Cloudflare Access JWT and returns the user's email.
 *
 * Args:
 *   token: The JWT string from the Cf-Access-Jwt-Assertion header.
 *   teamDomain: The Cloudflare Access team domain (e.g. "mutedwarf").
 *   aud: The Access application audience tag.
 *
 * Returns:
 *   The email from the JWT payload on success, null on failure.
 */
export async function validateAccessJWT(
  token: string,
  teamDomain: string,
  aud: string
): Promise<string | null> {
  try {
    const { header, payload, signatureInput, signature } = decodeJWTParts(token);

    if (header.alg !== "RS256") {
      return null;
    }

    // Find matching key, with retry on key rotation
    let keys = await getPublicKeys(teamDomain);
    let matchingKey = keys.keys.find((k) => k.kid === header.kid);

    if (!matchingKey) {
      // Key not found — may have rotated, force refresh once
      keys = await getPublicKeys(teamDomain, true);
      matchingKey = keys.keys.find((k) => k.kid === header.kid);
      if (!matchingKey) {
        return null;
      }
    }

    // Verify signature
    const valid = await verifySignature(matchingKey, signatureInput, signature);
    if (!valid) {
      return null;
    }

    // Validate issuer
    const expectedIssuer = `https://${teamDomain}.cloudflareaccess.com`;
    if (payload.iss !== expectedIssuer) {
      return null;
    }

    // Validate audience
    if (!payload.aud || !payload.aud.includes(aud)) {
      return null;
    }

    // Validate expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return null;
    }

    return payload.email || null;
  } catch {
    return null;
  }
}
