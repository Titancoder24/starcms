import { createCipheriv, createDecipheriv, randomBytes, createHmac } from "crypto";
import { scryptSync } from "crypto";

function deriveKey(userId: string): Buffer {
  const secret = process.env["AI_KEY_SECRET"];
  if (!secret) throw new Error("AI_KEY_SECRET environment variable is required");
  // HKDF-like: derive a per-user key using scrypt
  return scryptSync(secret + userId, "starcms-ai-key-v1", 32);
}

export function encryptApiKey(
  plaintext: string,
  userId: string
): { ciphertext: string; iv: string; authTag: string } {
  const key = deriveKey(userId);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
  };
}

export function decryptApiKey(
  ciphertext: string,
  iv: string,
  authTag: string,
  userId: string
): string {
  const key = deriveKey(userId);
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(iv, "base64")
  );
  decipher.setAuthTag(Buffer.from(authTag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}
