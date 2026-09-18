import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const FORMAT = "cv1";
const IV_BYTES = 12;
const KEY_BYTES = 32;
const KEY_ENV = "GATEWAY_CREDENTIAL_VAULT_KEYS";

function failConfiguration(): never {
  throw new Error("CredentialVault não configurado corretamente.");
}

function decodeKey(value: string): Buffer {
  const normalized = value.trim();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized) || normalized.length % 4 !== 0) {
    return failConfiguration();
  }
  const decoded = Buffer.from(normalized, "base64");
  if (decoded.length !== KEY_BYTES) return failConfiguration();
  const canonical = decoded.toString("base64").replace(/=+$/u, "");
  if (canonical !== normalized.replace(/=+$/u, "")) return failConfiguration();
  return decoded;
}

function parseKeyring(raw: string | undefined): Map<string, Buffer> {
  if (!raw) return failConfiguration();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return failConfiguration();
  }
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return failConfiguration();
  }
  const result = new Map<string, Buffer>();
  for (const [version, encoded] of Object.entries(value as Record<string, unknown>)) {
    if (!/^[1-9]\d*$/u.test(version) || typeof encoded !== "string") {
      return failConfiguration();
    }
    result.set(version, decodeKey(encoded));
  }
  if (result.size === 0) return failConfiguration();
  return result;
}

function currentVersion(keys: ReadonlyMap<string, Buffer>): string {
  return [...keys.keys()].sort((a, b) => Number(a) - Number(b)).at(-1) ?? failConfiguration();
}

function invalidEnvelope(): never {
  throw new Error("Credencial protegida inválida.");
}

export class CredentialVault {
  private readonly keys: ReadonlyMap<string, Buffer>;
  private readonly current: string;

  constructor(keyring: ReadonlyMap<string, Buffer>) {
    if (keyring.size === 0) failConfiguration();
    this.keys = new Map(keyring);
    this.current = currentVersion(this.keys);
  }

  encrypt(plaintext: string): string {
    const key = this.keys.get(this.current);
    if (!key) return failConfiguration();
    const iv = randomBytes(IV_BYTES);
    const aad = Buffer.from(`${FORMAT}.${this.current}`, "utf8");
    const cipher = createCipheriv(ALGORITHM, key, iv);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return [
      FORMAT,
      this.current,
      iv.toString("base64url"),
      tag.toString("base64url"),
      encrypted.toString("base64url"),
    ].join(".");
  }

  decrypt(envelope: string): string {
    const [format, version, ivValue, tagValue, ciphertextValue, extra] = envelope.split(".");
    if (format !== FORMAT || !version || !ivValue || !tagValue || ciphertextValue === undefined || extra !== undefined) {
      return invalidEnvelope();
    }
    const key = this.keys.get(version);
    if (!key) return invalidEnvelope();
    try {
      const iv = Buffer.from(ivValue, "base64url");
      const tag = Buffer.from(tagValue, "base64url");
      const ciphertext = Buffer.from(ciphertextValue, "base64url");
      if (iv.length !== IV_BYTES || tag.length !== 16) return invalidEnvelope();
      const decipher = createDecipheriv(ALGORITHM, key, iv);
      decipher.setAAD(Buffer.from(`${FORMAT}.${version}`, "utf8"));
      decipher.setAuthTag(tag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
    } catch {
      return invalidEnvelope();
    }
  }
}

export function createCredentialVaultFromKeyring(
  value: Record<string, string>,
): CredentialVault {
  return new CredentialVault(parseKeyring(JSON.stringify(value)));
}

export function createCredentialVaultFromEnv(
  env: Readonly<Record<string, string | undefined>> = process.env,
): CredentialVault {
  return new CredentialVault(parseKeyring(env[KEY_ENV]));
}

export const CREDENTIAL_VAULT_ENV_NAME = KEY_ENV;
