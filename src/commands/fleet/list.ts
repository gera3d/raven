import type { RuntimeEnv } from "../../runtime.js";
import { listNodes } from "../../fleet/store.js";

export type FleetListOptions = {
  json: boolean;
};

/**
 * List all fleet nodes.
 */
export async function fleetListCommand(opts: FleetListOptions, runtime: RuntimeEnv): Promise<void> {
  try {
    const nodes = await listNodes();

    if (opts.json) {
      runtime.log(JSON.stringify({ nodes }, null, 2));
      return;
    }

    if (nodes.length === 0) {
      runtime.log("No fleet nodes configured.");
      runtime.log("Use 'raven fleet add' to add a node.");
      return;
    }

    // Table header
    runtime.log(formatRow("NAME", "HOST", "USER", "PORT", "TAGS", "TRUSTED", "LAST SEEN"));
    runtime.log("-".repeat(100));

    // Table rows
    for (const node of nodes) {
      const tags = node.tags.length > 0 ? node.tags.join(",") : "-";
      const trusted = node.trusted ? "yes" : "no";
      const lastSeen = node.lastSeen ? formatRelativeTime(new Date(node.lastSeen)) : "-";

      runtime.log(
        formatRow(node.name, node.host, node.user, String(node.port), tags, trusted, lastSeen),
      );
    }

    runtime.log("");
    runtime.log(`Total: ${nodes.length} node(s)`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runtime.error(`Failed to list nodes: ${message}`);
    runtime.exit(1);
  }
}

/**
 * Format a table row with fixed column widths.
 */
function formatRow(
  name: string,
  host: string,
  user: string,
  port: string,
  tags: string,
  trusted: string,
  lastSeen: string,
): string {
  return [
    name.padEnd(16),
    host.padEnd(20),
    user.padEnd(12),
    port.padEnd(6),
    tags.padEnd(15),
    trusted.padEnd(8),
    lastSeen.padEnd(12),
  ].join(" ");
}

/**
 * Format a date as relative time (e.g., "2m ago", "3h ago").
 */
function formatRelativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 0) {
    return "just now";
  }

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ago`;
  }
  if (hours > 0) {
    return `${hours}h ago`;
  }
  if (minutes > 0) {
    return `${minutes}m ago`;
  }
  return "just now";
}
