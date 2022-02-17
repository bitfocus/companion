FROM gitpod/workspace-base

# Installation Prep
RUN sudo apt-get update && sudo apt-get install -y \
    libusb-1.0-0-dev \
    libxshmfence1 \
    libglu1 \
    libgtk-3-dev \
    libgconf2-dev \
    libxss1 \
    libnss3-dev \
    libasound2 \
    libudev-dev \
    unzip \
    cmake

USER gitpod

COPY .nvmrc /home/gitpod/
RUN NODE_VERSION=$(cat /home/gitpod/.nvmrc) \
    && echo Node version: $NODE_VERSION \
    && curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | PROFILE=/dev/null bash \
    && bash -c ". .nvm/nvm.sh \
        && nvm install v$NODE_VERSION \
        && nvm alias default v${NODE_VERSION} \
        && npm install -g typescript yarn node-gyp \
    " \
    && printf 'export PATH=/home/gitpod/.nvm/versions/node/v${NODE_VERSION}/bin:$PATH' >> /home/gitpod/.bashrc \
    && echo "Node and Yarn installed"
