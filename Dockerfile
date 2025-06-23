FROM node:22-bookworm AS companion-builder

RUN corepack enable

# Installation Prep
RUN apt-get update && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    && rm -rf /var/lib/apt/lists/*

RUN yarn config set httpTimeout 100000

WORKDIR /app
COPY . /app/

# Generate version number file
RUN yarn
RUN yarn build:writefile
RUN yarn build:ts

# build the application
RUN ELECTRON=0 yarn dist

# make the production image
FROM debian:bookworm-slim

WORKDIR /app
COPY --from=companion-builder /app/dist	/app/
COPY --from=companion-builder /app/docker-entrypoint.sh /docker-entrypoint.sh

# Install curl for the health check
RUN apt update && apt install -y \
    procps \
    curl \
    libusb-1.0-0 \
    libudev1 \
    iputils-ping \
    libasound2 \
    libfontconfig1 \
    && rm -rf /var/lib/apt/lists/*

# Don't run as root
RUN useradd -ms /bin/bash companion

# setup path and corepack
ENV PATH="$PATH:/app/node-runtimes/main/bin"
RUN echo "PATH="${PATH}"" | tee -a /etc/environment
RUN corepack enable

# Create config directory and set correct permissions
# Once docker mounts the volume, the directory will be owned by node:node
ENV COMPANION_CONFIG_BASEDIR=/companion
RUN mkdir $COMPANION_CONFIG_BASEDIR && chown companion:companion $COMPANION_CONFIG_BASEDIR

USER companion
# Export ports for web, Satellite API and WebSocket (Elgato Plugin)
EXPOSE 8000 16622 16623 28492

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD [ "curl", "-fSsq", "http://localhost:8000/" ]

# module-local-dev dependencies
# Dependencies will be installed and cached once the container is started
ENTRYPOINT [ "/docker-entrypoint.sh" ]
