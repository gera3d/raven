import { z } from "zod";
import type { FleetArch, FleetNode, FleetOs } from "../types.js";

/**
 * Information about the remote node gathered during preflight.
 */
export type NodeInfo = {
  /** Operating system */
  os: FleetOs;
  /** CPU architecture */
  arch: FleetArch;
  /** Home directory on the remote node */
  homeDir: string;
  /** Whether Node.js is installed */
  hasNode: boolean;
  /** Node.js version if installed */
  nodeVersion?: string;
  /** Whether npm is available */
  hasNpm: boolean;
  /** Whether raven/openclaw is already installed */
  hasRaven: boolean;
  /** Installed raven version if present */
  ravenVersion?: string;
  /** Whether the service is already configured */
  hasService: boolean;
  /** Whether the service is currently running */
  serviceRunning: boolean;
};

/**
 * Bootstrap step status.
 */
export const BootstrapStepStatusSchema = z.enum([
  "pending",
  "running",
  "success",
  "skipped",
  "failed",
]);
export type BootstrapStepStatus = z.infer<typeof BootstrapStepStatusSchema>;

/**
 * A single step in the bootstrap process.
 */
export type BootstrapStep = {
  /** Unique step identifier */
  id: string;
  /** Human-readable description */
  description: string;
  /** The command(s) to run on the remote node */
  commands: string[];
  /** Whether this step can be skipped (e.g., already satisfied) */
  skippable: boolean;
  /** Condition function - returns true if step should be skipped */
  skipIf?: (info: NodeInfo) => boolean;
  /** Error message to show on failure */
  errorHint?: string;
};

/**
 * A complete bootstrap plan for a node.
 */
export type BootstrapPlan = {
  /** Target node */
  node: FleetNode;
  /** Gathered node info */
  nodeInfo: NodeInfo;
  /** Ordered list of steps to execute */
  steps: BootstrapStep[];
  /** Target version to install (git sha or tag) */
  targetVersion: string;
  /** Whether to force reinstall even if already installed */
  force: boolean;
};

/**
 * Result of executing a single bootstrap step.
 */
export type BootstrapStepResult = {
  /** Step that was executed */
  step: BootstrapStep;
  /** Status after execution */
  status: BootstrapStepStatus;
  /** stdout from command execution */
  stdout: string;
  /** stderr from command execution */
  stderr: string;
  /** Error message if failed */
  error?: string;
  /** Duration in milliseconds */
  durationMs: number;
};

/**
 * Result of a complete bootstrap operation.
 */
export type BootstrapResult = {
  /** Target node */
  node: FleetNode;
  /** Whether the bootstrap succeeded overall */
  success: boolean;
  /** Results of each step */
  stepResults: BootstrapStepResult[];
  /** Installed version (if successful) */
  installedVersion?: string;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Error message if failed */
  error?: string;
};

/**
 * Options for the bootstrap operation.
 */
export type BootstrapOptions = {
  /** Node to bootstrap */
  node: FleetNode;
  /** Target version to install (defaults to "latest") */
  version?: string;
  /** Force reinstall even if already installed */
  force?: boolean;
  /** Dry run - don't actually execute commands */
  dryRun?: boolean;
  /** Timeout per command in milliseconds */
  commandTimeoutMs?: number;
  /** Callback for progress updates */
  onProgress?: (step: BootstrapStep, status: BootstrapStepStatus) => void;
  /** Environment variables for path resolution */
  env?: NodeJS.ProcessEnv;
};

/**
 * Default bootstrap options.
 */
export const DEFAULT_BOOTSTRAP_OPTIONS = {
  version: "latest",
  force: false,
  dryRun: false,
  commandTimeoutMs: 120_000, // 2 minutes per command
} as const;
