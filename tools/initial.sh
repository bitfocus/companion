#!/bin/bash

git pull --all --depth=10
git submodule init
git submodule update
yarn
cd bitfocus-skeleton
yarn
cd ..

