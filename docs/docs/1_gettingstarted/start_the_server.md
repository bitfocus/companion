---
title: Start the server
sidebar_position: 2
---

When you open Companion, the launcher window will appear. From the opening screen, choose your network interface and change the port if needed — the default is 8000. This is the port of the Companion server.

![Launcher](images/launcher.png?raw=true 'Launcher')

In most cases you will run Companion on the same computer that the Stream Deck or other supported surface is connected to. This is not necessary if you are not using a physical control surface, or if you want to connect them over the network with **Companion Satellite**.

You can run other software on the same machine as Companion. Smaller setups often run vMix and Companion together, while larger setups will connect to more devices or software over a network.

If you need to remotely control Companion from other computers on the same network, change the 'GUI Interface' to make Companion accessible on a different network interface, and use the URL shown underneath the text “Running”. To configure Companion from the computer you're running it on, click the **Launch GUI** button — it will open the Admin page in your default browser.

You can click the cog in the top right corner to open some advanced settings. If you are a module developer, you will want to enable the developer tools there. You can read more about the module development flow in the [module development wiki](https://github.com/bitfocus/companion-module-base/wiki).

![Launcher Advanced Settings](images/launcher-advanced.png?raw=true 'Launcher Advanced Settings')

We recommend using Google Chrome, but other up-to-date browsers should work. There are known issues with the built-in browsers on older Android and iOS devices.
