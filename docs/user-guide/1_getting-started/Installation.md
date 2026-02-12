---
title: Installation options and Instructions
sidebar_label: Installation options
sidebar_position: 0
description: Choosing and installing a Companion version.
---

## Downloading

Companion can be downloaded from [the website](https://user.bitfocus.io/download).  
We offer 3 different variants of Companion here:

### Stable

Start with these if you are new to Companion or are unsure which to use

These are tested versions that get extra effort to ensure they are bug free. These get updated every few months, and typically lag behind beta in new features.

### Beta

Use these if you need some features which haven't made it to stable yet, and can tolerate the occasional bug.  
A new stable gets made from this when we are happy with it being bug free.

The current development version. Bugs can appear here, but this gains new features frequently.  
This is typically stable for every day use, but this is not always the case.

### Experimental

Use these if you want to try the cutting edge new features, and can tolerate frequent bugs.

This is where we push new features that need some more testing before making it into beta, or things which are only half done.
These versions are often behind beta in module updates.

## Installing

### Mac

:::note
As of 4.2 we only support macOS 12 and newer.
:::

Unzip the download, drag Companion.app into your Applications folder

### Windows (x64)

:::note
As of 3.0 we only support Windows 10 and newer.
:::

Download, install and run!

### Raspberry Pi

We recommend using the CompanionPi images available with [our CompanionPi setup guide](./companion-pi)

If you wish to install manually on a Pi, follow the instructions below for other Linux.

### Linux (x64 and arm64)

Since 3.0, the downloads can be used for both a desktop version, and a headless version. Check the README in the download for guidance on how to do this and for other system setup for both.

If you want a headless version, we recommend using our install script to get a CompanionPi like environment. Read more on the [manual installation](./companion-pi/manual-install) page.

### Docker

There is a docker image published to the [Github container registry](https://github.com/bitfocus/companion/pkgs/container/companion%2Fcompanion) that can be used to simplify deployment on linux.

**Make sure to bind a volume to `/companion` so that your configuration is persisted**

Companion uses various incoming ports. There are various api servers, and some modules will setup their own servers expecting inbound connections to work. Make sure to plan for this with the network mode used in docker.

#### USB passthrough

Not currently supported, the usb libraries we use do not work in docker properly

#### Remote USB

To connect streamdecks to companion from another machine, you can use [Companion Satellite](https://github.com/bitfocus/companion-satellite)  
Make sure to forward tcp port 16622 for this to work.
