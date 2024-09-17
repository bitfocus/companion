#!/bin/bash

cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/resources"

./node-runtimes/main/bin/node main.js $@
