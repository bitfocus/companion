# Developers Guide. Ish.

## First:
1. Install [node.js](https://nodejs.org/en/)
2. Install n ```sudo npm install n -g```
3. Install yarn ```sudo npm install yarn -g```

## Getting started
```
$ n 12.18.4
$ git clone <your forked repository>
$ cd companion
$ ./tools/update.sh
$ yarn dev
```

# Bracing and indentation
Use tabs for indentation. We use tabwith=2, but you can do whatever you like. One indentation = one tab.

For bracing, do this
```
if (var == 1) {
  return;
}
```
not this
```
if (var == 1)
{
  return;
}
```
not this
```
if (var == 1) return;
```
not this
```
if (var == 1)
  return;
```

One thing we also like to do, is to subindent similar lines like
```
var moda = require("modulea");
var moduleb = require("moduleb");
var hello = require("hello");
```
to being
```
var moda    = require("modulea");
var moduleb = require("moduleb");
var hello   = require("hello");
```
this subindentation is not done with tabs, but spaces. Looks nice!

# Tools

## Update all, including yarn in submodules [Core Devs, Mod Devs]
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

Now, you need to ask the core developers to create a repository for your module, and wait for them to create the module repository.

When the repository gets created by a core developer, you can continue.

11) ```git remote add origin https://github.com/bitfocus/companion-module-mynewmodule.git```
12) ```git push origin HEAD:master```

Now we're at a point that the core developers must decide if its time to include this module in the companion core. But ask us on slack, and if we decide to add it - and we say it's done, you my proceed.

It's important that you didn't get any erros in the last push, because you're going to delete the code from your computer (make a backup if you're unsure).

13) ```cd ..```
14) ```rm -rf mynewmodule```
15) ```cd ../../```
16) ```./tools/update.sh```

The module should now appear in lib/module/mynewmodule, and if you want to change something in the module after this, you need to do your changes, commit it to the repository and read the beginning of the modules section in this document.

Questions? SLACK! :)
