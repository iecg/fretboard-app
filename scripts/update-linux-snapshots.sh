#!/bin/bash
set -e

# Detect Docker socket (prioritize Colima, then default)
if [ -z "$DOCKER_HOST" ]; then
  if [ -S "$HOME/.colima/default/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
    echo "Using Colima Docker socket"
  elif [ -S "/var/run/docker.sock" ]; then
    export DOCKER_HOST="unix:///var/run/docker.sock"
    echo "Using default Docker socket"
  fi
fi

# Check if Docker is reachable
if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon not found. Please start Docker Desktop or Colima."
  exit 1
fi

# Extract Playwright version from package.json
PW_VERSION=$(node -p "require('./package.json').devDependencies['@playwright/test']" | sed 's/[\^~]//')

echo "Updating Linux visual baselines using Playwright v$PW_VERSION..."

# Run the update command inside the container
# We use an anonymous volume for node_modules to avoid corrupting the host's node_modules
# We call playwright directly to ensure arguments are handled correctly (args before --update-snapshots)
docker run --rm \
  --user root \
  -v "$(pwd):/work" \
  -v /work/node_modules \
  -w /work \
  "mcr.microsoft.com/playwright:v$PW_VERSION-jammy" \
  bash -c "npm ci && npm run build && npx playwright test --config=playwright.config.visual.ts $* --update-snapshots"

echo "Linux snapshots updated successfully."
