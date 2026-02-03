import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { addNode, getNode, listNodes, loadFleetStore, removeNode, updateNode } from "./store.js";

describe("fleet store", () => {
  let tempDir: string;
  let testEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    // Create a temp directory for each test
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "fleet-test-"));
    testEnv = { RAVEN_FLEET_DIR: tempDir };
  });

  afterEach(async () => {
    // Clean up temp directory
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("loadFleetStore", () => {
    it("returns empty store when file does not exist", async () => {
      const store = await loadFleetStore(testEnv);
      expect(store.schemaVersion).toBe(1);
      expect(store.nodes).toEqual([]);
    });

    it("creates directory if missing", async () => {
      const nestedDir = path.join(tempDir, "nested", "dir");
      const nestedEnv = { RAVEN_FLEET_DIR: nestedDir };

      const store = await loadFleetStore(nestedEnv);
      expect(store.nodes).toEqual([]);
    });
  });

  describe("addNode", () => {
    it("adds a node with generated UUID", async () => {
      const node = await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: ["dev"],
        },
        testEnv,
      );

      expect(node.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      expect(node.name).toBe("test-node");
      expect(node.host).toBe("192.168.1.100");
      expect(node.port).toBe(22);
      expect(node.user).toBe("admin");
      expect(node.trusted).toBe(false);
      expect(node.tags).toEqual(["dev"]);
    });

    it("rejects duplicate node names (case-insensitive)", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      await expect(
        addNode(
          {
            name: "TEST-NODE",
            host: "192.168.1.200",
            port: 22,
            user: "root",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/already exists/i);
    });

    it("rejects invalid node name characters", async () => {
      await expect(
        addNode(
          {
            name: "test node",
            host: "192.168.1.100",
            port: 22,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/letters, numbers, hyphens/i);

      await expect(
        addNode(
          {
            name: "test/node",
            host: "192.168.1.100",
            port: 22,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/letters, numbers, hyphens/i);
    });

    it("rejects empty node name", async () => {
      await expect(
        addNode(
          {
            name: "",
            host: "192.168.1.100",
            port: 22,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/empty/i);
    });

    it("rejects host starting with dash (security)", async () => {
      await expect(
        addNode(
          {
            name: "test-node",
            host: "-evil-host",
            port: 22,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/cannot start with/i);
    });

    it("rejects empty host", async () => {
      await expect(
        addNode(
          {
            name: "test-node",
            host: "",
            port: 22,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/empty/i);
    });

    it("rejects invalid port", async () => {
      await expect(
        addNode(
          {
            name: "test-node",
            host: "192.168.1.100",
            port: 0,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/port/i);

      await expect(
        addNode(
          {
            name: "test-node2",
            host: "192.168.1.100",
            port: 70000,
            user: "admin",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/port/i);
    });

    it("rejects empty user", async () => {
      await expect(
        addNode(
          {
            name: "test-node",
            host: "192.168.1.100",
            port: 22,
            user: "",
            trusted: false,
            tags: [],
          },
          testEnv,
        ),
      ).rejects.toThrow(/user.*empty/i);
    });
  });

  describe("listNodes", () => {
    it("returns all nodes", async () => {
      await addNode(
        {
          name: "node-a",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );
      await addNode(
        {
          name: "node-b",
          host: "192.168.1.101",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      const nodes = await listNodes(testEnv);
      expect(nodes).toHaveLength(2);
      expect(nodes.map((n) => n.name).sort()).toEqual(["node-a", "node-b"]);
    });

    it("returns empty array when no nodes", async () => {
      const nodes = await listNodes(testEnv);
      expect(nodes).toEqual([]);
    });
  });

  describe("getNode", () => {
    it("returns node by name", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: ["prod"],
        },
        testEnv,
      );

      const node = await getNode("test-node", testEnv);
      expect(node).not.toBeNull();
      expect(node?.name).toBe("test-node");
      expect(node?.tags).toEqual(["prod"]);
    });

    it("returns node with case-insensitive lookup", async () => {
      await addNode(
        {
          name: "Test-Node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      const node = await getNode("TEST-NODE", testEnv);
      expect(node).not.toBeNull();
      expect(node?.name).toBe("Test-Node");
    });

    it("returns null for unknown node", async () => {
      const node = await getNode("nonexistent", testEnv);
      expect(node).toBeNull();
    });
  });

  describe("removeNode", () => {
    it("removes existing node", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      const removed = await removeNode("test-node", testEnv);
      expect(removed).toBe(true);

      const node = await getNode("test-node", testEnv);
      expect(node).toBeNull();
    });

    it("returns false when removing unknown node", async () => {
      const removed = await removeNode("nonexistent", testEnv);
      expect(removed).toBe(false);
    });

    it("removes with case-insensitive lookup", async () => {
      await addNode(
        {
          name: "Test-Node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      const removed = await removeNode("TEST-NODE", testEnv);
      expect(removed).toBe(true);
    });
  });

  describe("updateNode", () => {
    it("updates existing node fields", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: ["dev"],
        },
        testEnv,
      );

      const updated = await updateNode(
        "test-node",
        {
          host: "192.168.1.200",
          trusted: true,
          tags: ["prod"],
        },
        testEnv,
      );

      expect(updated).not.toBeNull();
      expect(updated?.host).toBe("192.168.1.200");
      expect(updated?.trusted).toBe(true);
      expect(updated?.tags).toEqual(["prod"]);
      // Unchanged fields should be preserved
      expect(updated?.name).toBe("test-node");
      expect(updated?.port).toBe(22);
      expect(updated?.user).toBe("admin");
    });

    it("returns null for unknown node", async () => {
      const updated = await updateNode("nonexistent", { trusted: true }, testEnv);
      expect(updated).toBeNull();
    });

    it("updates lastSeen timestamp", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      const now = new Date().toISOString();
      const updated = await updateNode("test-node", { lastSeen: now }, testEnv);

      expect(updated?.lastSeen).toBe(now);
    });

    it("validates host on update", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      await expect(updateNode("test-node", { host: "-evil" }, testEnv)).rejects.toThrow(
        /cannot start with/i,
      );
    });

    it("validates port on update", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      await expect(updateNode("test-node", { port: 99999 }, testEnv)).rejects.toThrow(/port/i);
    });
  });

  describe("file persistence", () => {
    it("persists nodes across operations", async () => {
      await addNode(
        {
          name: "node-1",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      // Load fresh to verify persistence
      const store = await loadFleetStore(testEnv);
      expect(store.nodes).toHaveLength(1);
      expect(store.nodes[0]?.name).toBe("node-1");
    });

    it("creates store file with correct permissions", async () => {
      await addNode(
        {
          name: "test-node",
          host: "192.168.1.100",
          port: 22,
          user: "admin",
          trusted: false,
          tags: [],
        },
        testEnv,
      );

      const nodesPath = path.join(tempDir, "nodes.json");
      const stats = await fs.promises.stat(nodesPath);
      // File should be readable/writable by owner only (0o600)
      const mode = stats.mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });
});
