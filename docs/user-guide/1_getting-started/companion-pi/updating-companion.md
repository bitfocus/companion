---
sidebar_position: 6
title: Updating Companion
description: How to update Companion on your Pi installation.
---

# Updating Companion

## Using the Updater

Once you SSH or login to the machine running Companion, you can run the following command to launch the interactive updater:

```bash
sudo companion-update
```

This will allow you to select and install a different version of Companion.

## Upgrading from Older CompanionPi Versions

If your CompanionPi install was made with the install script, or using an image of **2.2.0 or later**, you can use the updater to easily update to the latest version.

If you have a CompanionPi install that was made **before the 2.2.0** CompanionPi image, it is recommended that you backup your config and reimport it into a fresh installation.

:::info What changed in 2.2.0?
A lot changed in the 2.2.0 builds, including an overhaul of the CompanionPi images. The major change is the ability for CompanionPi to manage various dependencies itself, allowing updates after that version to be done in a seamless manner.
:::
