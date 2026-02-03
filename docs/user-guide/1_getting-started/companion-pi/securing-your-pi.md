---
sidebar_position: 4
title: Securing Your Pi
description: Security best practices for your CompanionPi installation.
---

# Securing Your Companion Pi

## SSH User Setup

Following the change in April 2022 by Raspberry Pi, the CompanionPi images do not allow SSH access until you set up a user. If you have a screen connected you will be prompted to set up the user, or you can create the user with a config file at first boot.

### Using Raspberry Pi Imager

If using the Raspberry Pi Imager, you can configure the username and password before writing the image.

### Creating a User at First Boot

1. At the root of your SD card, create a file named `userconf.txt`
2. Run the following command to generate a hash of your password:
   ```bash
   openssl passwd -6 <your-password>
   ```
3. Add a single line to the `userconf.txt` file:
   ```
   <username>:<password-hash>
   ```
   Use the output of the previous step as the password hash.

## Security Best Practices

There are other security-oriented best practices that are recommended:

- Making sudo require a password
- Making sure you've got the latest OS updates and security fixes
- Improving SSH security

All of these recommended best practices can be found on the [raspberrypi.org website](https://www.raspberrypi.org/documentation/configuration/security.md).

For general Companion security settings, see the [Security](../../security) page.
