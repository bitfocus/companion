FROM node:26-trixie

RUN npm install -g corepack && corepack enable

# Native dependencies needed to build node-hid and other surface libraries
RUN apt-get update && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y sudo \
    && rm -rf /var/lib/apt/lists/* \
    && echo "node ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/node \
    && chmod 0440 /etc/sudoers.d/node

# Allow the node user to access USB devices (gid 46 is the standard debian/ubuntu plugdev group)
RUN groupadd -f -g 46 plugdev && usermod -aG plugdev node
