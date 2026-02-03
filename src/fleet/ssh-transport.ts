import { spawn } from "node:child_process";

/**
 * Result of an SSH command execution.
 */
export type SshExecResult = {
  /** stdout output */
  stdout: string;
  /** stderr output */
  stderr: string;
  /** Exit code (null if killed by signal) */
  exitCode: number | null;
  /** Signal that killed the process (null if exited normally) */
  signal: NodeJS.Signals | null;
  /** Whether the command timed out */
  timedOut: boolean;
};

/**
 * Options for SSH command execution.
 */
export type SshExecOptions = {
  /** SSH hostname or IP address */
  host: string;
  /** SSH port */
  port: number;
  /** SSH username */
  user: string;
  /** Command to execute on remote host */
  command: string;
  /** Timeout in milliseconds */
  timeoutMs: number;
  /** Path to known_hosts file */
  knownHostsPath: string;
  /** StrictHostKeyChecking mode */
  strictHostKeyChecking: "yes" | "no" | "accept-new";
};

/**
 * Execute a command via SSH.
 *
 * Security considerations:
 * - Uses /usr/bin/ssh directly to avoid PATH manipulation
 * - Uses '--' before hostname to prevent argument injection
 * - Uses BatchMode=yes to prevent interactive prompts
 * - Uses custom known_hosts file for fleet-specific host key pinning
 */
export async function sshExec(opts: SshExecOptions): Promise<SshExecResult> {
  // Security: Reject hostnames starting with '-' to prevent argument injection
  if (opts.host.startsWith("-")) {
    return {
      stdout: "",
      stderr: "Host cannot start with '-' (security)",
      exitCode: 1,
      signal: null,
      timedOut: false,
    };
  }

  const userHost = `${opts.user}@${opts.host}`;
  const args = [
    "-o",
    "BatchMode=yes",
    "-o",
    "ConnectTimeout=5",
    "-o",
    `StrictHostKeyChecking=${opts.strictHostKeyChecking}`,
    "-o",
    `UserKnownHostsFile=${opts.knownHostsPath}`,
    "-o",
    "ServerAliveInterval=15",
    "-o",
    "ServerAliveCountMax=3",
    "-p",
    String(opts.port),
    // Security: Use '--' to prevent userHost from being interpreted as an option
    "--",
    userHost,
    opts.command,
  ];

  return new Promise<SshExecResult>((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let resolved = false;

    const child = spawn("/usr/bin/ssh", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        timedOut = true;
        child.kill("SIGKILL");
      }
    }, opts.timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("exit", (exitCode, signal) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr,
        exitCode,
        signal: signal as NodeJS.Signals | null,
        timedOut,
      });
    });

    child.once("error", (err) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeoutId);
      resolve({
        stdout,
        stderr: `SSH error: ${err.message}`,
        exitCode: 1,
        signal: null,
        timedOut: false,
      });
    });
  });
}

/**
 * Run ssh-keyscan to get host keys.
 *
 * Returns the raw output from ssh-keyscan.
 */
export async function sshKeyscan(
  host: string,
  port: number,
  timeoutMs: number = 10000,
): Promise<{ output: string; exitCode: number | null; error?: string }> {
  // Security: Reject hostnames starting with '-'
  if (host.startsWith("-")) {
    return {
      output: "",
      exitCode: 1,
      error: "Host cannot start with '-' (security)",
    };
  }

  const args = [
    "-T",
    "5", // Timeout per host
    "-p",
    String(port),
    host,
  ];

  return new Promise((resolve) => {
    let output = "";
    let stderr = "";
    let resolved = false;

    const child = spawn("/usr/bin/ssh-keyscan", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    const timeoutId = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        child.kill("SIGKILL");
        resolve({
          output,
          exitCode: null,
          error: "ssh-keyscan timed out",
        });
      }
    }, timeoutMs);

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk) => {
      output += chunk;
    });

    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });

    child.once("exit", (exitCode) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeoutId);
      resolve({
        output,
        exitCode,
        error: stderr.trim() || undefined,
      });
    });

    child.once("error", (err) => {
      if (resolved) {
        return;
      }
      resolved = true;
      clearTimeout(timeoutId);
      resolve({
        output,
        exitCode: 1,
        error: `ssh-keyscan error: ${err.message}`,
      });
    });
  });
}
