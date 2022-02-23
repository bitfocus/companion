FROM node:14-bullseye

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

# TODO - module-local-dev dependencies

# cleanup up some stuff that shouldnt be preserved
RUN rm -R .git

# make the production image
FROM node:14-bullseye-slim

WORKDIR /app
COPY --from=0 /app/	/app/

# Bind to 0.0.0.0, as access should be scoped down by how the port is exposed from docker
USER node
EXPOSE 8000
ENTRYPOINT ["./headless_ip.js", "0.0.0.0"]
