#!/bin/bash
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
