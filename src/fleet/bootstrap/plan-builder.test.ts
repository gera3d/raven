import { describe, expect, it } from "vitest";
import type { FleetNode } from "../types.js";
import type { NodeInfo } from "./types.js";
import { buildBootstrapPlan, formatPlan } from "./plan-builder.js";

describe("buildBootstrapPlan", () => {
  const mockNode: FleetNode = {
    id: "test-uuid-1234",
    name: "test-node",
    host: "192.168.1.100",
    port: 22,
    user: "admin",
    trusted: true,
    tags: [],
  };

  describe("macOS nodes", () => {
    it("builds full plan for fresh macOS node", () => {
      const nodeInfo: NodeInfo = {
        os: "darwin",
        arch: "arm64",
        homeDir: "/Users/admin",
        hasNode: false,
        hasNpm: false,
        hasRaven: false,
        hasService: false,
        serviceRunning: false,
      };

      const plan = buildBootstrapPlan(mockNode, nodeInfo, { version: "latest" });

      expect(plan.node).toBe(mockNode);
      expect(plan.nodeInfo).toBe(nodeInfo);
      expect(plan.targetVersion).toBe("latest");
      expect(plan.force).toBe(false);
      expect(plan.steps).toHaveLength(6);

      // Check step IDs
      const stepIds = plan.steps.map((s) => s.id);
      expect(stepIds).toContain("install-node");
      expect(stepIds).toContain("install-raven");
      expect(stepIds).toContain("create-config-dir");
      expect(stepIds).toContain("install-service");
      expect(stepIds).toContain("start-service");
      expect(stepIds).toContain("verify-service");
    });

    it("skips node installation if already present", () => {
      const nodeInfo: NodeInfo = {
        os: "darwin",
        arch: "x64",
        homeDir: "/Users/admin",
        hasNode: true,
        nodeVersion: "20.10.0",
        hasNpm: true,
        hasRaven: false,
        hasService: false,
        serviceRunning: false,
      };

      const plan = buildBootstrapPlan(mockNode, nodeInfo, { version: "latest" });
      const installNodeStep = plan.steps.find((s) => s.id === "install-node");

      expect(installNodeStep).toBeDefined();
      expect(installNodeStep?.skipIf?.(nodeInfo)).toBe(true);
    });

    it("skips raven installation if same version present", () => {
      const nodeInfo: NodeInfo = {
        os: "darwin",
        arch: "arm64",
        homeDir: "/Users/admin",
        hasNode: true,
        nodeVersion: "20.10.0",
        hasNpm: true,
        hasRaven: true,
        ravenVersion: "1.2.3",
        hasService: true,
        serviceRunning: true,
      };

      const plan = buildBootstrapPlan(mockNode, nodeInfo, { version: "1.2.3" });
      const installRavenStep = plan.steps.find((s) => s.id === "install-raven");

      expect(installRavenStep).toBeDefined();
      expect(installRavenStep?.skipIf?.(nodeInfo)).toBe(true);
    });

    it("forces raven installation when force=true", () => {
      const nodeInfo: NodeInfo = {
        os: "darwin",
        arch: "arm64",
        homeDir: "/Users/admin",
        hasNode: true,
        nodeVersion: "20.10.0",
        hasNpm: true,
        hasRaven: true,
        ravenVersion: "1.2.3",
        hasService: true,
        serviceRunning: true,
      };

      const plan = buildBootstrapPlan(mockNode, nodeInfo, { version: "1.2.3", force: true });
      const installRavenStep = plan.steps.find((s) => s.id === "install-raven");

      expect(installRavenStep).toBeDefined();
      // skipIf should return false when force is true
      expect(installRavenStep?.skipIf?.(nodeInfo)).toBe(false);
    });
  });

  describe("Linux nodes", () => {
    it("builds full plan for fresh Linux node", () => {
      const nodeInfo: NodeInfo = {
        os: "linux",
        arch: "x64",
        homeDir: "/home/admin",
        hasNode: false,
        hasNpm: false,
        hasRaven: false,
        hasService: false,
        serviceRunning: false,
      };

      const plan = buildBootstrapPlan(mockNode, nodeInfo, { version: "latest" });

      expect(plan.nodeInfo.os).toBe("linux");
      expect(plan.steps).toHaveLength(6);

      // Verify systemd-specific commands
      const serviceStep = plan.steps.find((s) => s.id === "install-service");
      expect(serviceStep).toBeDefined();
      expect(serviceStep?.commands.some((c) => c.includes("systemctl"))).toBe(true);
    });

    it("uses systemd user service for Linux", () => {
      const nodeInfo: NodeInfo = {
        os: "linux",
        arch: "arm64",
        homeDir: "/home/admin",
        hasNode: true,
        hasNpm: true,
        hasRaven: false,
        hasService: false,
        serviceRunning: false,
      };

      const plan = buildBootstrapPlan(mockNode, nodeInfo);
      const startStep = plan.steps.find((s) => s.id === "start-service");

      expect(startStep).toBeDefined();
      expect(startStep?.commands.some((c) => c.includes("systemctl --user"))).toBe(true);
    });
  });

  describe("unsupported OS", () => {
    it("throws error for unknown OS", () => {
      const nodeInfo: NodeInfo = {
        os: "unknown",
        arch: "x64",
        homeDir: "/home/user",
        hasNode: false,
        hasNpm: false,
        hasRaven: false,
        hasService: false,
        serviceRunning: false,
      };

      expect(() => buildBootstrapPlan(mockNode, nodeInfo)).toThrow(
        /unsupported.*operating system/i,
      );
    });
  });
});

describe("formatPlan", () => {
  const mockNode: FleetNode = {
    id: "test-uuid-1234",
    name: "prod-server-1",
    host: "prod.example.com",
    port: 22,
    user: "deploy",
    trusted: true,
    tags: ["production"],
  };

  it("formats plan with all steps", () => {
    const nodeInfo: NodeInfo = {
      os: "darwin",
      arch: "arm64",
      homeDir: "/Users/deploy",
      hasNode: false,
      hasNpm: false,
      hasRaven: false,
      hasService: false,
      serviceRunning: false,
    };

    const plan = buildBootstrapPlan(mockNode, nodeInfo, { version: "1.0.0" });
    const formatted = formatPlan(plan);

    expect(formatted).toContain("prod-server-1");
    expect(formatted).toContain("prod.example.com");
    expect(formatted).toContain("darwin");
    expect(formatted).toContain("arm64");
    expect(formatted).toContain("1.0.0");
  });

  it("indicates skipped steps", () => {
    const nodeInfo: NodeInfo = {
      os: "darwin",
      arch: "arm64",
      homeDir: "/Users/deploy",
      hasNode: true,
      nodeVersion: "20.10.0",
      hasNpm: true,
      hasRaven: false,
      hasService: false,
      serviceRunning: false,
    };

    const plan = buildBootstrapPlan(mockNode, nodeInfo);
    const formatted = formatPlan(plan);

    // The install-node step should be marked as SKIP
    expect(formatted).toMatch(/install.*node.*\[SKIP\]/i);
  });
});
