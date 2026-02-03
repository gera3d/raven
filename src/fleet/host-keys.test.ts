import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  formatKnownHosts,
  getHostKey,
  hasHostKeyChanged,
  loadKnownHosts,
  parseKeyscanOutput,
  parseKnownHosts,
  pinHostKey,
  removeHostKey,
  saveKnownHosts,
  type HostKeyEntry,
} from "./host-keys.js";

describe("host-keys", () => {
  let tempDir: string;
  let testEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "host-keys-test-"));
    testEnv = { RAVEN_FLEET_DIR: tempDir };
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("parseKnownHosts", () => {
    it("parses standard known_hosts format", () => {
      const content = `
example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBtest1234
192.168.1.100 ssh-rsa AAAAB3NzaC1yc2EAAAAtest5678
      `.trim();

      const entries = parseKnownHosts(content);
      expect(entries).toHaveLength(2);
      expect(entries[0]).toEqual({
        host: "example.com",
        port: 22,
        keyType: "ssh-ed25519",
        key: "AAAAC3NzaC1lZDI1NTE5AAAAIBtest1234",
      });
      expect(entries[1]).toEqual({
        host: "192.168.1.100",
        port: 22,
        keyType: "ssh-rsa",
        key: "AAAAB3NzaC1yc2EAAAAtest5678",
      });
    });

    it("parses non-standard port format", () => {
      const content = "[example.com]:2222 ssh-ed25519 AAAAC3test";
      const entries = parseKnownHosts(content);
      expect(entries).toHaveLength(1);
      expect(entries[0]).toEqual({
        host: "example.com",
        port: 2222,
        keyType: "ssh-ed25519",
        key: "AAAAC3test",
      });
    });

    it("skips empty lines and comments", () => {
      const content = `
# This is a comment
example.com ssh-ed25519 AAAAC3test

# Another comment
      `;
      const entries = parseKnownHosts(content);
      expect(entries).toHaveLength(1);
    });

    it("skips malformed lines", () => {
      const content = `
example.com ssh-ed25519
incomplete line
example.com ssh-ed25519 AAAAC3test
      `;
      const entries = parseKnownHosts(content);
      expect(entries).toHaveLength(1);
    });
  });

  describe("formatKnownHosts", () => {
    it("formats entries to known_hosts format", () => {
      const entries: HostKeyEntry[] = [
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "AAAAC3test" },
        { host: "192.168.1.100", port: 2222, keyType: "ssh-rsa", key: "AAAAB3test" },
      ];

      const content = formatKnownHosts(entries);
      expect(content).toBe(
        "example.com ssh-ed25519 AAAAC3test\n[192.168.1.100]:2222 ssh-rsa AAAAB3test\n",
      );
    });
  });

  describe("parseKeyscanOutput", () => {
    it("parses ssh-keyscan output", () => {
      const output = `
# example.com:22 SSH-2.0-OpenSSH_8.9
example.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBtest
example.com ssh-rsa AAAAB3NzaC1yc2EAAAAtest
      `.trim();

      const entries = parseKeyscanOutput(output, "example.com", 22);
      expect(entries).toHaveLength(2);
      expect(entries[0]?.keyType).toBe("ssh-ed25519");
      expect(entries[1]?.keyType).toBe("ssh-rsa");
      // Host and port are from the parameters, not the output
      expect(entries[0]?.host).toBe("example.com");
      expect(entries[0]?.port).toBe(22);
    });
  });

  describe("loadKnownHosts / saveKnownHosts", () => {
    it("returns empty array when file does not exist", async () => {
      const entries = await loadKnownHosts(testEnv);
      expect(entries).toEqual([]);
    });

    it("saves and loads entries", async () => {
      const entries: HostKeyEntry[] = [
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "AAAAC3test" },
      ];

      await saveKnownHosts(entries, testEnv);
      const loaded = await loadKnownHosts(testEnv);

      expect(loaded).toHaveLength(1);
      expect(loaded[0]).toEqual(entries[0]);
    });

    it("creates directory if missing", async () => {
      const nestedDir = path.join(tempDir, "nested", "dir");
      const nestedEnv = { RAVEN_FLEET_DIR: nestedDir };

      await saveKnownHosts(
        [{ host: "example.com", port: 22, keyType: "ssh-ed25519", key: "test" }],
        nestedEnv,
      );

      const exists = await fs.promises
        .access(path.join(nestedDir, "known_hosts"))
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe("getHostKey", () => {
    it("returns null when no key exists", async () => {
      const key = await getHostKey("example.com", 22, testEnv);
      expect(key).toBeNull();
    });

    it("returns matching key", async () => {
      await saveKnownHosts(
        [{ host: "example.com", port: 22, keyType: "ssh-ed25519", key: "testkey" }],
        testEnv,
      );

      const key = await getHostKey("example.com", 22, testEnv);
      expect(key).not.toBeNull();
      expect(key?.key).toBe("testkey");
    });

    it("prefers ed25519 over rsa", async () => {
      await saveKnownHosts(
        [
          { host: "example.com", port: 22, keyType: "ssh-rsa", key: "rsakey" },
          { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "ed25519key" },
        ],
        testEnv,
      );

      const key = await getHostKey("example.com", 22, testEnv);
      expect(key?.keyType).toBe("ssh-ed25519");
      expect(key?.key).toBe("ed25519key");
    });

    it("matches host and port", async () => {
      await saveKnownHosts(
        [
          { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "key22" },
          { host: "example.com", port: 2222, keyType: "ssh-ed25519", key: "key2222" },
        ],
        testEnv,
      );

      const key22 = await getHostKey("example.com", 22, testEnv);
      const key2222 = await getHostKey("example.com", 2222, testEnv);

      expect(key22?.key).toBe("key22");
      expect(key2222?.key).toBe("key2222");
    });
  });

  describe("pinHostKey", () => {
    it("adds new key", async () => {
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "newkey" },
        testEnv,
      );

      const key = await getHostKey("example.com", 22, testEnv);
      expect(key?.key).toBe("newkey");
    });

    it("updates existing key of same type", async () => {
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "oldkey" },
        testEnv,
      );
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "newkey" },
        testEnv,
      );

      const entries = await loadKnownHosts(testEnv);
      const ed25519Entries = entries.filter((e) => e.keyType === "ssh-ed25519");
      expect(ed25519Entries).toHaveLength(1);
      expect(ed25519Entries[0]?.key).toBe("newkey");
    });

    it("preserves keys of different types", async () => {
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-rsa", key: "rsakey" },
        testEnv,
      );
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "ed25519key" },
        testEnv,
      );

      const entries = await loadKnownHosts(testEnv);
      expect(entries).toHaveLength(2);
    });
  });

  describe("removeHostKey", () => {
    it("removes all keys for host and port", async () => {
      await saveKnownHosts(
        [
          { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "ed25519key" },
          { host: "example.com", port: 22, keyType: "ssh-rsa", key: "rsakey" },
          { host: "other.com", port: 22, keyType: "ssh-ed25519", key: "otherkey" },
        ],
        testEnv,
      );

      const removed = await removeHostKey("example.com", 22, testEnv);
      expect(removed).toBe(true);

      const entries = await loadKnownHosts(testEnv);
      expect(entries).toHaveLength(1);
      expect(entries[0]?.host).toBe("other.com");
    });

    it("returns false when no key exists", async () => {
      const removed = await removeHostKey("nonexistent.com", 22, testEnv);
      expect(removed).toBe(false);
    });
  });

  describe("hasHostKeyChanged", () => {
    it("returns null when no existing key", async () => {
      const result = await hasHostKeyChanged(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "newkey" },
        testEnv,
      );
      expect(result).toBeNull();
    });

    it("returns false when key matches", async () => {
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "samekey" },
        testEnv,
      );

      const result = await hasHostKeyChanged(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "samekey" },
        testEnv,
      );
      expect(result).toBe(false);
    });

    it("returns true when key differs", async () => {
      await pinHostKey(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "oldkey" },
        testEnv,
      );

      const result = await hasHostKeyChanged(
        { host: "example.com", port: 22, keyType: "ssh-ed25519", key: "newkey" },
        testEnv,
      );
      expect(result).toBe(true);
    });
  });
});
