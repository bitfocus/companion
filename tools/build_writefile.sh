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

function parse_git_dirty() {
	git diff --quiet --ignore-submodules HEAD 2>/dev/null; [ $? -eq 1 ] && echo ""
}

# gets the current git branch
function parse_git_branch() {
	if [[ -z "${TRAVIS_BRANCH}" ]]; then
			if [[ -z "${APPVEYOR_REPO_BRANCH}" ]]; then
			  BRANCH="UNKNOWN"
			else
			  BRANCH="${APPVEYOR_REPO_BRANCH}"
			fi
	else
	  BRANCH="${TRAVIS_BRANCH}"
	fi
}

# get last commit hash prepended with @ (i.e. @8a323d0)
function parse_git_hash() {
	git rev-parse --short HEAD 2> /dev/null | sed "s/\(.*\)/\1/" | cut -d'-' -f2
}

function parse_git_count() {
	git log|egrep "^commit"|wc -l|awk '{print $1}'
}

function release() {
	cat package.json |grep \"version\"|cut -f4 -d\"
}

# DEMO
GIT_BRANCH=$(parse_git_branch)-$(parse_git_hash)-$(parse_git_count)

echo -n ${GIT_BRANCH} > ./BUILD
