---
sidebar_position: 2
title: Choosing a Pi
description: Which Raspberry Pi models are supported for running Companion.
---

# Choosing a Raspberry Pi

## Supported Models

We only officially support the **Raspberry Pi 4 and 5**, as well as derivatives of these such as the 400 or Compute Module 4.

It is possible to use the older models, but **it is not recommended or supported**. Should you choose to do so, you do so at your own risk and with the understanding that the community will not be able to help you with any issues.

## Older Pi 4 Firmware

If you are installing Companion from scratch on an older Pi 4, make sure you've got your system updated with the latest EEPROM/firmware updates ([info here](https://www.raspberrypi.org/forums/viewtopic.php?t=255001)).

An update (late October 2019) combines the update mechanisms for both the SPI EEPROM and the VLI USB controller chip. Installing the latest updates will (in the future) open up the ability to boot your Raspberry Pi from a network-connected device or from an external USB storage device, and also updates the VLI firmware to reduce power consumption and bring running temperatures down by up to 3-4 °C.

## Why Not Older Models?

Models older than the 4 are not supported as stability issues were identified which we believe are due to multiple (potentially interrelated) factors, including:

- Power output capability (e.g. to power a Stream Deck)
- Ethernet being on a shared USB bus interfering with Stream Decks
- Maximum RAM
- CPU performance

More details can be found in [Issue #313](https://github.com/bitfocus/companion/issues/313). Accordingly, ongoing development efforts are focused on Raspberry Pi 4 and newer systems.
