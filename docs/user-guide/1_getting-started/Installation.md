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
As of 5.0 we support macOS 13.5 and newer.
:::

Unzip the download, drag Companion.app into your Applications folder

### Windows (x64)

:::note
As of 3.0 we support Windows 10 and newer.
:::

Download, install and run!

### Raspberry Pi

We recommend using the CompanionPi images available with [our CompanionPi setup guide](./companion-pi)

If you wish to install manually on a Pi, follow the instructions below for other Linux.

### Linux (x64 and arm64)

The Linux download contains both a **desktop** build and a **headless** build. Pick the one that matches how you want to run Companion. Either way, see the `README` included in the download for the system dependencies and the USB permission (udev) setup.

#### Desktop (with a graphical interface)

Extract the download and run `companion-launcher`.

To use Stream Decks and other USB surfaces, Linux needs some udev rules installed. Companion will prompt you inside its interface when this needs doing, and on a desktop it can apply them for you. See the `README` for details.

If launching fails with _"Using GTK 2/3 and GTK 4 in the same process is not supported"_, add the argument `--gtk-version=3`.

#### Headless (server / no graphical interface)

For a headless or server install we recommend our install script, which sets up a CompanionPi like environment — it handles system dependencies, the `companion` user and group, and the udev rules automatically. Read more on the [manual installation](./companion-pi/manual-install) page.

The download also includes a standalone headless build, launched with the included `companion_headless.sh` script. This is supported, but not recommended, as you have to perform all of the dependency, group and udev setup yourself — see the `README` in the download.

### Docker

There is a docker image published to the [Github container registry](https://github.com/bitfocus/companion/pkgs/container/companion%2Fcompanion) that can be used to simplify deployment on linux. It is published for `linux/amd64` and `linux/arm64`.

```sh
docker run -d --name companion \
  -p 8000:8000 -p 16622:16622 -p 16623:16623 \
  -v companion-config:/companion \
  ghcr.io/bitfocus/companion/companion:latest
```

Or with docker-compose:

```yaml
services:
  companion:
    image: ghcr.io/bitfocus/companion/companion:latest
    restart: unless-stopped
    ports:
      - '8000:8000' # Admin UI
      - '16622:16622' # Companion Satellite (TCP)
      - '16623:16623' # Companion Satellite (WS)
    volumes:
      - companion-config:/companion
volumes:
  companion-config:
```

**Make sure to bind a volume to `/companion` so that your configuration is persisted.**

Companion uses various incoming ports. In addition to the ones below, some modules set up their own servers expecting inbound connections to work, so make sure to plan for this with the network mode used in docker.

| Port    | Purpose                   |
| ------- | ------------------------- |
| `8000`  | Admin UI and web API      |
| `16622` | Companion Satellite (TCP) |
| `16623` | Companion Satellite (WS)  |

#### Configuration

Launch options (the [server configuration](./server-configuration.md) — admin port, logging, syslog, security options and so on) are read from a `config.yaml` file inside the config volume, at `/companion/config.yaml`. A commented file is created automatically on first start; edit it and restart the container to apply your changes. This is the same file and tooling used by [headless / CompanionPi installs](./companion-pi/config-tool.md). The full list of options is in the [configuration reference](./config-reference.generated.md).

`COMPANION_ADMIN_PORT` (default `8000`) is honoured when the file is first created and is used by the container health check. If you change `adminPort` in `config.yaml`, update your published port mapping to match.

#### USB passthrough

Not currently supported, the usb libraries we use do not work in docker properly

#### Remote USB

To connect Stream Decks or other surfaces to Companion from another machine, you can use [Companion Satellite](https://github.com/bitfocus/companion-satellite)  
Make sure to forward tcp port 16622 for this to work.
