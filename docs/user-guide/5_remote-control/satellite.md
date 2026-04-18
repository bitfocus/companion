---
title: Satellite Protocol
description: Companion Satellite protocol for remote surfaces.
---

The Satellite protocol allows remote surfaces (Stream Decks and other devices) to connect to a central Companion instance over the network. This is useful when the device is on a different machine or in a different room from where Companion is running.

The most common way to use this is with the [Companion Satellite](https://l.companion.free/q/YH8dZkH1Q) app, which runs on a remote machine and forwards connected surfaces to Companion over TCP or WebSockets.

## Setup

1. Install and run **Companion Satellite** on the remote machine.
2. In Companion's [Settings](../3_config/settings.md#satellite), confirm the **Satellite Listen Port** (default: `16622`).
3. In Companion Satellite, point it at the IP address of the machine running Companion.
4. Once connected, the remote surfaces will appear in Companion's [Surfaces](../3_config/surfaces.md) page, just like locally connected devices.

:::tip
If Companion is running behind a firewall or in Docker, make sure TCP port `16622` (and `16623` for WebSockets) is forwarded to the Companion host.
:::

## Developer Documentation

If you are building your own Satellite client (for example, to connect a custom device), the full protocol specification is available in the [developer documentation](https://companion.free/for-developers/Satellite-API).
