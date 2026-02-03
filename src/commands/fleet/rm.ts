import type { RuntimeEnv } from "../../runtime.js";
import { getNode, removeNode } from "../../fleet/store.js";

export type FleetRmOptions = {
  force: boolean;
  json: boolean;
};

/**
 * Remove a node from the fleet.
 */
export async function fleetRmCommand(
  name: string,
  opts: FleetRmOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    // Check if node exists
    const node = await getNode(name);
    if (!node) {
      runtime.error(`Node not found: ${name}`);
      runtime.exit(1);
      return;
    }

    // Without --force, we'd normally prompt for confirmation
    // For now, we require --force since we don't have interactive prompts
    if (!opts.force) {
      runtime.error(`Use --force to confirm removal of node '${name}'`);
      runtime.exit(1);
      return;
    }

    const removed = await removeNode(name);

    if (!removed) {
      runtime.error(`Failed to remove node: ${name}`);
      runtime.exit(1);
      return;
    }

    if (opts.json) {
      runtime.log(JSON.stringify({ removed: name, success: true }, null, 2));
    } else {
      runtime.log(`Removed node: ${name}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    runtime.error(`Failed to remove node: ${message}`);
    runtime.exit(1);
  }
}
