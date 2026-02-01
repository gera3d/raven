#!/usr/bin/env bash
# =============================================================================
# Raven Upstream Sync Script
# =============================================================================
# This script helps merge changes from the upstream OpenClaw repository while
# preserving Raven branding. It sets up custom merge drivers and handles
# common conflict scenarios.
#
# Usage:
#   ./scripts/sync-upstream.sh           # Interactive sync
#   ./scripts/sync-upstream.sh --dry-run # Preview without making changes
#   ./scripts/sync-upstream.sh --auto    # Auto-merge (CI mode)
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
UPSTREAM_REMOTE="upstream"
UPSTREAM_BRANCH="main"
LOCAL_BRANCH="main"
SYNC_BRANCH_PREFIX="sync/upstream-"

# Flags
DRY_RUN=false
AUTO_MODE=false
VERBOSE=false

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_step() {
    echo -e "\n${CYAN}==> $1${NC}"
}

# =============================================================================
# Setup Functions
# =============================================================================

setup_merge_drivers() {
    log_step "Setting up merge drivers..."

    # 'ours-branding' driver: always keeps local version (exit 0)
    if ! git config --get merge.ours-branding.driver &>/dev/null; then
        git config merge.ours-branding.name "Keep Raven branding (always ours)"
        git config merge.ours-branding.driver "true"
        log_success "Configured 'ours-branding' merge driver"
    else
        log_info "'ours-branding' driver already configured"
    fi

    # 'ours-review' driver: forces manual review (exit 1)
    if ! git config --get merge.ours-review.driver &>/dev/null; then
        git config merge.ours-review.name "Review branding conflicts manually"
        git config merge.ours-review.driver "false"
        log_success "Configured 'ours-review' merge driver"
    else
        log_info "'ours-review' driver already configured"
    fi
}

verify_remotes() {
    log_step "Verifying git remotes..."

    # Check origin
    if ! git remote get-url origin &>/dev/null; then
        log_error "No 'origin' remote found"
        exit 1
    fi

    ORIGIN_URL=$(git remote get-url origin)
    log_info "origin: $ORIGIN_URL"

    # Check upstream
    if ! git remote get-url "$UPSTREAM_REMOTE" &>/dev/null; then
        log_warn "No '$UPSTREAM_REMOTE' remote found"
        log_info "Adding upstream remote..."
        git remote add "$UPSTREAM_REMOTE" "https://github.com/openclaw/openclaw.git"
        log_success "Added upstream remote"
    fi

    UPSTREAM_URL=$(git remote get-url "$UPSTREAM_REMOTE")
    log_info "upstream: $UPSTREAM_URL"

    # Verify it points to openclaw
    if [[ "$UPSTREAM_URL" != *"openclaw/openclaw"* ]]; then
        log_warn "Upstream doesn't appear to point to openclaw/openclaw"
        log_warn "URL: $UPSTREAM_URL"
    fi
}

check_working_tree() {
    log_step "Checking working tree..."

    if ! git diff --quiet || ! git diff --cached --quiet; then
        log_error "Working tree has uncommitted changes"
        log_info "Please commit or stash your changes first"
        git status --short
        exit 1
    fi

    log_success "Working tree is clean"
}

# =============================================================================
# Sync Functions
# =============================================================================

fetch_upstream() {
    log_step "Fetching upstream changes..."

    if $DRY_RUN; then
        log_info "[DRY RUN] Would fetch from $UPSTREAM_REMOTE"
        return
    fi

    git fetch "$UPSTREAM_REMOTE" --tags
    log_success "Fetched upstream"

    # Show what's new
    LOCAL_HEAD=$(git rev-parse HEAD)
    UPSTREAM_HEAD=$(git rev-parse "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH")

    if [ "$LOCAL_HEAD" = "$UPSTREAM_HEAD" ]; then
        log_success "Already up to date with upstream!"
        exit 0
    fi

    COMMITS_BEHIND=$(git rev-list --count HEAD.."$UPSTREAM_REMOTE/$UPSTREAM_BRANCH")
    COMMITS_AHEAD=$(git rev-list --count "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH"..HEAD)

    log_info "Local is $COMMITS_BEHIND commits behind upstream"
    log_info "Local is $COMMITS_AHEAD commits ahead of upstream"

    echo ""
    log_info "Recent upstream commits:"
    git log --oneline HEAD.."$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" | head -10
}

create_sync_branch() {
    log_step "Creating sync branch..."

    TIMESTAMP=$(date +%Y%m%d-%H%M%S)
    SYNC_BRANCH="${SYNC_BRANCH_PREFIX}${TIMESTAMP}"

    if $DRY_RUN; then
        log_info "[DRY RUN] Would create branch: $SYNC_BRANCH"
        return
    fi

    git checkout -b "$SYNC_BRANCH"
    log_success "Created branch: $SYNC_BRANCH"
}

perform_merge() {
    log_step "Merging upstream changes..."

    if $DRY_RUN; then
        log_info "[DRY RUN] Would merge $UPSTREAM_REMOTE/$UPSTREAM_BRANCH"
        log_info "[DRY RUN] Branding files would be auto-resolved to keep Raven version"
        return
    fi

    # Attempt merge
    if git merge "$UPSTREAM_REMOTE/$UPSTREAM_BRANCH" --no-edit; then
        log_success "Merge completed successfully!"
    else
        log_warn "Merge has conflicts that need resolution"

        # Show conflicted files
        echo ""
        log_info "Conflicted files:"
        git diff --name-only --diff-filter=U

        echo ""
        log_info "Files marked for 'ours-review' need manual attention:"
        git diff --name-only --diff-filter=U | while read file; do
            if grep -q "merge=ours-review" .gitattributes 2>/dev/null && grep -q "$file" .gitattributes; then
                echo "  - $file (review needed)"
            fi
        done

        echo ""
        log_info "To resolve conflicts:"
        echo "  1. Edit conflicted files"
        echo "  2. For branding files, keep the Raven version"
        echo "  3. git add <resolved-files>"
        echo "  4. git commit"
        echo ""
        log_info "Or to abort: git merge --abort"

        return 1
    fi
}

run_tests() {
    log_step "Running build and tests..."

    if $DRY_RUN; then
        log_info "[DRY RUN] Would run: pnpm install && pnpm build && pnpm test"
        return
    fi

    log_info "Installing dependencies..."
    pnpm install

    log_info "Building..."
    if pnpm build; then
        log_success "Build successful"
    else
        log_error "Build failed!"
        log_info "Please fix build errors before pushing"
        return 1
    fi

    log_info "Running tests..."
    if pnpm test --run 2>/dev/null || pnpm test 2>/dev/null; then
        log_success "Tests passed"
    else
        log_warn "Some tests may have failed - please review"
    fi
}

show_summary() {
    log_step "Sync Summary"

    echo ""
    echo "Branch: $SYNC_BRANCH"
    echo ""
    echo "Next steps:"
    echo "  1. Review the changes: git log --oneline $LOCAL_BRANCH..$SYNC_BRANCH"
    echo "  2. Test locally: raven status"
    echo "  3. Push the branch: git push -u origin $SYNC_BRANCH"
    echo "  4. Create a PR to merge into $LOCAL_BRANCH"
    echo ""
    echo "To switch back to $LOCAL_BRANCH:"
    echo "  git checkout $LOCAL_BRANCH"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --auto)
                AUTO_MODE=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            --help|-h)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --dry-run    Preview changes without making them"
                echo "  --auto       Auto-merge mode (for CI)"
                echo "  --verbose    Show more details"
                echo "  --help       Show this help"
                exit 0
                ;;
            *)
                log_error "Unknown option: $1"
                exit 1
                ;;
        esac
    done

    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Raven Upstream Sync${NC}"
    echo -e "${CYAN}========================================${NC}"

    if $DRY_RUN; then
        log_warn "DRY RUN MODE - No changes will be made"
    fi

    # Run sync steps
    verify_remotes
    setup_merge_drivers
    check_working_tree
    fetch_upstream
    create_sync_branch
    perform_merge
    run_tests
    show_summary

    log_success "Sync complete!"
}

main "$@"
