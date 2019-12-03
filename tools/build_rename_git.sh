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

git fetch --depth=10000

# get last commit hash prepended with @ (i.e. @8a323d0)
function parse_git_hash() {
	git rev-parse --short HEAD 2> /dev/null | cut -d'-' -f2
}

function parse_git_count() {
	git log | egrep "^commit" | wc -l | awk '{print $1}'
}

function release() {
	cat package.json |grep \"version\"|cut -f4 -d\"
}

function build() {
	cat BUILD
}

GIT_BRANCH=$(build)

echo "RELEASE $(release)"
echo "PARSE_GIT_HASH $(parse_git_hash)"
ls -la electron-output
echo "TO BRANCH '${GIT_BRANCH}'"

if [[ "$TRAVIS_OS_NAME" == "osx" ]]; then
	echo OSX
	mv -vf ./electron-output/*.zip ./electron-output/companion-${GIT_BRANCH}-osx.zip
	ARTIFACT_SOURCE="./electron-output/companion-${GIT_BRANCH}-osx.zip"
	ARTIFACT_DESTINATION="companion-${GIT_BRANCH}-osx.zip"
elif [[ "$TRAVIS_OS_NAME" == "linux" ]]; then
	echo LINUX
	mv -fv ./electron-output/*.gz ./electron-output/companion-${GIT_BRANCH}-linux.tar.gz
	ARTIFACT_SOURCE="./electron-output/companion-${GIT_BRANCH}-linux.tar.gz"
	ARTIFACT_DESTINATION="companion-${GIT_BRANCH}-linux.tar.gz"
elif [[ "$TRAVIS_OS_NAME" == "win64" ]]; then
	echo WINDOWS
	mv -fv ./electron-output/*.exe ./electron-output/companion-${GIT_BRANCH}-win64.exe
	ARTIFACT_SOURCE="./electron-output/companion-${GIT_BRANCH}-win64.exe"
	ARTIFACT_DESTINATION="companion-${GIT_BRANCH}-win64.exe"
elif [[ "$TRAVIS_OS_NAME" == "armv7l" ]]; then
	echo ARM
	mv -fv ./electron-output/*.gz ./electron-output/companion-${GIT_BRANCH}-armv7l.tar.gz
	ARTIFACT_SOURCE="./electron-output/companion-${GIT_BRANCH}-armv7l.tar.gz"
	ARTIFACT_DESTINATION="companion-${GIT_BRANCH}-armv7l.tar.gz"
fi

echo UPLOADING 
node ./tools/upload_build.js ${ARTIFACT_SOURCE} ${ARTIFACT_DESTINATION}

echo DONE
