FROM gitpod/workspace-node

# Installation Prep
RUN sudo nvm install 14 && sudo apt-get update && sudo apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    unzip \
    cmake
