import type { Command } from "commander";
import { defaultRuntime } from "../runtime.js";
import { runCommandWithRuntime } from "./cli-utils.js";

/**
 * Wrapper for fleet commands with consistent error handling.
 */
function runFleetCommand(action: () => Promise<void>) {
  return runCommandWithRuntime(defaultRuntime, action);
}

/**
 * Register the fleet CLI subcommands.
 *
 * Commands:
 * - fleet add    - Add a node to the fleet
 * - fleet list   - List all fleet nodes
 * - fleet get    - Get details of a specific node
 * - fleet rm     - Remove a node from the fleet
 * - fleet ping   - Test SSH connectivity to a node
 */
export function registerFleetCli(program: Command) {
  const fleet = program.command("fleet").description("Manage remote fleet nodes");

  // fleet add
  fleet
    .command("add")
    .description("Add a node to the fleet")
    .argument("<name>", "Unique node name")
    .requiredOption("--host <host>", "SSH hostname or IP address")
    .requiredOption("--user <user>", "SSH username")
    .option("--port <port>", "SSH port", "22")
    .option("--tags <tags>", "Comma-separated tags")
    .option("--json", "Output JSON", false)
    .action(async (name: string, opts) => {
      await runFleetCommand(async () => {
        const { fleetAddCommand } = await import("../commands/fleet/add.js");
        await fleetAddCommand(
          name,
          {
            host: opts.host as string,
            user: opts.user as string,
            port: opts.port as string,
            tags: opts.tags as string | undefined,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  // fleet list
  fleet
    .command("list")
    .description("List all fleet nodes")
    .option("--json", "Output JSON", false)
    .action(async (opts) => {
      await runFleetCommand(async () => {
        const { fleetListCommand } = await import("../commands/fleet/list.js");
        await fleetListCommand(
          {
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  // fleet get
  fleet
    .command("get")
    .description("Get details of a specific node")
    .argument("<name>", "Node name")
    .option("--json", "Output JSON", false)
    .action(async (name: string, opts) => {
      await runFleetCommand(async () => {
        const { fleetGetCommand } = await import("../commands/fleet/get.js");
        await fleetGetCommand(
          name,
          {
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  // fleet rm
  fleet
    .command("rm")
    .description("Remove a node from the fleet")
    .argument("<name>", "Node name")
    .option("--force", "Skip confirmation", false)
    .option("--json", "Output JSON", false)
    .action(async (name: string, opts) => {
      await runFleetCommand(async () => {
        const { fleetRmCommand } = await import("../commands/fleet/rm.js");
        await fleetRmCommand(
          name,
          {
            force: Boolean(opts.force),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  // fleet ping
  fleet
    .command("ping")
    .description("Test SSH connectivity to a node")
    .argument("<name>", "Node name")
    .option("--timeout <ms>", "Timeout in milliseconds", "10000")
    .option("--trust-host-key-change", "Accept changed host key and re-pin", false)
    .option("--json", "Output JSON", false)
    .action(async (name: string, opts) => {
      await runFleetCommand(async () => {
        const { fleetPingCommand } = await import("../commands/fleet/ping.js");
        await fleetPingCommand(
          name,
          {
            timeout: opts.timeout as string,
            trustHostKeyChange: Boolean(opts.trustHostKeyChange),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  // fleet bootstrap
  fleet
    .command("bootstrap")
    .description("Bootstrap a node with Raven installation")
    .argument("<name>", "Node name")
    .option("--version <version>", "Version to install (git sha or tag)", "latest")
    .option("--force", "Force reinstall even if already installed", false)
    .option("--dry-run", "Show what would be done without executing", false)
    .option("--json", "Output JSON", false)
    .action(async (name: string, opts) => {
      await runFleetCommand(async () => {
        const { fleetBootstrapCommand } = await import("../commands/fleet/bootstrap.js");
        await fleetBootstrapCommand(
          name,
          {
            version: opts.version as string,
            force: Boolean(opts.force),
            dryRun: Boolean(opts.dryRun),
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });

  // fleet status
  fleet
    .command("status")
    .description("Check status of fleet nodes")
    .argument("[name]", "Node name (optional, checks all if omitted)")
    .option("--timeout <ms>", "Timeout in milliseconds", "15000")
    .option("--json", "Output JSON", false)
    .action(async (name: string | undefined, opts) => {
      await runFleetCommand(async () => {
        const { fleetStatusCommand } = await import("../commands/fleet/status.js");
        await fleetStatusCommand(
          name,
          {
            timeout: opts.timeout as string,
            json: Boolean(opts.json),
          },
          defaultRuntime,
        );
      });
    });
}
