#!/bin/bash

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
