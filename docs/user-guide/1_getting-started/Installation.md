---
title: Installation options and Instructions
sidebar_label: Installation options
sidebar_position: 0
description: Choosing and installing a Companion version.
---

## Downloading

Companion can be downloaded from [the website](https://l.companion.free/q/lp68nsiV4).  
We offer 3 different variants of Companion here:

### Stable

Start with these if you are new to Companion or are unsure which to use

These are tested versions that get extra effort to ensure they are bug free. These get updated every few months, and typically lag behind beta in new features.

### Beta

Use these if you need some features which haven't made it to stable yet, and can tolerate the occasional bug.  
A new stable gets made from this when we are happy with it being bug free.

The current development version. Bugs can appear here, but this gains new features frequently.  
This is typically stable for every day use, but this is not always the case.

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

The Linux download contains both a **desktop** build and a **headless** build. Pick the one that matches how you want to run Companion. Either way, see the `README` included in the download for the system dependencies and the USB permission (udev) setup.

#### Desktop (with a graphical interface)

Extract the download and run `companion-launcher`.

To use Stream Decks and other USB surfaces, Linux needs some udev rules installed. You currently need to manually sync these when changing or update modules.

If launching fails with _"Using GTK 2/3 and GTK 4 in the same process is not supported"_, add the argument `--gtk-version=3`.

#### Headless (server / no graphical interface)

For a headless or server install we recommend our install script, which sets up a CompanionPi like environment — it handles system dependencies, the `companion` user and group, and the udev rules automatically. Read more on the [manual installation](./companion-pi/manual-install) page.

The download also includes a standalone headless build, launched with the included `companion_headless.sh` script. This is supported, but not recommended, as you have to perform all of the dependency, group and udev setup yourself — see the `README` in the download.

### Docker

There is a docker image published to the [Github container registry](https://github.com/bitfocus/companion/pkgs/container/companion%2Fcompanion) that can be used to simplify deployment on linux.

**Make sure to bind a volume to `/companion` so that your configuration is persisted**

Companion uses various incoming ports. There are various api servers, and some modules will setup their own servers expecting inbound connections to work. Make sure to plan for this with the network mode used in docker.

#### USB passthrough

Not currently supported, the usb libraries we use do not work in docker properly

#### Remote USB

To connect Stream Decks or other surfaces to Companion from another machine, you can use [Companion Satellite](https://github.com/bitfocus/companion-satellite)  
Make sure to forward tcp port 16622 for this to work.
