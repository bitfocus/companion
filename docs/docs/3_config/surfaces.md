---
title: Surfaces
sidebar_position: 3
description: Configure Stream Decks and control surfaces.
---

This tab allows you to configure your Stream Decks and other **Surfaces**.

If any of your Stream Decks are not showing up, press the **Rescan USB** button. You can avoid needing to do this by enabling **Watch for new USB Devices** on the settings page.

![Surfaces](images/surfaces.png?raw=true 'Surfaces')

Here you can see all your current surfaces, both local and connected over Satellite, as well as any available emulators.

Click the **Settings** button next to a device to change how that surface behaves.

Note: the exact list of settings varies by surface type.

- **Surface Group**: Assign this surface to a [Surface Group](#3_config/surfaces/groups.md).
- **Use Last Page At Startup**: Whether the surface should remember the last page it was on at startup, or use the Startup Page setting instead.
- **Startup Page**: If 'Use Last Page At Startup' is not enabled, the page the Surface will show at startup.
- **X Offset in grid**: If the device is smaller than the 8x4 grid, you can adjust the position of the surface within the grid
- **Y Offset in grid**: If the device is smaller than the 8x4 grid, you can adjust the position of the surface within the grid
- **Brightness**: The brightness of the buttons.
- **Button rotation**: If you've physically rotated your Surface, use this to match the button orientation.
- **Never pin code lock**: Exclude this device from pin-code locking.

In the settings for each **Emulator**, you can configure additional behaviours.

## Surface Groups

Surface groups is a recent addition which allows for linking multiple surfaces to always be on the same page.  
This is convenient for setups such as having two Stream Deck XLs side by side, which want to be treated as a single 16x4 device.

To do this, use the **+ Add Group** button to create a new surface group. Then for each surface you want to add to the group, open its settings and change the surface group dropdown to the newly created group.

Elsewhere in Companion, the actions which can change the page of a surface will no longer see the individual surfaces, and can instead pick the group.

Another use case for this, is that you can use a group as a stable id for a surface.  
This helps setups where you need to be able to swap out a Stream Deck quickly, and also need actions to reference specific Stream Decks.  
You can create your groups and program the system ahead of time, then later add or remove surfaces to the groups without needing to update any buttons.

## Discovery

Companion supports a few different network protocols for attaching remote surfaces.

![Discovery](images/surface-discover.png?raw=true 'Discovery')

Any surfaces discovered on your network via mdns will be listed here. For each, a short wizard is provided to help connect it to Companion.

If you do not want this discovery, you can disable it in the settings.
