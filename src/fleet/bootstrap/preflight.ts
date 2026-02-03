import type { SshExecOptions, SshExecResult } from "../ssh-transport.js";
import type { FleetArch, FleetNode, FleetOs } from "../types.js";
import type { NodeInfo } from "./types.js";
import { resolveKnownHostsPath } from "../paths.js";
import { sshExec } from "../ssh-transport.js";

/**
 * Parse OS from uname output.
 */
function parseOs(uname: string): FleetOs {
  const lower = uname.toLowerCase().trim();
  if (lower.includes("darwin")) {
    return "darwin";
  }
  if (lower.includes("linux")) {
    return "linux";
  }
  return "unknown";
}

/**
 * Parse architecture from uname -m output.
 */
function parseArch(unameM: string): FleetArch {
  const lower = unameM.toLowerCase().trim();
  if (lower === "x86_64" || lower === "amd64") {
    return "x64";
  }
  if (lower === "arm64" || lower === "aarch64") {
    return "arm64";
  }
  return "unknown";
}

/**
 * Parse version from "node --version" output (e.g., "v20.10.0" -> "20.10.0").
 */
function parseNodeVersion(output: string): string | undefined {
  const match = output.trim().match(/^v?(\d+\.\d+\.\d+)/);
  return match?.[1];
}

/**
 * Parse version from "raven --version" output.
 */
function parseRavenVersion(output: string): string | undefined {
  const trimmed = output.trim();
  // Try to extract semver or git sha
  const match = trimmed.match(/(\d+\.\d+\.\d+|[a-f0-9]{7,40})/i);
  return match?.[1];
}

/**
 * Run a preflight command via SSH.
 */
async function runPreflightCommand(
  node: FleetNode,
  command: string,
  timeoutMs: number,
  knownHostsPath: string,
): Promise<SshExecResult> {
  const opts: SshExecOptions = {
    host: node.host,
    port: node.port,
    user: node.user,
    command,
    timeoutMs,
    knownHostsPath,
    strictHostKeyChecking: node.trusted ? "yes" : "accept-new",
  };
  return sshExec(opts);
}

/**
 * Gather information about the remote node.
 * This is the preflight phase of bootstrap.
 */
export async function gatherNodeInfo(
  node: FleetNode,
  options: {
    timeoutMs?: number;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<{ success: boolean; nodeInfo?: NodeInfo; error?: string }> {
  const timeoutMs = options.timeoutMs ?? 30_000;
  const env = options.env ?? process.env;
  const knownHostsPath = resolveKnownHostsPath(env);

  // Gather basic system info
  const unameResult = await runPreflightCommand(
    node,
    "uname -s && uname -m && echo $HOME",
    timeoutMs,
    knownHostsPath,
  );

  if (unameResult.exitCode !== 0) {
    return {
      success: false,
      error: `Failed to gather system info: ${unameResult.stderr || unameResult.stdout}`,
    };
  }

  const lines = unameResult.stdout.trim().split("\n");
  const os = parseOs(lines[0] || "");
  const arch = parseArch(lines[1] || "");
  const homeDir = lines[2]?.trim() || "";

  if (!homeDir) {
    return {
      success: false,
      error: "Failed to determine home directory",
    };
  }

  // Check for Node.js
  const nodeResult = await runPreflightCommand(
    node,
    "node --version 2>/dev/null || echo 'NOT_FOUND'",
    timeoutMs,
    knownHostsPath,
  );
  const hasNode = !nodeResult.stdout.includes("NOT_FOUND") && nodeResult.exitCode === 0;
  const nodeVersion = hasNode ? parseNodeVersion(nodeResult.stdout) : undefined;

  // Check for npm
  const npmResult = await runPreflightCommand(
    node,
    "npm --version 2>/dev/null || echo 'NOT_FOUND'",
    timeoutMs,
    knownHostsPath,
  );
  const hasNpm = !npmResult.stdout.includes("NOT_FOUND") && npmResult.exitCode === 0;

  // Check for existing raven installation
  const ravenResult = await runPreflightCommand(
    node,
    "raven --version 2>/dev/null || echo 'NOT_FOUND'",
    timeoutMs,
    knownHostsPath,
  );
  const hasRaven = !ravenResult.stdout.includes("NOT_FOUND") && ravenResult.exitCode === 0;
  const ravenVersion = hasRaven ? parseRavenVersion(ravenResult.stdout) : undefined;

  // Check for service (OS-specific)
  let hasService = false;
  let serviceRunning = false;

  if (os === "darwin") {
    // Check launchd service
    const launchctlResult = await runPreflightCommand(
      node,
      `launchctl list 2>/dev/null | grep -q "ai.raven.gateway" && echo "FOUND" || echo "NOT_FOUND"`,
      timeoutMs,
      knownHostsPath,
    );
    hasService = launchctlResult.stdout.includes("FOUND");

    if (hasService) {
      // Check if running
      const statusResult = await runPreflightCommand(
        node,
        `launchctl list ai.raven.gateway 2>/dev/null | grep -q "PID" && echo "RUNNING" || echo "STOPPED"`,
        timeoutMs,
        knownHostsPath,
      );
      serviceRunning = statusResult.stdout.includes("RUNNING");
    }
  } else if (os === "linux") {
    // Check systemd user service
    const systemctlResult = await runPreflightCommand(
      node,
      `systemctl --user is-enabled raven-gateway 2>/dev/null && echo "FOUND" || echo "NOT_FOUND"`,
      timeoutMs,
      knownHostsPath,
    );
    hasService =
      systemctlResult.stdout.includes("enabled") || systemctlResult.stdout.includes("disabled");

    if (hasService) {
      const statusResult = await runPreflightCommand(
        node,
        `systemctl --user is-active raven-gateway 2>/dev/null`,
        timeoutMs,
        knownHostsPath,
      );
      serviceRunning = statusResult.stdout.trim() === "active";
    }
  }

  const nodeInfo: NodeInfo = {
    os,
    arch,
    homeDir,
    hasNode,
    nodeVersion,
    hasNpm,
    hasRaven,
    ravenVersion,
    hasService,
    serviceRunning,
  };

  return { success: true, nodeInfo };
}
