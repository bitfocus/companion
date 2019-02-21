FROM node:8
# Reference: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

ENV APPDIR=/usr/src/companion
ENV ELECTRON_CACHE=$HOME/.cache/electron
ENV ELECTRON_BUILDER_CACHE=$HOME/.cache/electron-builder
ENV PATH="$HOME/.yarn/bin:$PATH"

# Clone repository and set as workdir 
RUN cd /usr/src && \
    git clone https://github.com/bitfocus/companion.git && \
    cd $APPDIR && \

# Installation Prep
    curl -L https://yarnpkg.com/latest.tar.gz | tar xvz && mv yarn-v* $HOME/.yarn && \
    apt-get update && apt-get install -y --no-install-recommends apt-utils \ 
     libudev-dev \
     libgusb-dev && \
    yarn add \
     popper.js@^1.14.7 \
     bootstrap@4.3.1 \
     jquery@1.9.1 && \
    $APPDIR/tools/update.sh && \
    $APPDIR/tools/build_writefile.sh

EXPOSE 8000
CMD [ "/usr/src/companion/headless.js", "eth0" ]
