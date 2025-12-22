---
title: Blackmagic Controllers
sidebar_position: 8
description: Setup guide for Blackmagic ATEM and Resolve controllers.
---

It is possible to use a few of the Blackmagic Design USB/bluetooth controllers with Companion. Currently

We currently support the following models:

- ATEM Micro Panel since v3.4
- Resolve Replay Editor since v4.0
- Resolve Speed Editor since v4.2

Enable support for it in Companion's settings and rescan for USB devices. This works over both USB and Bluetooth.

Currently bluetooth on MacOS is not operational for Replay Editor and Speed Editor. For ATEM Micro Panel sometimes works, sometimes not. There are similar reports reg. similar issues on Linux. @Julusian is aware and will look into it, but no ETA given. 

:::danger
Do not run the ATEM software at the same time when using the ATEM Micro Panel — both programs will listen to presses and update colours.
:::

The layout matches the device's natural grid when blank spaces are compacted. The T-bar occupies a column in this layout.

To use the T-bar, go to the surface settings and select a custom variable to receive the value. You can also provide an expression to control how the T-bar LEDs are lit.

LEDs on keys (on/off) respond to setting background color.
