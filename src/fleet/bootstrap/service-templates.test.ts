import { describe, expect, it } from "vitest";
import {
  generateLaunchdPlist,
  generateSystemdUnit,
  getLaunchdInstallCommands,
  getLaunchdStartCommands,
  getLaunchdVerifyCommands,
  getSystemdInstallCommands,
  getSystemdStartCommands,
  getSystemdVerifyCommands,
} from "./service-templates.js";

describe("service-templates", () => {
  describe("generateLaunchdPlist", () => {
    it("generates valid plist with default values", () => {
      const plist = generateLaunchdPlist();

      expect(plist).toContain('<?xml version="1.0"');
      expect(plist).toContain("ai.raven.gateway");
      expect(plist).toContain("<key>RunAtLoad</key>");
      expect(plist).toContain("<true/>");
      expect(plist).toContain("<key>KeepAlive</key>");
      expect(plist).toContain("/usr/local/bin/raven");
      expect(plist).toContain("gateway");
      expect(plist).toContain("start");
    });

    it("uses custom exec path", () => {
      const plist = generateLaunchdPlist({ execPath: "/opt/raven/bin/raven" });

      expect(plist).toContain("/opt/raven/bin/raven");
      expect(plist).not.toContain("/usr/local/bin/raven");
    });

    it("includes environment variables", () => {
      const plist = generateLaunchdPlist({
        nodePath: "/custom/path:/bin",
        homeDir: "/home/testuser",
      });

      expect(plist).toContain("<key>PATH</key>");
      expect(plist).toContain("/custom/path:/bin");
      expect(plist).toContain("<key>HOME</key>");
      expect(plist).toContain("/home/testuser");
    });

    it("specifies log paths", () => {
      const plist = generateLaunchdPlist();

      expect(plist).toContain("<key>StandardOutPath</key>");
      expect(plist).toContain("/tmp/raven-gateway.stdout.log");
      expect(plist).toContain("<key>StandardErrorPath</key>");
      expect(plist).toContain("/tmp/raven-gateway.stderr.log");
    });
  });

  describe("generateSystemdUnit", () => {
    it("generates valid systemd unit with default values", () => {
      const unit = generateSystemdUnit();

      expect(unit).toContain("[Unit]");
      expect(unit).toContain("[Service]");
      expect(unit).toContain("[Install]");
      expect(unit).toContain("Description=Raven Gateway Service");
      expect(unit).toContain("After=network.target");
      expect(unit).toContain("Type=simple");
      expect(unit).toContain("Restart=always");
      expect(unit).toContain("RestartSec=5");
      expect(unit).toContain("WantedBy=default.target");
    });

    it("uses custom exec path", () => {
      const unit = generateSystemdUnit({ execPath: "/opt/raven/bin/raven" });

      expect(unit).toContain("ExecStart=/opt/raven/bin/raven gateway start");
    });

    it("includes PATH environment", () => {
      const unit = generateSystemdUnit({ nodePath: "/custom/path:/bin" });

      expect(unit).toContain("Environment=PATH=/custom/path:/bin");
    });

    it("includes HOME environment", () => {
      const unit = generateSystemdUnit({ homeDir: "/home/testuser" });

      expect(unit).toContain("Environment=HOME=/home/testuser");
    });
  });

  describe("getLaunchdInstallCommands", () => {
    it("returns commands to create directory and write plist", () => {
      const commands = getLaunchdInstallCommands();

      expect(commands).toHaveLength(2);
      expect(commands[0]).toContain("mkdir -p ~/Library/LaunchAgents");
      expect(commands[1]).toContain("cat >");
      expect(commands[1]).toContain("ai.raven.gateway.plist");
      expect(commands[1]).toContain("PLIST_EOF");
    });
  });

  describe("getLaunchdStartCommands", () => {
    it("returns commands to unload and load plist", () => {
      const commands = getLaunchdStartCommands();

      expect(commands).toHaveLength(2);
      expect(commands[0]).toContain("launchctl unload");
      expect(commands[0]).toContain("|| true"); // Ignore errors
      expect(commands[1]).toContain("launchctl load");
    });
  });

  describe("getLaunchdVerifyCommands", () => {
    it("returns commands to verify service is running", () => {
      const commands = getLaunchdVerifyCommands();

      expect(commands.length).toBeGreaterThanOrEqual(2);
      expect(commands.some((c) => c.includes("sleep"))).toBe(true);
      expect(commands.some((c) => c.includes("launchctl list"))).toBe(true);
      expect(commands.some((c) => c.includes("raven gateway status"))).toBe(true);
    });
  });

  describe("getSystemdInstallCommands", () => {
    it("returns commands to create directory and write unit file", () => {
      const commands = getSystemdInstallCommands();

      expect(commands).toHaveLength(4);
      expect(commands[0]).toContain("mkdir -p ~/.config/systemd/user");
      expect(commands[1]).toContain("raven-gateway.service");
      expect(commands[2]).toContain("systemctl --user daemon-reload");
      expect(commands[3]).toContain("systemctl --user enable raven-gateway");
    });
  });

  describe("getSystemdStartCommands", () => {
    it("returns command to restart service", () => {
      const commands = getSystemdStartCommands();

      expect(commands).toHaveLength(1);
      expect(commands[0]).toContain("systemctl --user restart raven-gateway");
    });
  });

  describe("getSystemdVerifyCommands", () => {
    it("returns commands to verify service is running", () => {
      const commands = getSystemdVerifyCommands();

      expect(commands.length).toBeGreaterThanOrEqual(2);
      expect(commands.some((c) => c.includes("sleep"))).toBe(true);
      expect(commands.some((c) => c.includes("systemctl --user is-active"))).toBe(true);
      expect(commands.some((c) => c.includes("raven gateway status"))).toBe(true);
    });
  });
});
