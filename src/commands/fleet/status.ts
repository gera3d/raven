import type { FleetNode, ServiceStatus } from "../../fleet/types.js";
import type { RuntimeEnv } from "../../runtime.js";
import { resolveKnownHostsPath } from "../../fleet/paths.js";
import { sshExec } from "../../fleet/ssh-transport.js";
import { getNode, listNodes, updateNode } from "../../fleet/store.js";

export type FleetStatusOptions = {
  json: boolean;
  timeout: string;
};

/**
 * Diagnostics result from a remote node.
 */
export type NodeDiagnostics = {
  name: string;
  host: string;
  online: boolean;
  serviceRunning: boolean;
  serviceStatus: ServiceStatus;
  version: string | null;
  uptime: string | null;
  lastSeen: string | null;
  error: string | null;
  latencyMs: number | null;
};

/**
 * Parse the version from raven --version output.
 */
function parseVersion(output: string): string | null {
  const trimmed = output.trim();
  const match = trimmed.match(/(\d+\.\d+\.\d+|[a-f0-9]{7,40})/i);
  return match?.[1] ?? null;
}

/**
 * Parse uptime from the gateway status JSON output.
 */
function parseUptime(statusJson: string): string | null {
  try {
    const parsed = JSON.parse(statusJson) as { uptime?: string | number };
    if (typeof parsed.uptime === "string") {
      return parsed.uptime;
    }
    if (typeof parsed.uptime === "number") {
      return formatUptimeMs(parsed.uptime);
    }
  } catch {
    // Ignore parse errors
  }
  return null;
}

/**
 * Format milliseconds as human-readable uptime.
 */
function formatUptimeMs(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

/**
 * Run diagnostics on a single node via SSH.
 */
export async function runNodeDiagnostics(
  node: FleetNode,
  timeoutMs: number,
  env?: NodeJS.ProcessEnv,
): Promise<NodeDiagnostics> {
  const startTime = Date.now();
  const knownHostsPath = resolveKnownHostsPath(env);

  // Build the diagnostics command based on OS
  // This runs multiple checks and outputs JSON-ish format
  const diagCommand = `
    echo "DIAG_START"
    # Get version
    if command -v raven &> /dev/null; then
      echo "VERSION:$(raven --version 2>/dev/null | head -1)"
    else
      echo "VERSION:NOT_FOUND"
    fi
    # Check service status
    if [ "$(uname)" = "Darwin" ]; then
      # macOS - check launchd
      if launchctl list 2>/dev/null | grep -q "ai.raven.gateway"; then
        echo "SERVICE:running"
      else
        echo "SERVICE:stopped"
      fi
    else
      # Linux - check systemd
      if systemctl --user is-active raven-gateway &>/dev/null; then
        echo "SERVICE:running"
      else
        echo "SERVICE:stopped"
      fi
    fi
    # Try to get gateway status
    echo "STATUS_JSON:$(raven gateway status --json --timeout 3000 2>/dev/null || echo '{}')"
    echo "DIAG_END"
  `;

  try {
    const result = await sshExec({
      host: node.host,
      port: node.port,
      user: node.user,
      command: diagCommand,
      timeoutMs,
      knownHostsPath,
      strictHostKeyChecking: node.trusted ? "yes" : "accept-new",
    });

    const latencyMs = Date.now() - startTime;

    if (result.timedOut) {
      return {
        name: node.name,
        host: node.host,
        online: false,
        serviceRunning: false,
        serviceStatus: "unknown",
        version: null,
        uptime: null,
        lastSeen: node.lastSeen ?? null,
        error: "Connection timed out",
        latencyMs: null,
      };
    }

    if (result.exitCode !== 0 && !result.stdout.includes("DIAG_START")) {
      return {
        name: node.name,
        host: node.host,
        online: false,
        serviceRunning: false,
        serviceStatus: "unknown",
        version: null,
        uptime: null,
        lastSeen: node.lastSeen ?? null,
        error: result.stderr || `SSH exit code: ${result.exitCode}`,
        latencyMs,
      };
    }

    // Parse diagnostics output
    const output = result.stdout;
    let version: string | null = null;
    let serviceStatus: ServiceStatus = "unknown";
    let uptime: string | null = null;

    // Parse VERSION line
    const versionMatch = output.match(/VERSION:(.+)/);
    if (versionMatch && versionMatch[1] !== "NOT_FOUND") {
      version = parseVersion(versionMatch[1]) ?? versionMatch[1].trim();
    }

    // Parse SERVICE line
    const serviceMatch = output.match(/SERVICE:(running|stopped)/);
    if (serviceMatch) {
      serviceStatus = serviceMatch[1] as ServiceStatus;
    }

    // Parse STATUS_JSON line
    const statusMatch = output.match(/STATUS_JSON:(.+)/);
    if (statusMatch) {
      uptime = parseUptime(statusMatch[1]);
    }

    const now = new Date().toISOString();
    const serviceRunning = serviceStatus === "running";

    return {
      name: node.name,
      host: node.host,
      online: true,
      serviceRunning,
      serviceStatus,
      version,
      uptime,
      lastSeen: now,
      error: null,
      latencyMs,
    };
  } catch (err) {
    return {
      name: node.name,
      host: node.host,
      online: false,
      serviceRunning: false,
      serviceStatus: "unknown",
      version: null,
      uptime: null,
      lastSeen: node.lastSeen ?? null,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: null,
    };
  }
}

/**
 * Fleet status command - check status of all or specific nodes.
 */
export async function fleetStatusCommand(
  name: string | undefined,
  opts: FleetStatusOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const timeoutMs = Number.parseInt(opts.timeout, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    runtime.error("Timeout must be at least 1000ms");
    runtime.exit(1);
    return;
  }

  try {
    // Get nodes to check
    let nodes: FleetNode[];
    if (name) {
      const node = await getNode(name);
      if (!node) {
        if (opts.json) {
          runtime.log(JSON.stringify({ error: `Node not found: ${name}` }, null, 2));
        } else {
          runtime.error(`Node not found: ${name}`);
        }
        runtime.exit(1);
        return;
      }
      nodes = [node];
    } else {
      nodes = await listNodes();
    }

    if (nodes.length === 0) {
      if (opts.json) {
        runtime.log(JSON.stringify({ nodes: [] }, null, 2));
      } else {
        runtime.log("No fleet nodes configured.");
        runtime.log("Use 'raven fleet add' to add a node.");
      }
      return;
    }

    // Run diagnostics on all nodes
    const results: NodeDiagnostics[] = [];
    for (const node of nodes) {
      if (!opts.json) {
        runtime.log(`Checking ${node.name}...`);
      }

      const diag = await runNodeDiagnostics(node, timeoutMs);
      results.push(diag);

      // Update the node in the store with latest info
      if (diag.online) {
        await updateNode(node.name, {
          lastSeen: diag.lastSeen ?? undefined,
          serviceStatus: diag.serviceStatus,
        });
      }
    }

    if (opts.json) {
      runtime.log(JSON.stringify({ nodes: results }, null, 2));
      return;
    }

    // Print results as a table
    runtime.log("");
    runtime.log(formatStatusRow("NAME", "STATUS", "SERVICE", "VERSION", "UPTIME", "LATENCY"));
    runtime.log("-".repeat(85));

    for (const diag of results) {
      const status = diag.online ? "✓ online" : "✗ offline";
      const service = diag.serviceRunning ? "running" : diag.serviceStatus;
      const version = diag.version ?? "-";
      const uptime = diag.uptime ?? "-";
      const latency = diag.latencyMs !== null ? `${diag.latencyMs}ms` : "-";

      runtime.log(formatStatusRow(diag.name, status, service, version, uptime, latency));

      if (diag.error && !diag.online) {
        runtime.log(`    Error: ${diag.error}`);
      }
    }

    // Summary
    const onlineCount = results.filter((r) => r.online).length;
    const runningCount = results.filter((r) => r.serviceRunning).length;
    runtime.log("");
    runtime.log(
      `Summary: ${onlineCount}/${results.length} online, ${runningCount}/${results.length} running`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (opts.json) {
      runtime.log(JSON.stringify({ error: message }, null, 2));
    } else {
      runtime.error(`Failed to get status: ${message}`);
    }
    runtime.exit(1);
  }
}

/**
 * Format a status table row.
 */
function formatStatusRow(
  name: string,
  status: string,
  service: string,
  version: string,
  uptime: string,
  latency: string,
): string {
  return [
    name.padEnd(16),
    status.padEnd(12),
    service.padEnd(10),
    version.padEnd(16),
    uptime.padEnd(12),
    latency.padEnd(10),
  ].join(" ");
}
