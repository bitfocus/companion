#!/bin/bash

cd lib/module/

for module in *; do
	cd ${module};
	echo ${module};
	git pull origin master
	cd ..
done

cd ../../

exit 0
