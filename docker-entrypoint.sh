#!/usr/bin/env bash
set -e

# Install dependencies for all local dev modules

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

# USB surfaces are not usable from inside the container, so the udev rules which grant access to them are
# irrelevant here. Without this, Companion would compare against the container's own (empty) udev rules
# directory rather than the host's, and forever prompt to apply rules that cannot be applied from in here.
export COMPANION_IN_CONTAINER=1

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

      # Some modules have a build script, but many do not
      if jq -e '.scripts.build' package.json > /dev/null; then
        yarn run build
      fi
    fi
  done
fi

cd /app

NODE=(./node-runtimes/main/bin/node)
CONFIG_TOOL=("${NODE[@]}" ./config-tool.js)

# Companion reads its launch options from a yaml file inside the config volume. The bundled config-tool
# (the same one CompanionPi uses) creates it with defaults and comments on first start and turns it into
# launch arguments here; you then edit config.yaml by hand and restart the container to change an option.
# Default it inside the config dir (so it follows COMPANION_CONFIG_BASEDIR) unless explicitly overridden.
export COMPANION_CONFIG_FILE="${COMPANION_CONFIG_FILE:-$COMPANION_CONFIG_BASEDIR/config.yaml}"

# Create the file if missing / add any newly-introduced options on upgrade. This never overwrites
# values already in the file. Seed docker-appropriate defaults on first creation only: bind to all
# interfaces (access should be scoped down by how the ports are exposed from docker) and honour the
# historical COMPANION_ADMIN_PORT env var so existing setups keep working.
"${CONFIG_TOOL[@]}" init \
  --set adminAddress=:: \
  --set adminPort="${COMPANION_ADMIN_PORT:-8000}"

# Fail loudly with a clear message before launching, rather than starting with a broken config.
"${CONFIG_TOOL[@]}" validate

# Apply the config file: `generate` prints a bash snippet of `export`s and a single `set --` of cli
# flags. Assigning it (rather than `eval "$(...)"`) lets `set -e` abort if generation fails.
snippet="$("${CONFIG_TOOL[@]}" generate)"

# Preserve any extra args passed to the container, then reset $@ so a snippet without a `set --`
# line leaves us with an empty arg list instead of the original docker args.
extra_args=("$@")
set --
eval "$snippet"

# The config file flags ("$@") come first, then any args passed to the container ("${extra_args[@]}").
# commander uses the last occurrence, so container args override the config file - an easy way to test
# an override without editing config.yaml.
exec "${NODE[@]}" ./main.js \
  --config-dir "$COMPANION_CONFIG_BASEDIR" \
  --extra-module-path /app/module-local-dev \
  "$@" "${extra_args[@]}"
