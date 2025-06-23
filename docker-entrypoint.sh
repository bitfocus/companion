#!/usr/bin/env bash
set -e

# Install dependencies for all local dev modules

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

if [ -d /app/module-local-dev ]; then
  echo "Installing dependencies for all local dev modules..."
  for module in $(ls /app/module-local-dev/); do
    cd /app/module-local-dev/$module
    if [ -d node_modules ]; then
      echo "Skipping installation of module $module dependencies, to force, remove its node_modules directory"
    else
      echo "Installing dependencies for module $module"

      YARN_VERSION=$(yarn -v)
      if  [[ $YARN_VERSION == "1.*" ]] ; then
        yarn install --prod
      else
        yarn workspaces focus --production
      fi
    fi
  done
fi

cd /app
# Bind to 0.0.0.0, as access should be scoped down by how the port is exposed from docker
exec ./node-runtimes/main/bin/node ./main.js --admin-address 0.0.0.0 --admin-port 8000 --config-dir $COMPANION_CONFIG_BASEDIR --extra-module-path /app/module-local-dev $@
