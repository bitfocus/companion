FROM gitpod/workspace-base

USER root

# Installation Prep
RUN apt-get update && apt-get install -y \
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

SHELL ["/bin/bash", "-l", "-c"]

ENV NVM_DIR /usr/local/nvm

RUN mkdir $NVM_DIR && curl --silent -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash
COPY .nvmrc /home/gitpod/
RUN export NODE_VERSION=$(cat /home/gitpod/.nvmrc) \
   && export NVM_INSTALL_PATH=$NVM_DIR/versions/node/v$NODE_VERSION \
   && export PROFILE=/home/gitpod/.bashrc \
   && source $NVM_DIR/nvm.sh || echo "NVM installed" \
   && nvm install $NODE_VERSION \
   && nvm alias default $NODE_VERSION \
   && nvm use default \
   && npm install -g yarn \
   && chown gitpod /home/gitpod -R

USER gitpod
