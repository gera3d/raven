import type { FleetNode } from "../types.js";
import type { BootstrapPlan, BootstrapStep, NodeInfo } from "./types.js";

/**
 * Build the bootstrap plan for a macOS node.
 */
function buildMacOSSteps(nodeInfo: NodeInfo, version: string, force: boolean): BootstrapStep[] {
  const steps: BootstrapStep[] = [];

  // Step 1: Install Node.js if missing (via Homebrew)
  steps.push({
    id: "install-node",
    description: "Install Node.js via Homebrew",
    commands: [
      'which brew > /dev/null 2>&1 || /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
      "brew install node",
    ],
    skippable: true,
    skipIf: (info) => info.hasNode,
    errorHint: "Node.js installation failed. Please install Node.js manually: brew install node",
  });

  // Step 2: Install raven globally via npm
  const installCmd =
    version === "latest" ? "npm install -g raven" : `npm install -g raven@${version}`;

  steps.push({
    id: "install-raven",
    description: `Install raven${version !== "latest" ? ` (${version})` : ""}`,
    commands: [installCmd],
    skippable: !force,
    skipIf: (info) =>
      !force && info.hasRaven && (version === "latest" || info.ravenVersion === version),
    errorHint: "Raven installation failed. Check npm configuration and network connectivity.",
  });

  // Step 3: Create config directory
  steps.push({
    id: "create-config-dir",
    description: "Create configuration directory",
    commands: ["mkdir -p ~/.openclaw", "chmod 700 ~/.openclaw"],
    skippable: false,
  });

  // Step 4: Install launchd service
  steps.push({
    id: "install-service",
    description: "Install launchd service",
    commands: [
      "mkdir -p ~/Library/LaunchAgents",
      // The plist content will be written via a separate mechanism
      `cat > ~/Library/LaunchAgents/ai.raven.gateway.plist << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.raven.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/raven</string>
        <string>gateway</string>
        <string>start</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/raven-gateway.stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/raven-gateway.stderr.log</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
</dict>
</plist>
PLIST_EOF`,
    ],
    skippable: !force,
    skipIf: (info) => !force && info.hasService,
    errorHint: "Failed to install launchd service. Check ~/Library/LaunchAgents permissions.",
  });

  // Step 5: Load and start the service
  steps.push({
    id: "start-service",
    description: "Start raven gateway service",
    commands: [
      // Unload first if already loaded (to pick up changes)
      "launchctl unload ~/Library/LaunchAgents/ai.raven.gateway.plist 2>/dev/null || true",
      "launchctl load ~/Library/LaunchAgents/ai.raven.gateway.plist",
    ],
    skippable: false,
    errorHint: "Failed to start the service. Check launchctl logs.",
  });

  // Step 6: Verify service is running
  steps.push({
    id: "verify-service",
    description: "Verify service is running",
    commands: [
      "sleep 2",
      "launchctl list | grep -q ai.raven.gateway || (echo 'Service not found in launchctl list' && exit 1)",
      "raven gateway status --json --timeout 5000 || (echo 'Gateway not responding' && exit 1)",
    ],
    skippable: false,
    errorHint: "Service verification failed. Check /tmp/raven-gateway.stderr.log for details.",
  });

  return steps;
}

/**
 * Build the bootstrap plan for a Linux node.
 */
function buildLinuxSteps(nodeInfo: NodeInfo, version: string, force: boolean): BootstrapStep[] {
  const steps: BootstrapStep[] = [];

  // Step 1: Install Node.js if missing
  steps.push({
    id: "install-node",
    description: "Install Node.js",
    commands: [
      // Try to detect package manager and install
      `if command -v apt-get &> /dev/null; then
        curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
        sudo apt-get install -y nodejs
      elif command -v yum &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo yum install -y nodejs
      elif command -v dnf &> /dev/null; then
        curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
        sudo dnf install -y nodejs
      else
        echo "Unsupported package manager" && exit 1
      fi`,
    ],
    skippable: true,
    skipIf: (info) => info.hasNode,
    errorHint: "Node.js installation failed. Please install Node.js manually.",
  });

  // Step 2: Install raven globally via npm
  const installCmd =
    version === "latest" ? "npm install -g raven" : `npm install -g raven@${version}`;

  steps.push({
    id: "install-raven",
    description: `Install raven${version !== "latest" ? ` (${version})` : ""}`,
    commands: [installCmd],
    skippable: !force,
    skipIf: (info) =>
      !force && info.hasRaven && (version === "latest" || info.ravenVersion === version),
    errorHint: "Raven installation failed. Check npm configuration and network connectivity.",
  });

  // Step 3: Create config directory
  steps.push({
    id: "create-config-dir",
    description: "Create configuration directory",
    commands: ["mkdir -p ~/.openclaw", "chmod 700 ~/.openclaw"],
    skippable: false,
  });

  // Step 4: Install systemd user service
  steps.push({
    id: "install-service",
    description: "Install systemd user service",
    commands: [
      "mkdir -p ~/.config/systemd/user",
      `cat > ~/.config/systemd/user/raven-gateway.service << 'SERVICE_EOF'
[Unit]
Description=Raven Gateway Service
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/raven gateway start
Restart=always
RestartSec=5
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
SERVICE_EOF`,
      "systemctl --user daemon-reload",
      "systemctl --user enable raven-gateway",
    ],
    skippable: !force,
    skipIf: (info) => !force && info.hasService,
    errorHint: "Failed to install systemd service. Check ~/.config/systemd/user permissions.",
  });

  // Step 5: Start the service
  steps.push({
    id: "start-service",
    description: "Start raven gateway service",
    commands: ["systemctl --user restart raven-gateway"],
    skippable: false,
    errorHint: "Failed to start the service. Check journalctl --user -u raven-gateway for details.",
  });

  // Step 6: Verify service is running
  steps.push({
    id: "verify-service",
    description: "Verify service is running",
    commands: [
      "sleep 2",
      "systemctl --user is-active raven-gateway",
      "raven gateway status --json --timeout 5000 || (echo 'Gateway not responding' && exit 1)",
    ],
    skippable: false,
    errorHint: "Service verification failed. Check journalctl --user -u raven-gateway for details.",
  });

  return steps;
}

/**
 * Build the bootstrap plan for a node based on its OS.
 */
export function buildBootstrapPlan(
  node: FleetNode,
  nodeInfo: NodeInfo,
  options: { version?: string; force?: boolean } = {},
): BootstrapPlan {
  const version = options.version ?? "latest";
  const force = options.force ?? false;

  let steps: BootstrapStep[];

  switch (nodeInfo.os) {
    case "darwin":
      steps = buildMacOSSteps(nodeInfo, version, force);
      break;
    case "linux":
      steps = buildLinuxSteps(nodeInfo, version, force);
      break;
    default:
      throw new Error(`Unsupported operating system: ${nodeInfo.os}`);
  }

  return {
    node,
    nodeInfo,
    steps,
    targetVersion: version,
    force,
  };
}

/**
 * Format the bootstrap plan as a human-readable string.
 */
export function formatPlan(plan: BootstrapPlan): string {
  const lines: string[] = [];

  lines.push(`Bootstrap plan for ${plan.node.name} (${plan.node.host})`);
  lines.push(`  OS: ${plan.nodeInfo.os}, Arch: ${plan.nodeInfo.arch}`);
  lines.push(`  Target version: ${plan.targetVersion}`);
  lines.push(`  Force: ${plan.force}`);
  lines.push("");
  lines.push("Steps:");

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step) continue;

    const willSkip = step.skipIf?.(plan.nodeInfo) ?? false;
    const skipIndicator = willSkip ? " [SKIP]" : "";

    lines.push(`  ${i + 1}. ${step.description}${skipIndicator}`);

    if (!willSkip) {
      for (const cmd of step.commands) {
        // Truncate long commands for readability
        const displayCmd = cmd.length > 60 ? cmd.substring(0, 57) + "..." : cmd;
        lines.push(`     $ ${displayCmd}`);
      }
    }
  }

  return lines.join("\n");
}
