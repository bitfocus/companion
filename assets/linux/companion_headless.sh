#!/bin/bash

cd "$(dirname "$(readlink -f "${BASH_SOURCE[0]}")")/resources"

./node-runtime/bin/node main.js $@
