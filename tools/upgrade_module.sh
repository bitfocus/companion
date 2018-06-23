#!/bin/bash

./tools/update.sh

cd lib/module/

cd $1;
echo $1;
git pull origin master
cd ../../../
ls -la
git status
git commit lib/module/$1 -m "module upgrade: $1"
git push 

exit 0
