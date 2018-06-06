#!/bin/bash


function parse_git_dirty() {
	git diff --quiet --ignore-submodules HEAD 2>/dev/null; [ $? -eq 1 ] && echo ""
}

# gets the current git branch
function parse_git_branch() {
	git branch --no-color 2> /dev/null | sed -e '/^[^*]/d' -e "s/* \(.*\)/\1$(parse_git_dirty)/"
}

# get last commit hash prepended with @ (i.e. @8a323d0)
function parse_git_hash() {
	git rev-parse --short HEAD 2> /dev/null | sed "s/\(.*\)/\1/"
}

function release() {
	cat package.json |grep \"version\"|cut -f4 -d\"
}

# DEMO
GIT_BRANCH=$(release)-$(parse_git_hash)

if [[ "$TRAVIS_OS_NAME" == "osx" ]]; then
	curl -T electron-output/electron-output/Companion*.dmg -u $FTP_USER:$FTP_PASSWORD ftp://$FTP_IP/deploy/electron-output/companion-${GIT_BRANCH}-osx.dmg
elif [[ "$TRAVIS_OS_NAME" == "linux" ]]; then
	curl -T electron-output/*.AppImage -u $FTP_USER:$FTP_PASSWORD ftp://$FTP_IP/deploy/electron-output/companion-${GIT_BRANCH}-linux_x86_64.AppImage
	curl -T electron-output/*.snap -u $FTP_USER:$FTP_PASSWORD ftp://$FTP_IP/deploy/electron-output/companion-${GIT_BRANCH}-linux_amd64.snap
else
	mv -f electron-output/companion-win64.exe electron-output/companion-${GIT_BRANCH}-win64.exe; fi;
