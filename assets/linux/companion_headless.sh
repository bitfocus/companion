#!/bin/bash

cd "$(dirname "$0")"
cd resources

./node-runtime/bin/node main.js $@
