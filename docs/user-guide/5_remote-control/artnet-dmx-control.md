---
title: Artnet / DMX Control
description: Control Companion using Artnet/DMX protocol.
---

Companion can listen for Artnet messages, allowing lighting consoles and other Artnet sources to press buttons and trigger actions.

## Enabling

Artnet control must be enabled in [Settings](../3_config/settings.md#artnet-listener) before it can be used.

The relevant options are:

- **Artnet Listener** — Enable to allow Companion to be controlled over Artnet.
- **Artnet Universe** — The Artnet universe Companion will listen on (zero-indexed, so the first universe is `0`).
- **Artnet Channel** — The starting DMX channel within that universe that Companion maps from.

## Channel Mapping

Each button in Companion is mapped to a DMX channel. The channel value determines whether the button is pressed:

- A value of `0` means the button is not pressed.
- Any non-zero value triggers the button (equivalent to a press and release).

Channels are mapped sequentially starting from the configured **Artnet Channel**, going across the button grid row by row.

## Fixture File

An example fixture file for GrandMA2 is available at the bottom of the Artnet settings tab in Companion. This can be imported into your lighting console to label the channels correctly.
