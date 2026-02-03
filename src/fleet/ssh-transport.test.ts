import { spawn, type ChildProcess } from "node:child_process";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sshExec, sshKeyscan, type SshExecOptions } from "./ssh-transport.js";

// Mock child_process
vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
}));

const mockSpawn = vi.mocked(spawn);

describe("ssh-transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("sshExec", () => {
    const defaultOpts: SshExecOptions = {
      host: "example.com",
      port: 22,
      user: "admin",
      command: "echo test",
      timeoutMs: 10000,
      knownHostsPath: "/tmp/test-known_hosts",
      strictHostKeyChecking: "yes",
    };

    function createMockProcess(exitCode: number, stdout = "", stderr = ""): ChildProcess {
      const events: Record<string, ((...args: unknown[]) => void)[]> = {};
      const stdoutData = stdout;
      const stderrData = stderr;

      const mockProcess = {
        stdout: {
          setEncoding: vi.fn(),
          on: vi.fn((event: string, cb: (data: string) => void) => {
            if (event === "data") {
              // Schedule data emission
              setTimeout(() => cb(stdoutData), 0);
            }
          }),
        },
        stderr: {
          setEncoding: vi.fn(),
          on: vi.fn((event: string, cb: (data: string) => void) => {
            if (event === "data") {
              setTimeout(() => cb(stderrData), 0);
            }
          }),
        },
        once: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!events[event]) {
            events[event] = [];
          }
          events[event].push(cb);
          if (event === "exit") {
            // Schedule exit emission
            setTimeout(() => {
              events[event]?.forEach((handler) => handler(exitCode, null));
            }, 10);
          }
        }),
        kill: vi.fn(),
        killed: false,
      } as unknown as ChildProcess;

      return mockProcess;
    }

    it("executes command and captures stdout", async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, "test output\n", ""));

      const result = await sshExec(defaultOpts);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe("test output\n");
      expect(result.stderr).toBe("");
      expect(result.timedOut).toBe(false);
    });

    it("captures stderr", async () => {
      mockSpawn.mockReturnValue(createMockProcess(1, "", "error message\n"));

      const result = await sshExec(defaultOpts);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toBe("error message\n");
    });

    it("returns exit code", async () => {
      mockSpawn.mockReturnValue(createMockProcess(255, "", ""));

      const result = await sshExec(defaultOpts);

      expect(result.exitCode).toBe(255);
    });

    it("rejects host starting with dash (security)", async () => {
      const result = await sshExec({
        ...defaultOpts,
        host: "-evil-host",
      });

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("cannot start with");
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("passes correct SSH arguments", async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, "", ""));

      await sshExec(defaultOpts);

      expect(mockSpawn).toHaveBeenCalledWith(
        "/usr/bin/ssh",
        expect.arrayContaining([
          "-o",
          "BatchMode=yes",
          "-o",
          "StrictHostKeyChecking=yes",
          "-o",
          expect.stringContaining("UserKnownHostsFile="),
          "-p",
          "22",
          "--",
          "admin@example.com",
          "echo test",
        ]),
        expect.any(Object),
      );
    });

    it("handles non-standard port", async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, "", ""));

      await sshExec({ ...defaultOpts, port: 2222 });

      expect(mockSpawn).toHaveBeenCalledWith(
        "/usr/bin/ssh",
        expect.arrayContaining(["-p", "2222"]),
        expect.any(Object),
      );
    });

    it("uses -- separator for security", async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, "", ""));

      await sshExec(defaultOpts);

      const args = mockSpawn.mock.calls[0]?.[1] as string[];
      const dashDashIndex = args.indexOf("--");
      expect(dashDashIndex).toBeGreaterThan(-1);
      // User@host should be after --
      expect(args[dashDashIndex + 1]).toBe("admin@example.com");
    });
  });

  describe("sshKeyscan", () => {
    function createMockProcess(exitCode: number, stdout = "", stderr = ""): ChildProcess {
      const events: Record<string, ((...args: unknown[]) => void)[]> = {};

      const mockProcess = {
        stdout: {
          setEncoding: vi.fn(),
          on: vi.fn((event: string, cb: (data: string) => void) => {
            if (event === "data") {
              setTimeout(() => cb(stdout), 0);
            }
          }),
        },
        stderr: {
          setEncoding: vi.fn(),
          on: vi.fn((event: string, cb: (data: string) => void) => {
            if (event === "data") {
              setTimeout(() => cb(stderr), 0);
            }
          }),
        },
        once: vi.fn((event: string, cb: (...args: unknown[]) => void) => {
          if (!events[event]) {
            events[event] = [];
          }
          events[event].push(cb);
          if (event === "exit") {
            setTimeout(() => {
              events[event]?.forEach((handler) => handler(exitCode));
            }, 10);
          }
        }),
        kill: vi.fn(),
      } as unknown as ChildProcess;

      return mockProcess;
    }

    it("returns keyscan output", async () => {
      const keyscanOutput = "example.com ssh-ed25519 AAAAC3test\n";
      mockSpawn.mockReturnValue(createMockProcess(0, keyscanOutput, ""));

      const result = await sshKeyscan("example.com", 22);

      expect(result.output).toBe(keyscanOutput);
      expect(result.exitCode).toBe(0);
    });

    it("rejects host starting with dash", async () => {
      const result = await sshKeyscan("-evil-host", 22);

      expect(result.exitCode).toBe(1);
      expect(result.error).toContain("cannot start with");
      expect(mockSpawn).not.toHaveBeenCalled();
    });

    it("passes port argument", async () => {
      mockSpawn.mockReturnValue(createMockProcess(0, "", ""));

      await sshKeyscan("example.com", 2222);

      expect(mockSpawn).toHaveBeenCalledWith(
        "/usr/bin/ssh-keyscan",
        expect.arrayContaining(["-p", "2222", "example.com"]),
        expect.any(Object),
      );
    });

    it("captures stderr as error", async () => {
      mockSpawn.mockReturnValue(createMockProcess(1, "", "Connection refused"));

      const result = await sshKeyscan("example.com", 22);

      expect(result.error).toBe("Connection refused");
    });
  });
});
