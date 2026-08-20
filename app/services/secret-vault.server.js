import crypto from "node:crypto";

const PREFIX = "enc:v1";

function masterSecret() {
  const configured = String(process.env.VSN_SECRET_ENCRYPTION_KEY || process.env.SHOPIFY_API_SECRET || "").trim();
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") throw new Error("VSN secret encryption key is not configured.");
  return "vsn-development-only-secret-vault";
}

function keyFor(shop) {
  return crypto.createHash("sha256").update(`${masterSecret()}:${String(shop || "")}`).digest();
}

export function encryptSecret(shop, plainText) {
  const value = String(plainText || "");
  if (!value) return "";
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFor(shop), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [PREFIX, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(shop, encoded) {
  const value = String(encoded || "");
  if (!value) return "";
  if (!value.startsWith(`${PREFIX}:`)) {
    if (process.env.NODE_ENV === "production") throw new Error("Legacy unencrypted integration secret cannot be used in production.");
    return value;
  }
  const parts = value.split(":");
  if (parts.length !== 5) throw new Error("Encrypted integration secret is invalid.");
  const iv = Buffer.from(parts[2], "base64url");
  const tag = Buffer.from(parts[3], "base64url");
  const encrypted = Buffer.from(parts[4], "base64url");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFor(shop), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function maskSecret(value) {
  const raw = String(value || "");
  return raw ? `••••${raw.slice(-4)}` : "";
}
