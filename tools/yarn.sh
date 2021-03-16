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

heading "Check Node version"
NODE_VERSION=$(node -v)
NODE_IS_CORRECT=$(npx semver --range "^12.18.3 || ^14" $NODE_VERSION)
echo "Found ${NODE_VERSION}"
if [ "$NODE_IS_CORRECT" ]; then
	echo "Node version is OK "
else
	echo "The installed version of NodeJS is not supported, v12.18.3+ is required."
	echo "It is recommended that you update NodeJS (the same way you installed it)."
	echo "Alternatively, you can run \`git checkout stable-2.1\` and \`yarn update\` to stick to future 2.1 versions, but this is unlikely to get many (if any) updates"
	exit 7
fi

set -e

heading "Core"
yarn --frozen-lockfile
echo

heading "UI"
yarn --frozen-lockfile --cwd webui
yarn --cwd webui build
echo

exit 0
