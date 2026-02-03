/**
 * Service templates for fleet bootstrap.
 *
 * These templates are used to install raven as a system service
 * on remote nodes during bootstrap.
 */

/**
 * Template variables for service files.
 */
export type ServiceTemplateVars = {
  /** Path to the raven executable */
  execPath: string;
  /** Path to the config directory */
  configDir: string;
  /** Node.js PATH for environment */
  nodePath: string;
  /** User's home directory */
  homeDir: string;
};

/**
 * Default template variables.
 */
export const DEFAULT_TEMPLATE_VARS: ServiceTemplateVars = {
  execPath: "/usr/local/bin/raven",
  configDir: "~/.openclaw",
  nodePath: "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin",
  homeDir: "~",
};

/**
 * Generate the launchd plist for macOS.
 *
 * The plist installs as a user-level LaunchAgent that:
 * - Starts the raven gateway on login
 * - Keeps it running (restarts on crash)
 * - Logs stdout/stderr to /tmp
 */
export function generateLaunchdPlist(vars: Partial<ServiceTemplateVars> = {}): string {
  const v = { ...DEFAULT_TEMPLATE_VARS, ...vars };

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.raven.gateway</string>
    <key>ProgramArguments</key>
    <array>
        <string>${v.execPath}</string>
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
        <string>${v.nodePath}</string>
        <key>HOME</key>
        <string>${v.homeDir}</string>
    </dict>
</dict>
</plist>`;
}

/**
 * Generate the systemd user service unit for Linux.
 *
 * The service installs as a user-level systemd unit that:
 * - Starts the raven gateway on login (with lingering)
 * - Restarts on failure with 5 second delay
 * - Uses user-level service directory
 */
export function generateSystemdUnit(vars: Partial<ServiceTemplateVars> = {}): string {
  const v = { ...DEFAULT_TEMPLATE_VARS, ...vars };

  return `[Unit]
Description=Raven Gateway Service
After=network.target

[Service]
Type=simple
ExecStart=${v.execPath} gateway start
Restart=always
RestartSec=5
Environment=PATH=${v.nodePath}
Environment=HOME=${v.homeDir}

[Install]
WantedBy=default.target`;
}

/**
 * Commands to install the launchd service on macOS.
 */
export function getLaunchdInstallCommands(vars: Partial<ServiceTemplateVars> = {}): string[] {
  const plistContent = generateLaunchdPlist(vars);
  const plistPath = "~/Library/LaunchAgents/ai.raven.gateway.plist";

  return [
    "mkdir -p ~/Library/LaunchAgents",
    `cat > ${plistPath} << 'PLIST_EOF'\n${plistContent}\nPLIST_EOF`,
  ];
}

/**
 * Commands to start/restart the launchd service on macOS.
 */
export function getLaunchdStartCommands(): string[] {
  const plistPath = "~/Library/LaunchAgents/ai.raven.gateway.plist";

  return [
    // Unload first to pick up any changes (ignore errors if not loaded)
    `launchctl unload ${plistPath} 2>/dev/null || true`,
    `launchctl load ${plistPath}`,
  ];
}

/**
 * Commands to install the systemd user service on Linux.
 */
export function getSystemdInstallCommands(vars: Partial<ServiceTemplateVars> = {}): string[] {
  const unitContent = generateSystemdUnit(vars);
  const unitPath = "~/.config/systemd/user/raven-gateway.service";

  return [
    "mkdir -p ~/.config/systemd/user",
    `cat > ${unitPath} << 'SERVICE_EOF'\n${unitContent}\nSERVICE_EOF`,
    "systemctl --user daemon-reload",
    "systemctl --user enable raven-gateway",
  ];
}

/**
 * Commands to start/restart the systemd service on Linux.
 */
export function getSystemdStartCommands(): string[] {
  return ["systemctl --user restart raven-gateway"];
}

/**
 * Commands to verify the launchd service is running on macOS.
 */
export function getLaunchdVerifyCommands(): string[] {
  return [
    "sleep 2",
    'launchctl list | grep -q "ai.raven.gateway" || (echo "Service not found in launchctl list" && exit 1)',
    "raven gateway status --json --timeout 5000 || (echo 'Gateway not responding' && exit 1)",
  ];
}

/**
 * Commands to verify the systemd service is running on Linux.
 */
export function getSystemdVerifyCommands(): string[] {
  return [
    "sleep 2",
    "systemctl --user is-active raven-gateway",
    "raven gateway status --json --timeout 5000 || (echo 'Gateway not responding' && exit 1)",
  ];
}
