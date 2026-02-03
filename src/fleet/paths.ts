import os from "node:os";
import path from "node:path";

/**
 * Default fleet directory under the state dir.
 * Following OpenClaw convention: ~/.openclaw/fleet/
 */
const FLEET_SUBDIR = "fleet";
const NODES_FILENAME = "nodes.json";
const KNOWN_HOSTS_FILENAME = "known_hosts";

/**
 * Resolve user path with tilde expansion.
 */
function resolveUserPath(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    return trimmed;
  }
  if (trimmed.startsWith("~")) {
    const expanded = trimmed.replace(/^~(?=$|[\\/])/, os.homedir());
    return path.resolve(expanded);
  }
  return path.resolve(trimmed);
}

/**
 * Resolve the fleet directory.
 *
 * Priority:
 * 1. RAVEN_FLEET_DIR env var (explicit override)
 * 2. Default: ~/.openclaw/fleet/
 *
 * @param env - Environment variables (defaults to process.env)
 * @param homedir - Home directory function (defaults to os.homedir)
 */
export function resolveFleetDir(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  const override = env.RAVEN_FLEET_DIR?.trim();
  if (override) {
    return resolveUserPath(override);
  }
  // Use .openclaw as the state dir per the spec
  return path.join(homedir(), ".openclaw", FLEET_SUBDIR);
}

/**
 * Resolve the path to the nodes.json file.
 *
 * @param env - Environment variables (defaults to process.env)
 * @param homedir - Home directory function (defaults to os.homedir)
 */
export function resolveNodesPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return path.join(resolveFleetDir(env, homedir), NODES_FILENAME);
}

/**
 * Resolve the path to the known_hosts file (for SSH host key pinning).
 *
 * @param env - Environment variables (defaults to process.env)
 * @param homedir - Home directory function (defaults to os.homedir)
 */
export function resolveKnownHostsPath(
  env: NodeJS.ProcessEnv = process.env,
  homedir: () => string = os.homedir,
): string {
  return path.join(resolveFleetDir(env, homedir), KNOWN_HOSTS_FILENAME);
}

/**
 * Export resolved paths for convenience.
 * These use default environment and homedir.
 */
export const FLEET_DIR = resolveFleetDir();
export const NODES_PATH = resolveNodesPath();
export const KNOWN_HOSTS_PATH = resolveKnownHostsPath();
