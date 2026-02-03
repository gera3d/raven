/**
 * Bootstrap module for Raven Fleet.
 *
 * Provides functionality to install and configure Raven on remote nodes via SSH.
 *
 * Usage:
 * ```typescript
 * import { bootstrap } from "./fleet/bootstrap";
 *
 * const result = await bootstrap({
 *   node,
 *   version: "latest",
 *   force: false,
 *   dryRun: false,
 * });
 * ```
 */

export type {
  NodeInfo,
  BootstrapStep,
  BootstrapStepStatus,
  BootstrapStepResult,
  BootstrapPlan,
  BootstrapResult,
  BootstrapOptions,
} from "./types.js";

export { DEFAULT_BOOTSTRAP_OPTIONS } from "./types.js";
export { gatherNodeInfo } from "./preflight.js";
export { buildBootstrapPlan, formatPlan } from "./plan-builder.js";
export { executeBootstrapPlan, formatResult } from "./executor.js";
export {
  generateLaunchdPlist,
  generateSystemdUnit,
  getLaunchdInstallCommands,
  getLaunchdStartCommands,
  getLaunchdVerifyCommands,
  getSystemdInstallCommands,
  getSystemdStartCommands,
  getSystemdVerifyCommands,
  type ServiceTemplateVars,
} from "./service-templates.js";

import type { BootstrapOptions, BootstrapResult } from "./types.js";
import { executeBootstrapPlan } from "./executor.js";
import { buildBootstrapPlan } from "./plan-builder.js";
import { gatherNodeInfo } from "./preflight.js";
import { DEFAULT_BOOTSTRAP_OPTIONS } from "./types.js";

/**
 * Bootstrap a remote node.
 *
 * This is the main entry point for the bootstrap process. It:
 * 1. Gathers information about the remote node (preflight)
 * 2. Builds a bootstrap plan based on the node's OS and current state
 * 3. Executes the plan (unless dryRun is true)
 * 4. Updates the node in the fleet store with installation info
 *
 * @param options - Bootstrap options
 * @returns Bootstrap result
 */
export async function bootstrap(options: BootstrapOptions): Promise<BootstrapResult> {
  const {
    node,
    version = DEFAULT_BOOTSTRAP_OPTIONS.version,
    force = DEFAULT_BOOTSTRAP_OPTIONS.force,
    dryRun = DEFAULT_BOOTSTRAP_OPTIONS.dryRun,
    commandTimeoutMs = DEFAULT_BOOTSTRAP_OPTIONS.commandTimeoutMs,
    onProgress,
    env,
  } = options;

  const startTime = Date.now();

  // Phase 0: Preflight - gather node info
  const preflightResult = await gatherNodeInfo(node, {
    timeoutMs: 30_000,
    env,
  });

  if (!preflightResult.success || !preflightResult.nodeInfo) {
    return {
      node,
      success: false,
      stepResults: [],
      totalDurationMs: Date.now() - startTime,
      error: preflightResult.error || "Failed to gather node information",
    };
  }

  const nodeInfo = preflightResult.nodeInfo;

  // Check for unsupported OS
  if (nodeInfo.os === "unknown") {
    return {
      node,
      success: false,
      stepResults: [],
      totalDurationMs: Date.now() - startTime,
      error: "Unsupported operating system. Only macOS and Linux are supported.",
    };
  }

  // Build the bootstrap plan
  const plan = buildBootstrapPlan(node, nodeInfo, { version, force });

  // Execute the plan
  return executeBootstrapPlan(plan, {
    dryRun,
    commandTimeoutMs,
    onProgress,
    env,
  });
}
