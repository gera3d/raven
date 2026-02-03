/**
 * Fleet gateway handlers.
 *
 * Provides gateway API methods for fleet management:
 * - fleet.list - List all fleet nodes
 * - fleet.get - Get a specific node
 * - fleet.status - Check status of fleet nodes
 */

import type { GatewayRequestHandlers } from "./types.js";
import { runNodeDiagnostics } from "../../commands/fleet/status.js";
import { listNodes, getNode, updateNode } from "../../fleet/store.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

export const fleetHandlers: GatewayRequestHandlers = {
  /**
   * List all fleet nodes.
   *
   * Request: {}
   * Response: { nodes: FleetNode[] }
   */
  "fleet.list": async ({ respond }) => {
    try {
      const nodes = await listNodes();
      respond(true, { nodes }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * Get a specific fleet node by name.
   *
   * Request: { name: string }
   * Response: { node: FleetNode | null }
   */
  "fleet.get": async ({ respond, params }) => {
    const name = params?.name;
    if (typeof name !== "string" || !name) {
      respond(false, undefined, errorShape(ErrorCodes.INVALID_REQUEST, "Missing 'name' parameter"));
      return;
    }

    try {
      const node = await getNode(name);
      respond(true, { node }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },

  /**
   * Check status of fleet nodes.
   *
   * Request: { name?: string, timeoutMs?: number }
   * Response: { nodes: NodeDiagnostics[] }
   *
   * If name is provided, checks only that node.
   * Otherwise checks all nodes.
   */
  "fleet.status": async ({ respond, params }) => {
    const name = params?.name as string | undefined;
    const timeoutMs = typeof params?.timeoutMs === "number" ? params.timeoutMs : 15000;

    try {
      let nodes;
      if (name) {
        const node = await getNode(name);
        if (!node) {
          respond(
            false,
            undefined,
            errorShape(ErrorCodes.INVALID_REQUEST, `Node not found: ${name}`),
          );
          return;
        }
        nodes = [node];
      } else {
        nodes = await listNodes();
      }

      // Run diagnostics on all nodes
      const results = await Promise.all(
        nodes.map(async (node) => {
          const diag = await runNodeDiagnostics(node, timeoutMs);

          // Update node in store if online
          if (diag.online && diag.lastSeen) {
            try {
              await updateNode(node.name, {
                lastSeen: diag.lastSeen,
                serviceStatus: diag.serviceStatus,
              });
            } catch {
              // Ignore store update errors
            }
          }

          return diag;
        }),
      );

      respond(true, { nodes: results }, undefined);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, message));
    }
  },
};
