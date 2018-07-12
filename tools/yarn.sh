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

function heading() {
	echo -e "\033[1m$1\033[m"
}

heading "Core"
yarn
echo
heading "Bitfocus skeleton"
yarn --cwd bitfocus-skeleton/
echo
heading "Module dependencies"

for module in lib/module/*/; do
	grep '"dependencies"' ${module}package.json > /dev/null 2>&1 && (
		echo ${module}
		yarn --cwd ${module}
		echo ""
	)
done

exit 0
