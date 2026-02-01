/**
 * Raven Theming System
 *
 * Allows users to customize the look and feel of their Raven instance.
 * Supports both CLI and Control UI theming.
 */

/**
 * Color scheme configuration.
 * All colors should be hex values (e.g., "#ff5c5c").
 */
export type ThemeColorsConfig = {
  /** Primary accent color */
  accent?: string;
  /** Brighter accent variant (hover states) */
  accentBright?: string;
  /** Dimmer accent variant (disabled states) */
  accentDim?: string;
  /** Success/positive color */
  success?: string;
  /** Warning color */
  warn?: string;
  /** Error/danger color */
  error?: string;
  /** Background color override */
  background?: string;
  /** Surface color (cards, panels) */
  surface?: string;
  /** Text primary color */
  text?: string;
  /** Text muted color */
  textMuted?: string;
};

/**
 * Custom branding configuration.
 * Override default Raven branding with your own.
 */
export type ThemeBrandingConfig = {
  /** Product name (default: "Raven") */
  productName?: string;
  /** Product emoji icon (default: "🐦‍⬛") */
  productIcon?: string;
  /** Primary tagline */
  tagline?: string;
  /** Pool of taglines to rotate randomly */
  taglines?: string[];
  /** Logo image URL, path, or data URI */
  logo?: string;
  /** Favicon URL or path */
  favicon?: string;
  /** Footer text */
  footer?: string;
};

/**
 * Font configuration for UI.
 */
export type ThemeFontsConfig = {
  /** Body text font family */
  body?: string;
  /** Heading/display font family */
  display?: string;
  /** Monospace font family (code, terminal) */
  mono?: string;
  /** Base font size (e.g., "16px", "1rem") */
  baseSize?: string;
};

/**
 * Agent-specific appearance in the chat interface.
 */
export type AgentAppearanceConfig = {
  /** Display name for the agent */
  name?: string;
  /** Avatar emoji, text, or image URL */
  avatar?: string;
  /** Agent-specific accent color */
  accentColor?: string;
  /** Custom greeting message */
  greeting?: string;
};

/**
 * Dashboard/Control UI specific theming.
 */
export type DashboardThemeConfig = {
  /** Show/hide the sidebar */
  showSidebar?: boolean;
  /** Compact mode (smaller spacing) */
  compact?: boolean;
  /** Show agent stats on overview */
  showStats?: boolean;
  /** Custom CSS to inject */
  customCss?: string;
};

/**
 * CLI-specific theming.
 */
export type CliThemeConfig = {
  /** Show ASCII banner on startup */
  showBanner?: boolean;
  /** Show random tagline */
  showTagline?: boolean;
  /** Use emoji in output */
  useEmoji?: boolean;
  /** Progress indicator style */
  progressStyle?: "spinner" | "dots" | "bar" | "minimal";
};

/**
 * Full theme configuration.
 */
export type ThemeConfig = {
  /** Color mode preference */
  mode?: "system" | "light" | "dark";
  /** Color scheme */
  colors?: ThemeColorsConfig;
  /** Branding overrides */
  branding?: ThemeBrandingConfig;
  /** Font configuration */
  fonts?: ThemeFontsConfig;
  /** Dashboard-specific theming */
  dashboard?: DashboardThemeConfig;
  /** CLI-specific theming */
  cli?: CliThemeConfig;
  /** Per-agent appearance overrides (keyed by agent ID) */
  agents?: Record<string, AgentAppearanceConfig>;
};

/**
 * Extended UI config with theming support.
 */
export type UiConfig = {
  /** Legacy: Accent color (use theme.colors.accent instead) */
  seamColor?: string;
  /** Legacy: Assistant display (use theme.agents.default instead) */
  assistant?: {
    name?: string;
    avatar?: string;
  };
  /** Full theming configuration */
  theme?: ThemeConfig;
};
