---
title: Companion Satellite
sidebar_position: 2
description: Connect remote surfaces via Companion Satellite.
---

[Companion Satellite](https://l.companion.free/q/YH8dZkH1Q) is a lightweight application that runs on a separate machine and forwards locally connected surfaces to a central Companion instance over the network.

This is useful when:

- Your Stream Deck is at a different desk or in a different room from the Companion server.
- You want to connect surfaces to a Companion instance running on a server or in Docker (where direct USB is not available).
- You have multiple operators each with their own Stream Deck, all controlled by a single Companion setup.

## How It Works

Companion Satellite connects to Companion over TCP (default port `16622`) or WebSockets (default port `16623`). Once connected, any surfaces attached to the machine running Satellite appear in Companion's [Surfaces](../3_config/surfaces.md) page and can be configured just like locally connected devices.

## Setup

1. Download and install Companion Satellite from the [Bitfocus website](https://l.companion.free/q/YH8dZkH1Q).
2. Run Satellite on the remote machine and enter the IP address of your Companion server.
3. In Companion, open the **Surfaces** page — the remote surfaces will appear automatically once Satellite connects.

:::note
If Satellite does not connect, check that ports `16622` and `16623` are reachable on the Companion host. You can verify the listen port in [Settings](../3_config/settings.md#satellite).
:::

## Configuration

Once the surfaces appear in Companion, they are configured in the same way as any other surface. See [Surfaces](../3_config/surfaces.md) for the available settings.

:::note
Companion Satellite supports a subset of surfaces compared to a directly-connected Companion instance. Check the Satellite release notes for the current supported device list.
:::
