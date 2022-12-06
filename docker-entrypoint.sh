#!/usr/bin/env bash
set -e

# Install dependencies for all local dev modules

if [ -d /app/module-local-dev ]; then
  echo "Installing dependencies for all local dev modules..."
  for module in $(ls /app/module-local-dev/); do
    cd /app/module-local-dev/$module
    if [ -d node_modules ]; then
      echo "Skipping installation of module $module dependencies, to force, remove its node_modules directory"
    else
      echo "Installing dependencies for module $module"
      yarn install --prod
    fi
  done
fi

cd /app
exec "$@"
