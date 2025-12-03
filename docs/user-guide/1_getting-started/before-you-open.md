---
title: Before you open
sidebar_position: 1
description: Prepare hardware and software before launching Companion.
---

## Where to run Companion

The easiest way to begin is to run Companion on your main Computer; probably the one you are reading this on. But often it can be beneficial to run it on another computer, perhaps one that never gets turned off, or a Raspberry Pi. As long as they are on the same network, anything is possible!

The admin interface for Companion can be setup to be available from other machines on your network, and you can use [Companion Satellite](https://user.bitfocus.io/product/companion-satellite) to connect Stream Decks and similar surfaces to Companion over the network.

If you are unsure, run it on your main Computer. It is easy to export and reimport your config if you decide to change it later on.

## Preparation

Close the Elgato Stream Deck app. While it is possible to run them both, Companion runs best when it has full control over your Stream Decks. If you need to run them both, you can use the Companion plugin from [the Elgato store](https://bfoc.us/857in8sce6). You can read how to set this up on the [Elgato Plugin](../7_surfaces/elgato_plugin.md) page.

Connect any Stream Decks or other supported Surfaces to your computer, and make sure any devices you wish to control are powered on and connected to the network. You should make sure that the networking is configured properly and your computer is able to talk to them.

You can easily add more devices later, so don't worry if not everything is available right now, just make sure you have enough to get started.

## Tips

- Never expose the Companion admin interface to the internet, doing so gives those who find it a remote shell to your machine.
- You can run other software on the same machine as Companion. Smaller setups often run vMix and Companion together, while larger setups will connect to more devices or software over a network.
- Always use wired networking whenever possible with Companion. Some devices have network implementations that get unhappy with the sometimes frequent disconnects that can occur when using WiFi
- Backup your configuration often. It is easy to setup Companion to backup daily to a onedrive/iCloud synced folder, so that if something happens to your Computer you have a backup of your config to get you back up quickly.
- Use static IPs or DHCP reservations for devices you control so addresses don't change unexpectedly.
- Ensure mDNS/Bonjour is permitted on your network during discovery, this makes the setup of various devices easier.
