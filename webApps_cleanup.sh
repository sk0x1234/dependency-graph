#!/bin/bash
# cleanup.sh - Removes non-essential files before Fortify scan
# webApps_cleanup.sh - Prepares Node.js projects and removes non-essential files before a Fortify scan.
set -euo pipefail # Exit on error, undefined variable, or pipe failure.

echo "Starting cleanup process..."
echo "Starting webApps cleanup and preparation process..."

# # 1. Remove git metadata safely
# if [ -d ".git" ]; then
#     rm -rf .git
# fi
# --- STEP 1: SETUP NVM AND STATE TRACKING ---
# Respect existing NVM_DIR, otherwise default it. Makes the script more portable.
export NVM_DIR="${NVM_DIR:-/home/jenkins/.nvm}"
if [ ! -f "$NVM_DIR/nvm.sh" ]; then
    echo "FATAL: NVM script not found at $NVM_DIR/nvm.sh" >&2
    exit 1
fi
. "$NVM_DIR/nvm.sh"

# 2. Find and remove specified directories and files
# Every condition inside \( \) must be joined by -o except the last one.
CURRENT_NVM_VERSION="" # Variable to track the active Node.js version

# --- STEP 2: PROCESS ALL package.json FILES ---
# 2a. Determine required Node.js version from .nvmrc or package.json
NODE_REQ_MAJOR=""
if [ -f ".nvmrc" ]; then
    NODE_REQ_MAJOR=$(nvm_version "$(cat .nvmrc)" | cut -d. -f1)
    echo "Found .nvmrc, requires Node.js v${NODE_REQ_MAJOR}"
else
    # Default to 18 if .engines.node is missing or null
    NODE_REQ_MAJOR=$(jq -r '.engines.node // "18"' package.json | sed 's/[^0-9.]*//g' | cut -d. -f1)
    echo "Found package.json, requires Node.js v${NODE_REQ_MAJOR}"
fi

# 2b. Map major version to a specific, pinned version for reproducibility
TARGET_NVM_VERSION=""
case "$NODE_REQ_MAJOR" in
    "20") TARGET_NVM_VERSION="v20.15.1" ;;
    "22") TARGET_NVM_VERSION="v22.4.0" ;;
    "21") TARGET_NVM_VERSION="v21.7.3" ;;
    "19") TARGET_NVM_VERSION="v19.9.0" ;;
    "18") TARGET_NVM_VERSION="v18.20.4" ;;
    "23" | "24" | "25")
        echo "Warning: Node.js v${NODE_REQ_MAJOR} is not yet released. Defaulting to v22."
        TARGET_NVM_VERSION="v22.4.0" ;;
    *)
        echo "Warning: Unsupported or unlisted Node.js version v${NODE_REQ_MAJOR}. Defaulting to v22."
        TARGET_NVM_VERSION="v22.4.0"
        ;;
esac

# 2c. Switch Node.js version only if it has changed
if [ "$CURRENT_NVM_VERSION" != "$TARGET_NVM_VERSION" ]; then
    echo "Switching Node.js version from ${CURRENT_NVM_VERSION:-none} to $TARGET_NVM_VERSION"
    nvm install "$TARGET_NVM_VERSION" # This also uses the version
    CURRENT_NVM_VERSION="$TARGET_NVM_VERSION"
else
    echo "Node.js version $CURRENT_NVM_VERSION is already active."
fi
echo "Active Node Version: $(node -v), npm: $(npm -v)"

# 2d. Strip package.json and generate lock file
echo "Stripping devDependencies and private repos from package.json..."
npm cache clear --force
# Corrected jq filter: removed erroneous 'objects' call
jq 'del(.devDependencies) | .dependencies |= with_entries(select(.value | contains("github.corp.clover.com") | not))' package.json > package.json.tmp && mv package.json.tmp package.json

echo "Generating production-only package-lock.json..."
npm install --package-lock-only --omit=dev --legacy-peer-deps --ignore-scripts --no-audit || echo "WARNING: 'npm install' failed in the current directory. A lockfile may not be generated."



