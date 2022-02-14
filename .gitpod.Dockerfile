FROM gitpod/workspace-base

ENV NODE_VERSION=14.19.0

# Installation Prep
RUN sudo apt-get update && sudo apt-get install -y \
    libusb-1.0-0-dev \
    libudev-dev \
    unzip \
    cmake

USER gitpod

RUN curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | PROFILE=/dev/null bash \
    && bash -c ". .nvm/nvm.sh \
        && nvm install v${NODE_VERSION} \
        && nvm alias default v${NODE_VERSION} \
        && npm install -g typescript yarn pnpm node-gyp" \
    && echo "Node and Yarn installed"

ENV PATH=/home/gitpod/.nvm/versions/node/v${NODE_VERSION}/bin:$PATH
