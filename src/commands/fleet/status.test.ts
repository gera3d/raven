import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { FleetNode } from "../../fleet/types.js";

// Mock SSH transport
vi.mock("../../fleet/ssh-transport.js", () => ({
  sshExec: vi.fn(),
}));

// Mock fleet store
vi.mock("../../fleet/store.js", () => ({
  getNode: vi.fn(),
  listNodes: vi.fn(),
  updateNode: vi.fn(),
}));

// Mock paths
vi.mock("../../fleet/paths.js", () => ({
  resolveKnownHostsPath: () => "/tmp/known_hosts",
}));

describe("fleet status command", () => {
  let mockSshExec: ReturnType<typeof vi.fn>;
  let mockGetNode: ReturnType<typeof vi.fn>;
  let mockListNodes: ReturnType<typeof vi.fn>;
  let mockUpdateNode: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();

    const sshMod = await import("../../fleet/ssh-transport.js");
    const storeMod = await import("../../fleet/store.js");

    mockSshExec = sshMod.sshExec as ReturnType<typeof vi.fn>;
    mockGetNode = storeMod.getNode as ReturnType<typeof vi.fn>;
    mockListNodes = storeMod.listNodes as ReturnType<typeof vi.fn>;
    mockUpdateNode = storeMod.updateNode as ReturnType<typeof vi.fn>;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  const createMockNode = (name: string, host: string = "192.168.1.100"): FleetNode => ({
    id: `uuid-${name}`,
    name,
    host,
    port: 22,
    user: "admin",
    trusted: true,
    tags: [],
  });

  const createMockRuntime = () => {
    const logs: string[] = [];
    const errors: string[] = [];
    return {
      log: (msg: string) => logs.push(msg),
      error: (msg: string) => errors.push(msg),
      exit: vi.fn(),
      logs,
      errors,
    };
  };

  describe("runNodeDiagnostics", () => {
    it("parses successful diagnostics output", async () => {
      const { runNodeDiagnostics } = await import("./status.js");

      const node = createMockNode("test-node");

      mockSshExec.mockResolvedValueOnce({
        stdout: `DIAG_START
VERSION:1.2.3
SERVICE:running
STATUS_JSON:{"uptime":3600000}
DIAG_END`,
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });

      const result = await runNodeDiagnostics(node, 10000);

      expect(result.online).toBe(true);
      expect(result.serviceRunning).toBe(true);
      expect(result.serviceStatus).toBe("running");
      expect(result.version).toBe("1.2.3");
      expect(result.uptime).toBe("1h 0m");
      expect(result.error).toBeNull();
    });

    it("handles stopped service", async () => {
      const { runNodeDiagnostics } = await import("./status.js");

      const node = createMockNode("test-node");

      mockSshExec.mockResolvedValueOnce({
        stdout: `DIAG_START
VERSION:1.2.3
SERVICE:stopped
STATUS_JSON:{}
DIAG_END`,
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });

      const result = await runNodeDiagnostics(node, 10000);

      expect(result.online).toBe(true);
      expect(result.serviceRunning).toBe(false);
      expect(result.serviceStatus).toBe("stopped");
    });

    it("handles missing raven installation", async () => {
      const { runNodeDiagnostics } = await import("./status.js");

      const node = createMockNode("test-node");

      mockSshExec.mockResolvedValueOnce({
        stdout: `DIAG_START
VERSION:NOT_FOUND
SERVICE:stopped
STATUS_JSON:{}
DIAG_END`,
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });

      const result = await runNodeDiagnostics(node, 10000);

      expect(result.online).toBe(true);
      expect(result.version).toBeNull();
    });

    it("handles timeout", async () => {
      const { runNodeDiagnostics } = await import("./status.js");

      const node = createMockNode("test-node");

      mockSshExec.mockResolvedValueOnce({
        stdout: "",
        stderr: "",
        exitCode: null,
        timedOut: true,
      });

      const result = await runNodeDiagnostics(node, 10000);

      expect(result.online).toBe(false);
      expect(result.error).toContain("timed out");
    });

    it("handles SSH connection failure", async () => {
      const { runNodeDiagnostics } = await import("./status.js");

      const node = createMockNode("test-node");

      mockSshExec.mockResolvedValueOnce({
        stdout: "",
        stderr: "Connection refused",
        exitCode: 255,
        timedOut: false,
      });

      const result = await runNodeDiagnostics(node, 10000);

      expect(result.online).toBe(false);
      expect(result.error).toContain("Connection refused");
    });
  });

  describe("fleetStatusCommand", () => {
    it("checks single node by name", async () => {
      const { fleetStatusCommand } = await import("./status.js");

      const node = createMockNode("prod-1", "prod.example.com");
      const runtime = createMockRuntime();

      mockGetNode.mockResolvedValueOnce(node);
      mockSshExec.mockResolvedValueOnce({
        stdout: `DIAG_START
VERSION:1.0.0
SERVICE:running
STATUS_JSON:{"uptime":7200000}
DIAG_END`,
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });
      mockUpdateNode.mockResolvedValueOnce(undefined);

      await fleetStatusCommand("prod-1", { json: false, timeout: "10000" }, runtime);

      expect(mockGetNode).toHaveBeenCalledWith("prod-1");
      expect(runtime.logs.some((l) => l.includes("prod-1"))).toBe(true);
      expect(runtime.logs.some((l) => l.includes("online"))).toBe(true);
    });

    it("checks all nodes when no name provided", async () => {
      const { fleetStatusCommand } = await import("./status.js");

      const nodes = [
        createMockNode("node-1", "192.168.1.1"),
        createMockNode("node-2", "192.168.1.2"),
      ];
      const runtime = createMockRuntime();

      mockListNodes.mockResolvedValueOnce(nodes);

      // Both nodes respond successfully
      mockSshExec.mockResolvedValueOnce({
        stdout: "DIAG_START\nVERSION:1.0.0\nSERVICE:running\nSTATUS_JSON:{}\nDIAG_END",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });
      mockSshExec.mockResolvedValueOnce({
        stdout: "DIAG_START\nVERSION:1.0.0\nSERVICE:stopped\nSTATUS_JSON:{}\nDIAG_END",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });
      mockUpdateNode.mockResolvedValue(undefined);

      await fleetStatusCommand(undefined, { json: false, timeout: "10000" }, runtime);

      expect(mockListNodes).toHaveBeenCalled();
      expect(mockSshExec).toHaveBeenCalledTimes(2);
    });

    it("outputs JSON when requested", async () => {
      const { fleetStatusCommand } = await import("./status.js");

      const node = createMockNode("test-node");
      const runtime = createMockRuntime();

      mockGetNode.mockResolvedValueOnce(node);
      mockSshExec.mockResolvedValueOnce({
        stdout: "DIAG_START\nVERSION:1.0.0\nSERVICE:running\nSTATUS_JSON:{}\nDIAG_END",
        stderr: "",
        exitCode: 0,
        timedOut: false,
      });
      mockUpdateNode.mockResolvedValueOnce(undefined);

      await fleetStatusCommand("test-node", { json: true, timeout: "10000" }, runtime);

      const jsonOutput = runtime.logs.find((l) => l.startsWith("{"));
      expect(jsonOutput).toBeDefined();

      const parsed = JSON.parse(jsonOutput!);
      expect(parsed.nodes).toBeDefined();
      expect(parsed.nodes[0].name).toBe("test-node");
      expect(parsed.nodes[0].online).toBe(true);
    });

    it("handles node not found", async () => {
      const { fleetStatusCommand } = await import("./status.js");

      const runtime = createMockRuntime();

      mockGetNode.mockResolvedValueOnce(null);

      await fleetStatusCommand("nonexistent", { json: false, timeout: "10000" }, runtime);

      expect(runtime.errors.some((e) => e.includes("not found"))).toBe(true);
      expect(runtime.exit).toHaveBeenCalledWith(1);
    });

    it("handles empty fleet", async () => {
      const { fleetStatusCommand } = await import("./status.js");

      const runtime = createMockRuntime();

      mockListNodes.mockResolvedValueOnce([]);

      await fleetStatusCommand(undefined, { json: false, timeout: "10000" }, runtime);

      expect(runtime.logs.some((l) => l.includes("No fleet nodes"))).toBe(true);
    });

    it("validates timeout parameter", async () => {
      const { fleetStatusCommand } = await import("./status.js");

      const runtime = createMockRuntime();

      await fleetStatusCommand("test", { json: false, timeout: "invalid" }, runtime);

      expect(runtime.errors.some((e) => e.includes("Timeout"))).toBe(true);
      expect(runtime.exit).toHaveBeenCalledWith(1);
    });
  });
});
