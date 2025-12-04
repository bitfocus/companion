---
title: Local Modules
sidebar_position: 4
description: How to load modules that are not included in Companion's "store".
---

When a module for a connection is ready and got accepted by the maintainers it usually will be included in the Companion "store" and you download as described in the [Companion Modules](modules.md) page.  
Sometimes you may want to run a connection where the code is not included (yet). Maybe the developer is still working at it and you want to test the connection in an early stage or it is a custom module not meant for public distribution.  
Since Companion 3.0 you can use your own connection code without the need for a full development environment. Here is how you do it.

## Get the developer module

You will be provided with a developer module by mail or by download.
A developer module is a folder with some code files and maybe subfolders in it. At any case there will be a subfolder with the name `companion` and within that subfolder a file named `manifest.json`. The module folder is the parent folder of the folder named companion. You may get it uncompressed as a bunch of files or in a compressed/archived version. The archive usually has a TAR-GnuZip format with the file extension `.tgz` and usually, but not necessarily the filename `pkg.tgz`.  
If you have a different archive format like zip or 7z, the developer may have compressed the package again. You have to uncompress it until you are left with either some .tgz or with the uncompressed module folder.

## Module folder structure

Check the appropriate section below to find out where this folder is located for you.

The structure is setup so that you can multiple modules loaded at the same time, and works in a couple of ways.  
Inside of this module folder should be one or more folders that use the following layouts, with each folder corresponding to a different module

1. A git clone of a module from github  
   This requires some additional setup, as the module will need to be prepared with a `yarn install` and for some a `yarn build`.
2. Packaged output  
   This is a folder that contains a `companion/manifest.json`, `companion/HELP.md`, `package.json`, `main.js` (or another name), and possibly a few other files.
   No extra work is needed for this to be loaded

## Windows / Macos / Linux GUI

You have two options for running a local module:

1. Load it from the modules page using the [Import Module button](../config/modules#module-list)
2. Set up a developer folder:

- Create a folder on your machine where you will put these custom modules.
- Check the section above on how to structure this folder
- Open/show the launcher window of Companion.  
  ![image](images/launcher.png)
- In the top right corner you will see a Cog. Click on it to show the Advanced Settings window.
  ![image](images/launcher-advanced.png)
- In the Developer section click on "Select" to select the directory where you have stored your developer modules.
- Make sure "Enable Developer Modules" is switched on. You can now close the window
- Click on "Launch GUI" to open the Admin interface. In the connections list you should find the connection provided by the developer module. If the developer module is using the same internal ID as a module that is distributed with Companion, be sure to choose the "dev" version in the configuration.  
  If you don't see the developers module, please check the log and switch on debug, maybe the module has crashed.
- You can replace a developers module or parts of it on the harddrive while Companion is running. Companion will detect the change and restart only that module without affecting other modules.

## RaspberryPI / Headless Linux

- Find the developers module folder on your installation. This is often `/opt/companion-module-dev/`.
- Check the section above on how to structure this folder
- Run Companion.
- Open the Admin interface in your Browser. In the connections list you should find the connection provided by the developer module. If the developer module is using the same internal ID as a module that is distributed with Companion, it will override the distributed version.  
  If you don't see the developers module, please check the log and switch on debug, maybe the module has crashed.

## Headless development

- If you are running Companion from source in development mode, there is a folder `module-local-dev` inside the repository that gets read for your modules.
- It follows the same rules for structuring as above.
- Any changes made to the contents of the folder will cause the affected modules to be reloaded. You can force them to reload by disabling and re-enabling a connection.
