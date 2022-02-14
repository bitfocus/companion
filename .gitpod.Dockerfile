FROM gitpod/workspace-node

# Installation Prep
RUN apt-get update && apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    unzip \
    cmake \
    && rm -rf /var/lib/apt/lists/*
