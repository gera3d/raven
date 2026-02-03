import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveKnownHostsPath } from "./paths.js";

/**
 * Represents a host key entry in the known_hosts file.
 */
export type HostKeyEntry = {
  /** Hostname or IP address */
  host: string;
  /** SSH port */
  port: number;
  /** Key type (e.g., ssh-ed25519, ssh-rsa) */
  keyType: string;
  /** Base64-encoded public key */
  key: string;
};

/**
 * Format a host entry for the known_hosts file.
 * Uses [host]:port format for non-standard ports.
 */
function formatHostEntry(host: string, port: number): string {
  if (port === 22) {
    return host;
  }
  return `[${host}]:${port}`;
}

/**
 * Parse a host entry from the known_hosts file.
 * Returns [host, port] tuple.
 */
function parseHostEntry(entry: string): [string, number] {
  // Format: [host]:port or just host
  const bracketMatch = entry.match(/^\[([^\]]+)\]:(\d+)$/);
  if (bracketMatch) {
    return [bracketMatch[1], Number.parseInt(bracketMatch[2], 10)];
  }
  return [entry, 22];
}

/**
 * Parse the known_hosts file content into entries.
 */
export function parseKnownHosts(content: string): HostKeyEntry[] {
  const entries: HostKeyEntry[] = [];
  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Format: host keytype key [comment]
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      continue;
    }

    const hostEntry = parts[0];
    const keyType = parts[1];
    const key = parts[2];

    if (!hostEntry || !keyType || !key) {
      continue;
    }

    const [host, port] = parseHostEntry(hostEntry);
    entries.push({ host, port, keyType, key });
  }

  return entries;
}

/**
 * Format host key entries into known_hosts file content.
 */
export function formatKnownHosts(entries: HostKeyEntry[]): string {
  const lines = entries.map((entry) => {
    const hostEntry = formatHostEntry(entry.host, entry.port);
    return `${hostEntry} ${entry.keyType} ${entry.key}`;
  });
  return lines.join("\n") + "\n";
}

/**
 * Parse ssh-keyscan output into host key entries.
 *
 * ssh-keyscan output format:
 * host keytype key
 */
export function parseKeyscanOutput(output: string, host: string, port: number): HostKeyEntry[] {
  const entries: HostKeyEntry[] = [];
  const lines = output.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Format: host keytype key
    const parts = trimmed.split(/\s+/);
    if (parts.length < 3) {
      continue;
    }

    const keyType = parts[1];
    const key = parts[2];

    if (!keyType || !key) {
      continue;
    }

    // Use the provided host and port (keyscan output may have different format)
    entries.push({ host, port, keyType, key });
  }

  return entries;
}

/**
 * Load all host keys from the known_hosts file.
 */
export async function loadKnownHosts(
  env: NodeJS.ProcessEnv = process.env,
): Promise<HostKeyEntry[]> {
  const filePath = resolveKnownHostsPath(env);

  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return parseKnownHosts(content);
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return [];
    }
    throw err;
  }
}

/**
 * Save all host keys to the known_hosts file.
 */
export async function saveKnownHosts(
  entries: HostKeyEntry[],
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const filePath = resolveKnownHostsPath(env);
  const dir = path.dirname(filePath);

  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });

  // Atomic write
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  const content = formatKnownHosts(entries);
  await fs.promises.writeFile(tmp, content, { encoding: "utf-8" });
  await fs.promises.chmod(tmp, 0o600);
  await fs.promises.rename(tmp, filePath);
}

/**
 * Get a host key for a specific host and port.
 */
export async function getHostKey(
  host: string,
  port: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<HostKeyEntry | null> {
  const entries = await loadKnownHosts(env);
  // Prefer ed25519, then rsa, then any
  const matches = entries.filter((e) => e.host === host && e.port === port);

  if (matches.length === 0) {
    return null;
  }

  // Prefer ed25519
  const ed25519 = matches.find((e) => e.keyType === "ssh-ed25519");
  if (ed25519) {
    return ed25519;
  }

  // Prefer rsa
  const rsa = matches.find((e) => e.keyType === "ssh-rsa");
  if (rsa) {
    return rsa;
  }

  // Return first match
  return matches[0] ?? null;
}

/**
 * Pin a host key (add or update).
 */
export async function pinHostKey(
  entry: HostKeyEntry,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const entries = await loadKnownHosts(env);

  // Remove existing entries for this host/port/keyType
  const filtered = entries.filter(
    (e) => !(e.host === entry.host && e.port === entry.port && e.keyType === entry.keyType),
  );

  // Add new entry
  filtered.push(entry);

  await saveKnownHosts(filtered, env);
}

/**
 * Remove all host keys for a specific host and port.
 */
export async function removeHostKey(
  host: string,
  port: number,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const entries = await loadKnownHosts(env);
  const filtered = entries.filter((e) => !(e.host === host && e.port === port));

  if (filtered.length === entries.length) {
    return false; // Nothing removed
  }

  await saveKnownHosts(filtered, env);
  return true;
}

/**
 * Check if a host key has changed.
 * Returns null if no existing key, true if changed, false if same.
 */
export async function hasHostKeyChanged(
  entry: HostKeyEntry,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean | null> {
  const existing = await getHostKey(entry.host, entry.port, env);

  if (!existing) {
    return null; // No existing key
  }

  // Check if key matches (same type and key)
  if (existing.keyType === entry.keyType && existing.key === entry.key) {
    return false; // Same key
  }

  return true; // Key changed
}
