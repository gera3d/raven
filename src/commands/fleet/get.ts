import type { RuntimeEnv } from "../../runtime.js";
import { getNode } from "../../fleet/store.js";

export type FleetGetOptions = {
  json: boolean;
};

/**
 * Get details of a specific fleet node.
 */
export async function fleetGetCommand(
  name: string,
  opts: FleetGetOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    const node = await getNode(name);

    if (!node) {
      runtime.error(`Node not found: ${name}`);
      runtime.exit(1);
      return;
    }

    if (opts.json) {
      runtime.log(JSON.stringify(node, null, 2));
      return;
    }

    // Human-readable output
    runtime.log(`Name:     ${node.name}`);
    runtime.log(`ID:       ${node.id}`);
    runtime.log(`Host:     ${node.host}`);
    runtime.log(`Port:     ${node.port}`);
    runtime.log(`User:     ${node.user}`);
    runtime.log(`Trusted:  ${node.trusted ? "yes" : "no"}`);
    runtime.log(`Tags:     ${node.tags.length > 0 ? node.tags.join(", ") : "(none)"}`);

    if (node.hostKey) {
      runtime.log(`Host Key: ${node.hostKey.slice(0, 50)}...`);
    }

    if (node.installed) {
      runtime.log(`Installed:`);
      runtime.log(`  Version:     ${node.installed.version}`);
      runtime.log(`  Installed:   ${node.installed.installedAt}`);
    }

    if (node.lastSeen) {
      runtime.log(`Last Seen: ${node.lastSeen}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runtime.error(`Failed to get node: ${message}`);
    runtime.exit(1);
  }
}
