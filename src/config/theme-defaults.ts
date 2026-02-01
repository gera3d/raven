/**
 * Default theme values for Raven.
 *
 * These are used when no user configuration is provided.
 */

import type {
  ThemeColorsConfig,
  ThemeBrandingConfig,
  ThemeFontsConfig,
  ThemeConfig,
  AgentAppearanceConfig,
} from "./types.theme.js";

/**
 * Default Raven color palette.
 * Based on the "Lobster" palette from the original OpenClaw.
 */
export const DEFAULT_COLORS: Required<ThemeColorsConfig> = {
  accent: "#ff5c5c",
  accentBright: "#ff7070",
  accentDim: "#cc4a4a",
  success: "#4ade80",
  warn: "#fbbf24",
  error: "#ef4444",
  background: "#0a0a0a",
  surface: "#1a1a1a",
  text: "#fafafa",
  textMuted: "#a1a1aa",
};

/**
 * Default Raven branding.
 */
export const DEFAULT_BRANDING: Required<ThemeBrandingConfig> = {
  productName: "Raven",
  productIcon: "\uD83E\uDD86\u200D\u2B1B", // 🐦‍⬛
  tagline: "Your messages take flight.",
  taglines: [
    "Your messages take flight.",
    "Dark wings, swift replies.",
    "Intelligent messaging, evolved.",
    "From the shadows, answers emerge.",
    "Your personal messenger of the digital realm.",
    "Nocturnal intelligence at your service.",
    "Whispers across the wire.",
    "The clever bird that never forgets.",
  ],
  logo: "",
  favicon: "",
  footer: "",
};

/**
 * Default font configuration.
 */
export const DEFAULT_FONTS: Required<ThemeFontsConfig> = {
  body: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  display: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  mono: "'SF Mono', 'Fira Code', 'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
  baseSize: "16px",
};

/**
 * Default agent appearance.
 */
export const DEFAULT_AGENT_APPEARANCE: Required<AgentAppearanceConfig> = {
  name: "Raven",
  avatar: "\uD83E\uDD86\u200D\u2B1B", // 🐦‍⬛
  accentColor: "#ff5c5c",
  greeting: "Hello! I'm Raven, your messaging assistant. How can I help you today?",
};

/**
 * Complete default theme.
 */
export const DEFAULT_THEME: ThemeConfig = {
  mode: "system",
  colors: DEFAULT_COLORS,
  branding: DEFAULT_BRANDING,
  fonts: DEFAULT_FONTS,
  dashboard: {
    showSidebar: true,
    compact: false,
    showStats: true,
    customCss: "",
  },
  cli: {
    showBanner: true,
    showTagline: true,
    useEmoji: true,
    progressStyle: "spinner",
  },
  agents: {
    default: DEFAULT_AGENT_APPEARANCE,
  },
};

/**
 * Resolve theme colors with defaults.
 */
export function resolveThemeColors(userColors?: ThemeColorsConfig): Required<ThemeColorsConfig> {
  return {
    ...DEFAULT_COLORS,
    ...userColors,
  };
}

/**
 * Resolve branding with defaults.
 */
export function resolveThemeBranding(
  userBranding?: ThemeBrandingConfig,
): Required<ThemeBrandingConfig> {
  return {
    ...DEFAULT_BRANDING,
    ...userBranding,
  };
}

/**
 * Resolve fonts with defaults.
 */
export function resolveThemeFonts(userFonts?: ThemeFontsConfig): Required<ThemeFontsConfig> {
  return {
    ...DEFAULT_FONTS,
    ...userFonts,
  };
}

/**
 * Resolve agent appearance with defaults.
 */
export function resolveAgentAppearance(
  agentId: string,
  userAppearances?: Record<string, AgentAppearanceConfig>,
  fallback?: AgentAppearanceConfig,
): Required<AgentAppearanceConfig> {
  const agentConfig = userAppearances?.[agentId] ?? userAppearances?.["default"] ?? {};
  return {
    ...DEFAULT_AGENT_APPEARANCE,
    ...fallback,
    ...agentConfig,
  };
}

/**
 * Get a random tagline from the pool.
 */
export function getRandomTagline(branding?: ThemeBrandingConfig): string {
  const taglines = branding?.taglines ?? DEFAULT_BRANDING.taglines;
  const primaryTagline = branding?.tagline ?? DEFAULT_BRANDING.tagline;

  // Use environment variable to get deterministic tagline for testing
  const indexOverride = process.env.RAVEN_TAGLINE_INDEX ?? process.env.OPENCLAW_TAGLINE_INDEX;
  if (indexOverride != null) {
    const idx = parseInt(indexOverride, 10);
    if (!Number.isNaN(idx) && idx >= 0 && idx < taglines.length) {
      return taglines[idx];
    }
    return primaryTagline;
  }

  // Random selection
  const pool = [primaryTagline, ...taglines];
  return pool[Math.floor(Math.random() * pool.length)];
}

/**
 * Generate CSS custom properties from theme colors.
 */
export function generateThemeCssVars(colors: ThemeColorsConfig): string {
  const resolved = resolveThemeColors(colors);
  return `
:root {
  --raven-accent: ${resolved.accent};
  --raven-accent-bright: ${resolved.accentBright};
  --raven-accent-dim: ${resolved.accentDim};
  --raven-success: ${resolved.success};
  --raven-warn: ${resolved.warn};
  --raven-error: ${resolved.error};
  --raven-background: ${resolved.background};
  --raven-surface: ${resolved.surface};
  --raven-text: ${resolved.text};
  --raven-text-muted: ${resolved.textMuted};
}
`.trim();
}
