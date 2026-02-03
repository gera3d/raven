import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import lockfile from "proper-lockfile";
import { resolveNodesPath } from "./paths.js";
import {
  FleetStoreSchema,
  type AddNodeInput,
  type FleetNode,
  type FleetStore,
  type UpdateNodeInput,
  createEmptyFleetStore,
  nodeNameRegex,
} from "./types.js";

/**
 * Lock options for the fleet store.
 * Following pattern from pairing-store.ts.
 */
const FLEET_STORE_LOCK_OPTIONS = {
  retries: {
    retries: 10,
    factor: 2,
    minTimeout: 100,
    maxTimeout: 10_000,
    randomize: true,
  },
  stale: 30_000,
} as const;

/**
 * Safely parse JSON, returning null on error.
 */
function safeParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Read a JSON file with fallback on error.
 */
async function readJsonFile<T>(
  filePath: string,
  fallback: T,
): Promise<{ value: T; exists: boolean }> {
  try {
    const raw = await fs.promises.readFile(filePath, "utf-8");
    const parsed = safeParseJson<T>(raw);
    if (parsed == null) {
      return { value: fallback, exists: true };
    }
    return { value: parsed, exists: true };
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code === "ENOENT") {
      return { value: fallback, exists: false };
    }
    return { value: fallback, exists: false };
  }
}

/**
 * Write a JSON file atomically (temp file + rename).
 * Following pattern from pairing-store.ts.
 */
async function writeJsonFile(filePath: string, value: unknown): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, `${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);
  await fs.promises.writeFile(tmp, `${JSON.stringify(value, null, 2)}\n`, {
    encoding: "utf-8",
  });
  await fs.promises.chmod(tmp, 0o600);
  await fs.promises.rename(tmp, filePath);
}

/**
 * Ensure the JSON file exists, creating it with fallback if needed.
 */
async function ensureJsonFile(filePath: string, fallback: unknown): Promise<void> {
  try {
    await fs.promises.access(filePath);
  } catch {
    await writeJsonFile(filePath, fallback);
  }
}

/**
 * Execute a function with file locking.
 * Following pattern from pairing-store.ts.
 */
async function withFileLock<T>(
  filePath: string,
  fallback: unknown,
  fn: () => Promise<T>,
): Promise<T> {
  await ensureJsonFile(filePath, fallback);
  let release: (() => Promise<void>) | undefined;
  try {
    release = await lockfile.lock(filePath, FLEET_STORE_LOCK_OPTIONS);
    return await fn();
  } finally {
    if (release) {
      try {
        await release();
      } catch {
        // ignore unlock errors
      }
    }
  }
}

/**
 * Normalize a node name for comparison (case-insensitive).
 */
function normalizeNodeName(name: string): string {
  return name.trim().toLowerCase();
}

/**
 * Validate a node name.
 */
function validateNodeName(name: string): void {
  if (!name || !name.trim()) {
    throw new Error("Node name cannot be empty");
  }
  if (!nodeNameRegex.test(name)) {
    throw new Error("Node name must contain only letters, numbers, hyphens, and underscores");
  }
  if (name.length > 100) {
    throw new Error("Node name must be at most 100 characters");
  }
}

/**
 * Validate a hostname (security check).
 */
function validateHost(host: string): void {
  if (!host || !host.trim()) {
    throw new Error("Host cannot be empty");
  }
  if (host.startsWith("-")) {
    throw new Error("Host cannot start with '-' (security)");
  }
}

/**
 * Validate a port number.
 */
function validatePort(port: number): void {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Port must be an integer between 1 and 65535");
  }
}

/**
 * Load the fleet store from disk.
 *
 * @param env - Environment variables for path resolution
 */
export async function loadFleetStore(env: NodeJS.ProcessEnv = process.env): Promise<FleetStore> {
  const filePath = resolveNodesPath(env);
  const { value } = await readJsonFile<FleetStore>(filePath, createEmptyFleetStore());
  // Validate with Zod, falling back to empty store on error
  const parsed = FleetStoreSchema.safeParse(value);
  if (!parsed.success) {
    return createEmptyFleetStore();
  }
  return parsed.data;
}

/**
 * Save the fleet store to disk (atomic write).
 *
 * @param store - The store to save
 * @param env - Environment variables for path resolution
 */
export async function saveFleetStore(
  store: FleetStore,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const filePath = resolveNodesPath(env);
  await writeJsonFile(filePath, store);
}

/**
 * Add a node to the fleet.
 *
 * @param input - Node data (id will be generated)
 * @param env - Environment variables for path resolution
 * @returns The created node
 * @throws Error if name is duplicate or validation fails
 */
export async function addNode(
  input: AddNodeInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FleetNode> {
  // Validate inputs
  validateNodeName(input.name);
  validateHost(input.host);
  validatePort(input.port);

  if (!input.user || !input.user.trim()) {
    throw new Error("User cannot be empty");
  }

  const filePath = resolveNodesPath(env);

  return await withFileLock(filePath, createEmptyFleetStore(), async () => {
    const { value } = await readJsonFile<FleetStore>(filePath, createEmptyFleetStore());
    const parsed = FleetStoreSchema.safeParse(value);
    const store = parsed.success ? parsed.data : createEmptyFleetStore();

    // Check for duplicate name (case-insensitive)
    const normalizedName = normalizeNodeName(input.name);
    const existing = store.nodes.find((n) => normalizeNodeName(n.name) === normalizedName);
    if (existing) {
      throw new Error(`Node with name '${input.name}' already exists`);
    }

    // Create the node with generated UUID
    const node: FleetNode = {
      id: crypto.randomUUID(),
      name: input.name.trim(),
      host: input.host.trim(),
      port: input.port,
      user: input.user.trim(),
      trusted: input.trusted ?? false,
      hostKey: input.hostKey,
      tags: input.tags ?? [],
      installed: input.installed,
      lastSeen: input.lastSeen,
    };

    // Add to store and save
    store.nodes.push(node);
    await writeJsonFile(filePath, store);

    return node;
  });
}

/**
 * List all fleet nodes.
 *
 * @param env - Environment variables for path resolution
 * @returns Array of all nodes
 */
export async function listNodes(env: NodeJS.ProcessEnv = process.env): Promise<FleetNode[]> {
  const store = await loadFleetStore(env);
  return store.nodes;
}

/**
 * Get a node by name.
 *
 * @param name - Node name (case-insensitive)
 * @param env - Environment variables for path resolution
 * @returns The node or null if not found
 */
export async function getNode(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FleetNode | null> {
  const store = await loadFleetStore(env);
  const normalizedName = normalizeNodeName(name);
  return store.nodes.find((n) => normalizeNodeName(n.name) === normalizedName) ?? null;
}

/**
 * Remove a node by name.
 *
 * @param name - Node name (case-insensitive)
 * @param env - Environment variables for path resolution
 * @returns true if removed, false if not found
 */
export async function removeNode(
  name: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<boolean> {
  const filePath = resolveNodesPath(env);

  return await withFileLock(filePath, createEmptyFleetStore(), async () => {
    const { value } = await readJsonFile<FleetStore>(filePath, createEmptyFleetStore());
    const parsed = FleetStoreSchema.safeParse(value);
    const store = parsed.success ? parsed.data : createEmptyFleetStore();

    const normalizedName = normalizeNodeName(name);
    const index = store.nodes.findIndex((n) => normalizeNodeName(n.name) === normalizedName);

    if (index < 0) {
      return false;
    }

    store.nodes.splice(index, 1);
    await writeJsonFile(filePath, store);

    return true;
  });
}

/**
 * Update a node by name.
 *
 * @param name - Node name (case-insensitive)
 * @param updates - Partial node data to update
 * @param env - Environment variables for path resolution
 * @returns The updated node or null if not found
 */
export async function updateNode(
  name: string,
  updates: UpdateNodeInput,
  env: NodeJS.ProcessEnv = process.env,
): Promise<FleetNode | null> {
  // Validate updates if provided
  if (updates.host !== undefined) {
    validateHost(updates.host);
  }
  if (updates.port !== undefined) {
    validatePort(updates.port);
  }
  if (updates.user !== undefined && (!updates.user || !updates.user.trim())) {
    throw new Error("User cannot be empty");
  }

  const filePath = resolveNodesPath(env);

  return await withFileLock(filePath, createEmptyFleetStore(), async () => {
    const { value } = await readJsonFile<FleetStore>(filePath, createEmptyFleetStore());
    const parsed = FleetStoreSchema.safeParse(value);
    const store = parsed.success ? parsed.data : createEmptyFleetStore();

    const normalizedName = normalizeNodeName(name);
    const index = store.nodes.findIndex((n) => normalizeNodeName(n.name) === normalizedName);

    if (index < 0) {
      return null;
    }

    const existing = store.nodes[index];
    if (!existing) {
      return null;
    }

    // Merge updates
    const updated: FleetNode = {
      ...existing,
      ...(updates.host !== undefined && { host: updates.host.trim() }),
      ...(updates.port !== undefined && { port: updates.port }),
      ...(updates.user !== undefined && { user: updates.user.trim() }),
      ...(updates.trusted !== undefined && { trusted: updates.trusted }),
      ...(updates.hostKey !== undefined && { hostKey: updates.hostKey }),
      ...(updates.tags !== undefined && { tags: updates.tags }),
      ...(updates.installed !== undefined && { installed: updates.installed }),
      ...(updates.lastSeen !== undefined && { lastSeen: updates.lastSeen }),
    };

    store.nodes[index] = updated;
    await writeJsonFile(filePath, store);

    return updated;
  });
}
