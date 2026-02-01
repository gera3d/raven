# Raven Fork Management Guide

This document explains how to maintain your Raven fork while pulling updates from the upstream OpenClaw repository.

## Quick Start

```bash
# Sync with upstream (interactive)
./scripts/sync-upstream.sh

# Preview changes without making them
./scripts/sync-upstream.sh --dry-run
```

## How It Works

### Branding Protection

Raven uses a custom `.gitattributes` configuration to protect branding files during upstream merges:

- **`merge=ours-branding`**: Always keeps the Raven version (auto-resolved)
- **`merge=ours-review`**: Forces manual review for files with both branding and functional code

Protected files include:
- `package.json` - Package name and binary
- `raven.mjs` - Entry point
- `src/cli/banner.ts` - ASCII art and branding
- `src/cli/tagline.ts` - Taglines
- `src/config/paths.ts` - Directory names
- `src/daemon/constants.ts` - Service names

### Sync Workflow

1. **Run the sync script**: `./scripts/sync-upstream.sh`
2. **Script creates a sync branch**: `sync/upstream-YYYYMMDD-HHMMSS`
3. **Merge happens with branding protection**
4. **Build and tests run automatically**
5. **Create a PR from the sync branch**

### Manual Merge (if needed)

```bash
# Fetch upstream
git fetch upstream

# Create sync branch
git checkout -b sync/upstream-$(date +%Y%m%d)

# Merge with merge drivers
git merge upstream/main

# If conflicts in branding files, keep ours:
git checkout --ours src/cli/banner.ts
git add src/cli/banner.ts

# Build and test
pnpm build && pnpm test

# Push and create PR
git push -u origin sync/upstream-$(date +%Y%m%d)
```

## Theming System

Raven includes a theming system that lets users customize their instance.

### Configuration

Add to `~/.raven/raven.json`:

```json
{
  "ui": {
    "theme": {
      "mode": "dark",
      "colors": {
        "accent": "#8b5cf6",
        "accentBright": "#a78bfa"
      },
      "branding": {
        "productName": "My Raven",
        "tagline": "My custom tagline"
      },
      "agents": {
        "default": {
          "name": "Assistant",
          "avatar": "🤖"
        }
      }
    }
  }
}
```

### Available Options

#### Colors
| Property | Description | Default |
|----------|-------------|---------|
| `accent` | Primary accent color | `#ff5c5c` |
| `accentBright` | Hover state color | `#ff7070` |
| `success` | Success/positive | `#4ade80` |
| `warn` | Warning | `#fbbf24` |
| `error` | Error/danger | `#ef4444` |

#### Branding
| Property | Description | Default |
|----------|-------------|---------|
| `productName` | Product name | `Raven` |
| `productIcon` | Emoji icon | `🐦‍⬛` |
| `tagline` | Primary tagline | `Your messages take flight.` |
| `taglines` | Pool for rotation | (see defaults) |

#### Agent Appearance
| Property | Description |
|----------|-------------|
| `name` | Display name in chat |
| `avatar` | Emoji or image URL |
| `accentColor` | Agent-specific color |
| `greeting` | Custom greeting message |

## Keeping Your Changes

When you make changes specific to your fork:

1. **Branding changes**: Edit the protected files freely - they won't be overwritten
2. **Feature additions**: Add in new files when possible to minimize conflicts
3. **Config extensions**: Extend types in `types.theme.ts` for new options

## Troubleshooting

### Merge conflicts in protected files

If you see conflicts in files marked `ours-branding`, the merge driver may not have been configured:

```bash
# Set up merge drivers manually
git config merge.ours-branding.name "Keep Raven branding"
git config merge.ours-branding.driver "true"

# Then re-run merge
git merge upstream/main
```

### Build fails after merge

Upstream may have introduced breaking changes:

1. Check the upstream changelog/releases
2. Look for new dependencies: `pnpm install`
3. Check for TypeScript errors: `pnpm build`
4. Run tests: `pnpm test`

### Need to accept upstream changes for a file

If you want upstream's version of a normally-protected file:

```bash
git checkout --theirs path/to/file
git add path/to/file
```
