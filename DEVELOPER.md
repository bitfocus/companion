# Developers Guide. Ish.

## First:
1. Install node.js
2. Install n (sudo npm install n -g)
3. Install yarn (sudo npm install yarn -g)

## Getting started
```
$ n 8.11.1
$ git clone <your forked repository>
$ cd companion
$ ./tools/update.sh
$ npm run start
```


# Tools

## Update all, including yarn in submodules
./tools/update.sh

# Modules

When you're doing changes to modules in companion, you need to upgrade the git link in the core as well. 

1. Make sure you pull inside the module folder ```git pull origin master```
2. Do your changes
3. Commit the changes with a nice message
4. Push your changes ```git push origin HEAD:master```

Now, in the core, we need to upgrade the reference to the module to the new version. For this we've made a tool:
```
./tools/upgrade_module.sh <modulename>
```



