import type { RuntimeEnv } from "../../runtime.js";
import { addNode } from "../../fleet/store.js";

export type FleetAddOptions = {
  host: string;
  user: string;
  port: string;
  tags?: string;
  json: boolean;
};

/**
 * Add a node to the fleet.
 */
export async function fleetAddCommand(
  name: string,
  opts: FleetAddOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const port = Number.parseInt(opts.port, 10);
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    runtime.error("Invalid port number");
    runtime.exit(1);
    return;
  }

  const tags = opts.tags
    ? opts.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  try {
    const node = await addNode({
      name,
      host: opts.host,
      port,
      user: opts.user,
      trusted: false,
      tags,
    });

    if (opts.json) {
      runtime.log(JSON.stringify(node, null, 2));
    } else {
      runtime.log(`Added node: ${node.name} (${node.user}@${node.host}:${node.port})`);
      if (tags.length > 0) {
        runtime.log(`  tags: ${tags.join(", ")}`);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runtime.error(`Failed to add node: ${message}`);
    runtime.exit(1);
  }
}
