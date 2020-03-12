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

#-------------------------------------------------------------------------
# N.B. you must manually add the old path to ./tools/check_renamed.sh AND
# the paths in .gitmodules must manually be updated.
#-------------------------------------------------------------------------

# Move the module folder
echo "Moving $1 > $2"
mv lib/module/$1 lib/module/$2

# Start tracking new folder
echo "Tracking $2"
git add lib/module/$2

# Remove old path
echo "Cleanup caches in $1"
git rm --cached lib/module/$1

# Commit changes
#git commit -m "Module: Renamed $1 > $2"

exit 0
