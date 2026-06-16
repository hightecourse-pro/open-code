import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// App-level encryption for user-provided API keys. The DB stores ciphertext
// only; the plaintext key never leaves the server. Set AI_KEY_SECRET to a long
// random value in production (without it, a clearly-insecure dev fallback runs).
const SECRET = process.env.AI_KEY_SECRET || "opencode-dev-insecure-secret-change-me";
const KEY = scryptSync(SECRET, "opencode-ai-keys-v1", 32);

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), enc.toString("base64")].join(".");
}

export function decryptSecret(payload: string): string {
  const [ivB, tagB, dataB] = payload.split(".");
  const decipher = createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivB, "base64"));
  decipher.setAuthTag(Buffer.from(tagB, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB, "base64")), decipher.final()]).toString(
    "utf8"
  );
}
