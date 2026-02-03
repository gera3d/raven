import { z } from "zod";

/**
 * Node name validation: alphanumeric, underscore, hyphen only.
 * Used for filesystem-safe naming and CLI argument safety.
 */
export const nodeNameRegex = /^[a-zA-Z0-9_-]+$/;

/**
 * Operating system enum for fleet nodes.
 */
export const FleetOsSchema = z.enum(["darwin", "linux", "unknown"]);
export type FleetOs = z.infer<typeof FleetOsSchema>;

/**
 * Architecture enum for fleet nodes.
 */
export const FleetArchSchema = z.enum(["x64", "arm64", "unknown"]);
export type FleetArch = z.infer<typeof FleetArchSchema>;

/**
 * Service status enum.
 */
export const ServiceStatusSchema = z.enum(["running", "stopped", "unknown"]);
export type ServiceStatus = z.infer<typeof ServiceStatusSchema>;

/**
 * Zod schema for a fleet node.
 */
export const FleetNodeSchema = z.object({
  /** Unique identifier (UUID) */
  id: z.string().uuid(),
  /** Human-friendly name (unique, alphanumeric with - and _) */
  name: z.string().min(1).max(100).regex(nodeNameRegex, {
    message: "Node name must contain only letters, numbers, hyphens, and underscores",
  }),
  /** SSH hostname or IP address */
  host: z
    .string()
    .min(1)
    .refine((h) => !h.startsWith("-"), {
      message: "Host cannot start with '-' (security)",
    }),
  /** SSH port (default 22) */
  port: z.number().int().min(1).max(65535).default(22),
  /** SSH username */
  user: z.string().min(1),
  /** Whether this node is trusted (host key verified and marked) */
  trusted: z.boolean().default(false),
  /** Pinned SSH host key (if trusted) */
  hostKey: z.string().optional(),
  /** Tags for grouping nodes */
  tags: z.array(z.string()).default([]),
  /** Operating system (detected during bootstrap) */
  os: FleetOsSchema.optional(),
  /** CPU architecture (detected during bootstrap) */
  arch: FleetArchSchema.optional(),
  /** Installation info (if bootstrapped) */
  installed: z
    .object({
      version: z.string(),
      installedAt: z.string().datetime(),
    })
    .optional(),
  /** Last successful contact timestamp (ISO string) */
  lastSeen: z.string().datetime().optional(),
  /** Last known service status */
  serviceStatus: ServiceStatusSchema.optional(),
});

/**
 * Zod schema for the fleet store file (nodes.json).
 */
export const FleetStoreSchema = z.object({
  /** Schema version for future migrations */
  schemaVersion: z.literal(1),
  /** List of fleet nodes */
  nodes: z.array(FleetNodeSchema).default([]),
});

/**
 * TypeScript type for a fleet node.
 */
export type FleetNode = z.infer<typeof FleetNodeSchema>;

/**
 * TypeScript type for the fleet store.
 */
export type FleetStore = z.infer<typeof FleetStoreSchema>;

/**
 * Input type for adding a new node (id is generated).
 */
export type AddNodeInput = Omit<FleetNode, "id">;

/**
 * Input type for updating a node (partial, excludes id and name).
 */
export type UpdateNodeInput = Partial<Omit<FleetNode, "id" | "name">>;

/**
 * Create an empty fleet store.
 */
export function createEmptyFleetStore(): FleetStore {
  return {
    schemaVersion: 1,
    nodes: [],
  };
}
