FROM node:14-bullseye as companion-builder

WORKDIR /app
COPY . /app/

# Installation Prep
RUN apt-get update && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    unzip \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
RUN yarn config set network-timeout 100000 -g
RUN ./tools/yarn.sh

# Generate version number file
RUN yarn build:writefile

# strip back unnecessary dependencies
RUN yarn --frozen-lockfile --prod

# Delete the webui source
RUN mv webui/build webui-build \
    && rm -R webui \
    && mkdir webui \
    && mv webui-build webui/build

# cleanup up some stuff that shouldnt be preserved
RUN rm -R .git

# make the production image
FROM node:14-bullseye-slim

WORKDIR /app
COPY --from=companion-builder /app/	/app/

# Install curl for the health check
RUN apt update && apt install -y curl && \
    rm -rf /var/lib/apt/lists/*

# Create config directory and set correct permissions
# Once docker mounts the volume, the directory will be owned by node:node
ENV COMPANION_CONFIG_BASEDIR /companion
RUN mkdir $COMPANION_CONFIG_BASEDIR && chown node:node $COMPANION_CONFIG_BASEDIR
USER node
# Export both web and Satellite API ports
EXPOSE 8000 16622

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD [ "curl", "-fSsq", "http://localhost:8000/" ]

# module-local-dev dependencies
# Dependencies will be installed and cached once the container is started
ENTRYPOINT [ "/app/module-dev-docker-entrypoint.sh" ]

# Bind to 0.0.0.0, as access should be scoped down by how the port is exposed from docker
CMD ["./headless_ip.js", "0.0.0.0"]
