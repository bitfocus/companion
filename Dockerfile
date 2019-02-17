FROM node:8
# Reference: https://nodejs.org/en/docs/guides/nodejs-docker-webapp/

# Create app directory
#WORKDIR /usr/src/app

ENV ELECTRON_CACHE=$HOME/.cache/electron
ENV ELECTRON_BUILDER_CACHE=$HOME/.cache/electron-builder
ENV PATH="$HOME/.yarn/bin:$PATH"

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
# where available (npm@5+)
COPY package*.json ./

# Installation Prep
RUN curl -L https://yarnpkg.com/latest.tar.gz | tar xvz && mv yarn-v* $HOME/.yarn
RUN apt-get update && apt-get install -y --no-install-recommends apt-utils \ 
    libudev-dev \
    libgusb-dev \
    tree
RUN npm install popper.js@^1.14.7 \
    jquery \
    bootstrap@4.3.1
RUN npm install
RUN tree 
RUN ls -lah
RUN pwd
# RUN ./tools/build_writefile.sh

# If you are building your code for production
# RUN npm ci --only=production

# Bundle app source
# COPY . .

EXPOSE 8000
#CMD [ "npm", "start" ]
