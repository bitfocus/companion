#!/bin/bash

yarn
yarn --cwd bitfocus-skeleton/

for module in lib/module/*/; do
	grep '"dependencies"' ${module}package.json > /dev/null 2>&1 && yarn --cwd ${module}
done
