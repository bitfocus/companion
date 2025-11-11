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

:::note
The exact list of settings will vary based on surface type.
:::

- **Surface Group**: Assign this surface to a [Surface Group](#surface-groups).
- **Use Last Page At Startup**: Whether the surface should remember the last page it was on at startup, or use the Startup Page setting instead.
- **Home Page/Startup Page**: If 'Use Last Page At Startup' is _disabled_, the page the Surface will show at startup.
- **Current Page/Last Page**: If 'Use Last Page At Startup' is _enabled_, the page the Surface will show at startup. (Setting this while the surface is attached will also set the current page for the surface or group.)
- **Restrict pages accessible to this group**: If enabled, a multi-select dropdown will allow you to select which page(s) the surface or group may access. See the [Page Permissions](#3_config/surfaces/pagepermissions.md) instructions for additional details. (v4.2)
- **Allow Swipe to Change Pages (SD Plus)**: If enabled, swiping horizontally on the LCD Panel of a Stream Deck+ will change pages (v4.2)
- **Horizontal Offset in grid**: If the device is smaller than Companion's button grid, you can adjust the position of the surface within the grid
- **Vertical Offset in grid**: If the device is smaller than Companion's button grid, you can adjust the position of the surface within the grid
- **Brightness**: The brightness of the buttons.
- **Surface rotation**: If you've physically rotated your Surface, use this to match the button orientation.
- **Never pin code lock**: Exclude this device from pin-code locking.

In the settings for each **Emulator**, you can configure additional parameters here such as the row and column count.

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
