#!/bin/bash
set -euo pipefail

# Keep CI visual rendering aligned with the Docker image used for Linux
# baseline generation. This avoids host runner font/package drift.
if [ -z "${DOCKER_HOST:-}" ]; then
  if [ -S "$HOME/.colima/default/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
    echo "Using Colima Docker socket"
  elif [ -S "/var/run/docker.sock" ]; then
    export DOCKER_HOST="unix:///var/run/docker.sock"
    echo "Using default Docker socket"
  fi
fi

if ! docker info >/dev/null 2>&1; then
  echo "Error: Docker daemon not found. Please start Docker Desktop or Colima."
  exit 1
fi

PW_VERSION="$(node -p "require('./package.json').devDependencies['@playwright/test']" | sed 's/[\^~]//')"

if [ -z "$PW_VERSION" ] || [ "$PW_VERSION" = "undefined" ]; then
  echo "Error: Could not determine @playwright/test version from package.json."
  exit 1
fi

echo "Running Linux visual regression tests using Playwright v$PW_VERSION..."

docker run --rm \
  --user root \
  -v "$(pwd):/work" \
  -v /work/node_modules \
  -w /work \
  "mcr.microsoft.com/playwright:v$PW_VERSION-jammy" \
  bash -lc 'npm ci && npx playwright test --config=playwright.config.visual.ts "$@"' -- "$@"

echo "Linux visual regression tests completed successfully."
