#!/bin/bash

./tools/update.sh

cd lib/module/

for module in *; do
	cd ${module};
	echo ${module};
	git pull origin master
	cd ..
done

cd ../../

git commit lib/modules/* -m "module upgrades"
git push 

exit 0
