import type { RuntimeEnv } from "../../runtime.js";
import {
  bootstrap,
  gatherNodeInfo,
  buildBootstrapPlan,
  formatPlan,
  formatResult,
  type BootstrapStepStatus,
} from "../../fleet/bootstrap/index.js";
import { getNode } from "../../fleet/store.js";

export type FleetBootstrapOptions = {
  version: string;
  force: boolean;
  dryRun: boolean;
  json: boolean;
};

/**
 * Bootstrap a node in the fleet.
 */
export async function fleetBootstrapCommand(
  name: string,
  opts: FleetBootstrapOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  try {
    // Get the node from the store
    const node = await getNode(name);
    if (!node) {
      runtime.error(`Node not found: ${name}`);
      runtime.exit(1);
      return;
    }

    // Check if node is trusted
    if (!node.trusted) {
      runtime.error(
        `Node '${name}' is not trusted. Run 'raven fleet ping ${name}' first to verify and trust the host key.`,
      );
      runtime.exit(1);
      return;
    }

    // For dry run, gather info and show plan
    if (opts.dryRun) {
      runtime.log(`Gathering node info for ${name}...`);

      const preflightResult = await gatherNodeInfo(node);
      if (!preflightResult.success || !preflightResult.nodeInfo) {
        if (opts.json) {
          runtime.log(JSON.stringify({ success: false, error: preflightResult.error }, null, 2));
        } else {
          runtime.error(`Preflight failed: ${preflightResult.error}`);
        }
        runtime.exit(1);
        return;
      }

      const plan = buildBootstrapPlan(node, preflightResult.nodeInfo, {
        version: opts.version,
        force: opts.force,
      });

      if (opts.json) {
        runtime.log(
          JSON.stringify(
            {
              dryRun: true,
              node: {
                name: node.name,
                host: node.host,
                user: node.user,
              },
              nodeInfo: preflightResult.nodeInfo,
              plan: {
                targetVersion: plan.targetVersion,
                force: plan.force,
                steps: plan.steps.map((s) => ({
                  id: s.id,
                  description: s.description,
                  willSkip: s.skipIf?.(preflightResult.nodeInfo!) ?? false,
                  commands: s.commands,
                })),
              },
            },
            null,
            2,
          ),
        );
      } else {
        runtime.log("");
        runtime.log("[DRY RUN] The following bootstrap plan would be executed:");
        runtime.log("");
        runtime.log(formatPlan(plan));
      }
      return;
    }

    // Execute the bootstrap
    if (!opts.json) {
      runtime.log(`Bootstrapping node: ${name}`);
      runtime.log(`  Host: ${node.host}`);
      runtime.log(`  User: ${node.user}`);
      runtime.log(`  Version: ${opts.version}`);
      runtime.log(`  Force: ${opts.force}`);
      runtime.log("");
    }

    const result = await bootstrap({
      node,
      version: opts.version,
      force: opts.force,
      dryRun: false,
      onProgress: (step, status) => {
        if (!opts.json) {
          const icon = getStatusIcon(status);
          runtime.log(`  ${icon} ${step.description}`);
        }
      },
    });

    if (opts.json) {
      runtime.log(
        JSON.stringify(
          {
            success: result.success,
            node: {
              name: result.node.name,
              host: result.node.host,
            },
            installedVersion: result.installedVersion,
            totalDurationMs: result.totalDurationMs,
            error: result.error,
            steps: result.stepResults.map((sr) => ({
              id: sr.step.id,
              description: sr.step.description,
              status: sr.status,
              durationMs: sr.durationMs,
              error: sr.error,
            })),
          },
          null,
          2,
        ),
      );
    } else {
      runtime.log("");
      runtime.log(formatResult(result));
    }

    if (!result.success) {
      runtime.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (opts.json) {
      runtime.log(JSON.stringify({ success: false, error: message }, null, 2));
    } else {
      runtime.error(`Bootstrap failed: ${message}`);
    }
    runtime.exit(1);
  }
}

/**
 * Get an icon for the step status.
 */
function getStatusIcon(status: BootstrapStepStatus): string {
  switch (status) {
    case "pending":
      return "○";
    case "running":
      return "◐";
    case "success":
      return "✓";
    case "skipped":
      return "○";
    case "failed":
      return "✗";
  }
}
