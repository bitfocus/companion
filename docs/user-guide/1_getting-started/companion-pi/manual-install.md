---
sidebar_position: 5
title: Manual Installation
description: Install Companion manually on an existing Linux system.
---

# Manual Installation

:::caution Advanced Users Only
Only users who are comfortable with Linux and debugging issues themselves should attempt this flow. We may not be able to help with any issues encountered unless it is something at fault with our tooling.
:::

## Requirements

This is supported on any **x64 or ARM64** machine, and requires a Debian or Ubuntu based OS of a matching CPU architecture.

We recommend using a **headless or server install**, as it maximises the resources available to Companion.

## Preparation

Before starting the installation process, you'll need to get your OS set up and configured.

Now is a good opportunity to make sure the OS has the latest updates installed:

```bash
sudo apt update && sudo apt upgrade -y
```

## Installation

The recommended way to install Companion is to run the following as root:

```bash
curl https://raw.githubusercontent.com/bitfocus/companion-pi/main/install.sh | bash
```

This will perform the same installation and setup steps as the CompanionPi image.

### What the Installer Does

The install script performs the following steps:

- Create a `companion` user
- Install any required system dependencies
- Download the latest beta build of Companion
- Setup udev rules to allow using Streamdecks and other supported surfaces
- Setup sudo rules to allow Companion to shutdown and restart the system
- Install scripts such as `companion-update`

If you want to understand the full scope of the changes, you can read the [install script](https://github.com/bitfocus/companion-pi/blob/main/install.sh).

## Customisation

You are free to customise the installation as you wish, but care should be taken to avoid breaking the updater or making changes that the updater will replace during the next update.

If you need further customisation over this, let us know in [an issue](https://github.com/bitfocus/companion-pi/issues).
