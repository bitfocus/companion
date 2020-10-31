FROM node:12
# Reference: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

WORKDIR /root
ENV APPDIR=/root
ENV ELECTRON_CACHE=$HOME/.cache/electron
ENV ELECTRON_BUILDER_CACHE=$HOME/.cache/electron-builder
ENV PATH="$HOME/.yarn/bin:$PATH"

# Clone repository and set as workdir 
RUN cd /root && \
    git clone https://github.com/bitfocus/companion.git && \
    mv companion/.[!.]* . && \
    mv companion/* . && \
    rm -rf companion && \

    # Installation Prep
    curl -L https://yarnpkg.com/latest.tar.gz | tar xvz && mv yarn-v* $HOME/.yarn && \
    apt-get update && apt-get install -y --no-install-recommends apt-utils \ 
    libudev-dev \
    libgusb-dev && \
    $APPDIR/tools/update.sh && \
    $APPDIR/tools/build_writefile.sh

EXPOSE 8000
ENTRYPOINT ["./headless.js", "eth0"]
