FROM node:18-bullseye as companion-builder

# Installation Prep
RUN apt-get update && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    unzip \
    cmake \
    && rm -rf /var/lib/apt/lists/*

RUN yarn config set network-timeout 200000 -g

WORKDIR /app
COPY . /app/

# Install dependencies
RUN CI=1 ./tools/yarn.sh

# Generate version number file
RUN yarn build:writefile

# build the application
RUN ELECTRON=0 yarn dist

# make the production image
FROM debian:bullseye-slim

WORKDIR /app
COPY --from=companion-builder /app/dist	/app/
COPY --from=companion-builder /app/docker-entrypoint.sh /docker-entrypoint.sh
COPY --from=companion-builder /app/module-legacy/manifests	/app/module-legacy/manifests

# Install curl for the health check
RUN apt update && apt install -y \
    curl \
    libusb-1.0-0 \
    libudev1 \
    iputils-ping \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Don't run as root
RUN useradd -ms /bin/bash companion

# Create config directory and set correct permissions
# Once docker mounts the volume, the directory will be owned by node:node
ENV COMPANION_CONFIG_BASEDIR /companion
RUN mkdir $COMPANION_CONFIG_BASEDIR && chown companion:companion $COMPANION_CONFIG_BASEDIR

USER companion
# Export ports for web, Satellite API and WebSocket (Elgato Plugin)
EXPOSE 8000 16622 28492

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD [ "curl", "-fSsq", "http://localhost:8000/" ]

# module-local-dev dependencies
# Dependencies will be installed and cached once the container is started
ENTRYPOINT [ "/docker-entrypoint.sh" ]

# Bind to 0.0.0.0, as access should be scoped down by how the port is exposed from docker
CMD ["sh", "-c", "./node-runtime/bin/node ./main.js --admin-address 0.0.0.0 --admin-port 8000 --config-dir $COMPANION_CONFIG_BASEDIR --extra-module-path /app/module-local-dev"]
