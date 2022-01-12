FROM node:14
# Reference: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

WORKDIR /root
ENV APPDIR=/root
ENV ELECTRON_CACHE=$HOME/.cache/electron
ENV ELECTRON_BUILDER_CACHE=$HOME/.cache/electron-builder

COPY . /root/

# Clone repository and set as workdir
RUN cd /root && \
    # Installation Prep
    apt-get update && apt-get install -y --no-install-recommends apt-utils \
    cmake \
    libudev-dev \
    libgusb-dev && \
    $APPDIR/tools/yarn.sh && \
    $APPDIR/tools/build_writefile.sh

EXPOSE 8000
ENTRYPOINT ["./headless.js", "eth0"]
