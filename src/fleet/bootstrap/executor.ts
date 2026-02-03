import type { FleetNode } from "../types.js";
import type {
  BootstrapPlan,
  BootstrapResult,
  BootstrapStep,
  BootstrapStepResult,
  BootstrapStepStatus,
} from "./types.js";
import { resolveKnownHostsPath } from "../paths.js";
import { sshExec, type SshExecOptions } from "../ssh-transport.js";
import { updateNode } from "../store.js";

/**
 * Execute a single bootstrap step.
 */
async function executeStep(
  node: FleetNode,
  step: BootstrapStep,
  knownHostsPath: string,
  timeoutMs: number,
): Promise<BootstrapStepResult> {
  const startTime = Date.now();
  let stdout = "";
  let stderr = "";

  // Execute each command in sequence
  for (const command of step.commands) {
    const opts: SshExecOptions = {
      host: node.host,
      port: node.port,
      user: node.user,
      command,
      timeoutMs,
      knownHostsPath,
      strictHostKeyChecking: node.trusted ? "yes" : "accept-new",
    };

    const result = await sshExec(opts);
    stdout += result.stdout;
    stderr += result.stderr;

    // If command failed, stop executing this step
    if (result.exitCode !== 0 || result.timedOut) {
      return {
        step,
        status: "failed",
        stdout,
        stderr,
        error: result.timedOut
          ? "Command timed out"
          : step.errorHint || `Command failed with exit code ${result.exitCode}`,
        durationMs: Date.now() - startTime,
      };
    }
  }

  return {
    step,
    status: "success",
    stdout,
    stderr,
    durationMs: Date.now() - startTime,
  };
}

/**
 * Execute a bootstrap plan.
 */
export async function executeBootstrapPlan(
  plan: BootstrapPlan,
  options: {
    dryRun?: boolean;
    commandTimeoutMs?: number;
    onProgress?: (step: BootstrapStep, status: BootstrapStepStatus) => void;
    env?: NodeJS.ProcessEnv;
  } = {},
): Promise<BootstrapResult> {
  const startTime = Date.now();
  const dryRun = options.dryRun ?? false;
  const commandTimeoutMs = options.commandTimeoutMs ?? 120_000;
  const env = options.env ?? process.env;
  const knownHostsPath = resolveKnownHostsPath(env);

  const stepResults: BootstrapStepResult[] = [];

  for (const step of plan.steps) {
    // Check if step should be skipped
    const shouldSkip = step.skipIf?.(plan.nodeInfo) ?? false;

    if (shouldSkip) {
      options.onProgress?.(step, "skipped");
      stepResults.push({
        step,
        status: "skipped",
        stdout: "",
        stderr: "",
        durationMs: 0,
      });
      continue;
    }

    options.onProgress?.(step, "running");

    if (dryRun) {
      // In dry run mode, mark as success without executing
      stepResults.push({
        step,
        status: "success",
        stdout: "[DRY RUN] Commands not executed",
        stderr: "",
        durationMs: 0,
      });
      options.onProgress?.(step, "success");
      continue;
    }

    // Execute the step
    const result = await executeStep(plan.node, step, knownHostsPath, commandTimeoutMs);
    stepResults.push(result);
    options.onProgress?.(step, result.status);

    // If step failed, abort the bootstrap
    if (result.status === "failed") {
      return {
        node: plan.node,
        success: false,
        stepResults,
        totalDurationMs: Date.now() - startTime,
        error: result.error,
      };
    }
  }

  // All steps succeeded - update the node in the store
  const now = new Date().toISOString();

  if (!dryRun) {
    await updateNode(
      plan.node.name,
      {
        os: plan.nodeInfo.os,
        arch: plan.nodeInfo.arch,
        installed: {
          version: plan.targetVersion,
          installedAt: now,
        },
        lastSeen: now,
        serviceStatus: "running",
      },
      env,
    );
  }

  return {
    node: plan.node,
    success: true,
    stepResults,
    installedVersion: plan.targetVersion,
    totalDurationMs: Date.now() - startTime,
  };
}

/**
 * Format a bootstrap result as a human-readable string.
 */
export function formatResult(result: BootstrapResult): string {
  const lines: string[] = [];

  lines.push(
    result.success
      ? `✓ Bootstrap completed successfully for ${result.node.name}`
      : `✗ Bootstrap failed for ${result.node.name}`,
  );

  if (result.installedVersion) {
    lines.push(`  Installed version: ${result.installedVersion}`);
  }

  lines.push(`  Total time: ${(result.totalDurationMs / 1000).toFixed(1)}s`);
  lines.push("");

  for (const stepResult of result.stepResults) {
    const icon =
      stepResult.status === "success" ? "✓" : stepResult.status === "skipped" ? "○" : "✗";
    const timeStr =
      stepResult.durationMs > 0 ? ` (${(stepResult.durationMs / 1000).toFixed(1)}s)` : "";

    lines.push(`  ${icon} ${stepResult.step.description}${timeStr}`);

    if (stepResult.status === "failed" && stepResult.error) {
      lines.push(`    Error: ${stepResult.error}`);
      if (stepResult.stderr) {
        // Show last 3 lines of stderr
        const stderrLines = stepResult.stderr.trim().split("\n").slice(-3);
        for (const line of stderrLines) {
          lines.push(`    > ${line}`);
        }
      }
    }
  }

  return lines.join("\n");
}
