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

Now, in the core, we need to upgrade the reference to the module to the new version. For this we've made a tool. Go to the companion base directory (not inside the module):
```
cd companion
./tools/upgrade_module.sh <modulename>
```

## When you want to create a new ```mynewmodule``` module that doesn't have a repository yet:

1) ```cd ./lib/module/```
2) ```mkdir mynewmodule```
3) ```cd mynewmodule```
4) ```npm init``` (enter x 10)
5) ```git init```
6) ```git add package.json```
7) ```git commit package.json -m "package.json"```
8) ```echo node_modules/ > .gitignore```
9) ```git add .gitignore```
10) ```git commit .gitignore -m "gitignore to ignore the node_modules/ folder"```

Now, you need to ask the core developers to create a repository for your module, and await instructions.
