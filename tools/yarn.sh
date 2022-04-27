#!/bin/bash

#
# This file is part of the Companion project
# Copyright (c) 2018 Bitfocus AS
# Authors: William Viker <william@bitfocus.io>, Håkon Nessjøen <haakon@bitfocus.io>
#
# This program is free software.
# You should have received a copy of the MIT licence as well as the Bitfocus
# Individual Contributor License Agreement for companion along with
# this program.
#
# You can be released from the requirements of the license by purchasing
# a commercial license. Buying such a license is mandatory as soon as you
# develop commercial activities involving the Companion software without
# disclosing the source code of your own applications.
#

# exit when any command fails

function heading() {
	echo -e "\033[1m$1\033[m"
}

if [ "$MANAGE_NODE_VERSION" ]; then 
	# This is for older companion-pi installations to manage their node versions
	# if enabled, then setup n and ensure that the correct version is in use
	n install auto
	n prune
fi

heading "Check Node version"
NODE_VERSION=$(node -v)
REQUIRED_VERSION=$(node -p -e "require('./package.json').engines.node")
NODE_IS_CORRECT=$(npx semver --range "$REQUIRED_VERSION" $NODE_VERSION)
echo "Found ${NODE_VERSION}"
if [ "$NODE_IS_CORRECT" ]; then
	echo "Node version is OK "
else
	echo "The installed version of NodeJS is not supported, \"$REQUIRED_VERSION\" is required."
	echo "It is recommended that you update NodeJS (the same way you installed it)."
	exit 7
fi

set -e

heading "Core"
yarn --frozen-lockfile
echo

heading "UI"
yarn --frozen-lockfile --cwd webui
echo "Warning: This next step can take many minutes to run"
yarn --cwd webui build
echo

exit 0
