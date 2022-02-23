FROM node:14 as companion-builder

# User variable, define where to store the application config
ENV COMPANION_CONFIG_BASEDIR=/config

WORKDIR /app
COPY . /app/

# Installation Prep
RUN apt-get update && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    unzip \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# python3.6+ is needed for node-sass in webui/yarn
RUN echo 'deb http://ftp.de.debian.org/debian testing main' >> /etc/apt/sources.list && \
    echo 'APT::Default-Release "stable";' | tee -a /etc/apt/apt.conf.d/00local && \
    apt-get update && apt-get install -y -t testing python3 \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies
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

# TODO - module-local-dev dependencies

# cleanup up some stuff that shouldnt be preserved
RUN rm -R .git

# make the production image
FROM node:14-slim

WORKDIR /app
COPY --from=companion-builder /app/	/app/

# Create config directory and set correct permissions
# Once docker mounts the volume, the directory will be owned by node:node
ENV COMPANION_CONFIG_BASEDIR /companion
RUN mkdir $COMPANION_CONFIG_BASEDIR && chown node:node $COMPANION_CONFIG_BASEDIR
USER node
EXPOSE 8000
# Bind to 0.0.0.0, as access should be scoped down by how the port is exposed from docker
ENTRYPOINT ["./headless_ip.js", "0.0.0.0"]
