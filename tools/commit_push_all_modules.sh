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

./tools/update.sh

cd lib/module/

for module in *; do
	cd ${module};
	echo ${module};
	git pull origin master
	git commit -a -m "module update from core change: $1"
	git push origin HEAD:master
	cd ..
done

cd ../../

git commit lib/module/* -m "module upgrades: $1"
git push

exit 0

