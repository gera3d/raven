import type { RuntimeEnv } from "../../runtime.js";
import { getHostKey, parseKeyscanOutput, pinHostKey } from "../../fleet/host-keys.js";
import { resolveKnownHostsPath } from "../../fleet/paths.js";
import { sshExec, sshKeyscan } from "../../fleet/ssh-transport.js";
import { getNode, updateNode } from "../../fleet/store.js";

export type FleetPingOptions = {
  timeout: string;
  trustHostKeyChange: boolean;
  json: boolean;
};

type PingResult = {
  name: string;
  reachable: boolean;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  hostKeyStatus: "pinned" | "new" | "changed" | "verified";
  error?: string;
};

/**
 * Test SSH connectivity to a fleet node.
 *
 * Flow:
 * 1. Load node from store
 * 2. Check/verify host key (first contact: scan and pin)
 * 3. If key changed and no --trust-host-key-change, error
 * 4. Run test command via SSH
 * 5. Update lastSeen on success
 */
export async function fleetPingCommand(
  name: string,
  opts: FleetPingOptions,
  runtime: RuntimeEnv,
): Promise<void> {
  const timeoutMs = Number.parseInt(opts.timeout, 10);
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000) {
    runtime.error("Timeout must be at least 1000ms");
    runtime.exit(1);
    return;
  }

  try {
    // Step 1: Load node from store
    const node = await getNode(name);
    if (!node) {
      outputError(runtime, opts.json, name, "Node not found");
      runtime.exit(1);
      return;
    }

    // Step 2: Check host key
    const existingKey = await getHostKey(node.host, node.port);
    let hostKeyStatus: PingResult["hostKeyStatus"];

    if (!existingKey) {
      // First contact - scan and pin host key
      runtime.log(`Scanning host key for ${node.host}:${node.port}...`);
      const keyscanResult = await sshKeyscan(node.host, node.port, timeoutMs);

      if (keyscanResult.exitCode !== 0 || !keyscanResult.output.trim()) {
        outputError(
          runtime,
          opts.json,
          name,
          `Failed to scan host key: ${keyscanResult.error || "no keys returned"}`,
        );
        runtime.exit(1);
        return;
      }

      // Parse and pin the keys
      const keys = parseKeyscanOutput(keyscanResult.output, node.host, node.port);
      if (keys.length === 0) {
        outputError(runtime, opts.json, name, "No host keys found");
        runtime.exit(1);
        return;
      }

      // Pin all keys (prefer ed25519)
      for (const key of keys) {
        await pinHostKey(key);
      }
      hostKeyStatus = "new";
      runtime.log(`Pinned ${keys.length} host key(s) for ${node.host}`);
    } else {
      // Verify existing key hasn't changed
      // We need to re-scan to compare
      const keyscanResult = await sshKeyscan(node.host, node.port, timeoutMs);

      if (keyscanResult.exitCode !== 0 || !keyscanResult.output.trim()) {
        // Can't verify - proceed with caution
        hostKeyStatus = "pinned";
      } else {
        const currentKeys = parseKeyscanOutput(keyscanResult.output, node.host, node.port);
        const matchingKey = currentKeys.find(
          (k) => k.keyType === existingKey.keyType && k.key === existingKey.key,
        );

        if (matchingKey) {
          hostKeyStatus = "verified";
        } else {
          // Key has changed!
          if (!opts.trustHostKeyChange) {
            outputError(
              runtime,
              opts.json,
              name,
              `Host key changed for ${node.host}:${node.port}! Use --trust-host-key-change to accept the new key.`,
            );
            runtime.exit(1);
            return;
          }

          // Re-pin with new keys
          for (const key of currentKeys) {
            await pinHostKey(key);
          }
          hostKeyStatus = "changed";
          runtime.log(`Re-pinned host key for ${node.host} (key changed)`);
        }
      }
    }

    // Step 3: Execute SSH ping command
    const result = await sshExec({
      host: node.host,
      port: node.port,
      user: node.user,
      command: "echo pong && uname -a",
      timeoutMs,
      knownHostsPath: resolveKnownHostsPath(),
      strictHostKeyChecking: "yes",
    });

    // Step 4: Update lastSeen on success
    if (result.exitCode === 0) {
      await updateNode(name, { lastSeen: new Date().toISOString() });
    }

    // Step 5: Output result
    const pingResult: PingResult = {
      name,
      reachable: result.exitCode === 0,
      exitCode: result.exitCode,
      stdout: result.stdout.trim(),
      stderr: result.stderr.trim(),
      timedOut: result.timedOut,
      hostKeyStatus,
    };

    if (opts.json) {
      runtime.log(JSON.stringify(pingResult, null, 2));
    } else {
      if (result.exitCode === 0) {
        const lines = result.stdout.trim().split("\n");
        const pong = lines[0] || "pong";
        const uname = lines[1] || "";
        runtime.log(`${name}: ${pong}`);
        if (uname) {
          runtime.log(`  ${uname}`);
        }
        runtime.log(`  host key: ${hostKeyStatus}`);
      } else {
        runtime.error(`${name}: failed (exit ${result.exitCode})`);
        if (result.timedOut) {
          runtime.error("  timed out");
        }
        if (result.stderr.trim()) {
          runtime.error(`  ${result.stderr.trim()}`);
        }
        runtime.exit(1);
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    outputError(runtime, opts.json, name, message);
    runtime.exit(1);
  }
}

function outputError(runtime: RuntimeEnv, json: boolean, name: string, error: string): void {
  if (json) {
    runtime.log(
      JSON.stringify(
        {
          name,
          reachable: false,
          exitCode: null,
          stdout: "",
          stderr: "",
          timedOut: false,
          hostKeyStatus: "pinned",
          error,
        },
        null,
        2,
      ),
    );
  } else {
    runtime.error(`${name}: ${error}`);
  }
}
