---
title: Custom Presets
sidebar_position: 4
description: Build your own buttons once, and place them from the presets list as linked buttons or copies.
slug: /config/custom-presets
---

:::warning[Beta]
Custom presets are new and still in beta. The way they behave may change in future releases.
:::

A custom preset is a button that you build once, and then place from the **Presets** tab, just like the presets of a connection. Place it as a **linked** button and it follows every change you make to the custom preset, or place it as a **copy** and change it freely.

Use them for buttons that you place many times, with the same look and actions. For example, a house style for your record and talkback buttons, or a "go to page" button you put on every page. When you change the custom preset, every button linked to it changes too.

Custom presets sit alongside [custom actions](./custom-actions.md), [custom feedbacks](./custom-feedbacks.md) and [custom elements](./custom-elements.md), and can use any of them. You find them under **Building Blocks → Presets** in the sidebar.

## Creating a custom preset

Click **Add Custom Preset**, then select it in the list to open the editor. Give it a **Name** and a **Description**. The name is shown under the preset in the Presets tab, and the description helps you find it when you search there.

The editor has the same tabs as a normal button, **Actions**, **Style**, **Feedbacks**, **Local Variables** and **Options**, and a **Uses** tab. Anything you can do on a button, you can do in a custom preset.

![The custom preset editor](images/custom-presets/editor-style.png)

A custom preset isn't on a page, so the preview shows `x/x/x` in place of a location, and anything which depends on where a button is, such as `$(this:page)`, only has a value once the preset is placed.

### Starting from a button

You can also make a custom preset from a button you have already built. Select the button, and click **Save as preset** at the top of its editor. This makes a new custom preset from a copy of the button, and opens it. The button itself is not changed or linked to the new custom preset.

![Saving a button as a custom preset](images/custom-presets/save-as-preset.png)

### Collections

Use **Create Collection** to group your custom presets, and drag them between collections. Each collection is a section in the Presets tab, named by its path through the collections it is inside, such as `Studio / Cameras`. Custom presets which are not in a collection are in an **Ungrouped** section.

### Uses

The **Uses** tab lists every button that is linked to this custom preset. A copy is a button of its own, so is not listed.

![Uses of a custom preset](images/custom-presets/uses.png)

## Placing a custom preset

Open the **Presets** tab next to the button grid. Your custom presets are listed as **Custom**, above your connections.

![Custom presets in the Presets tab](images/custom-presets/presets-list.png)

Select it to see your custom presets, in their collections, and drag one onto the grid, the same as the [presets of a connection](../buttons/creating/index.md#using-presets). The **Linked** and **Copy** toggle chooses how it is placed:

- **Linked**: the button stays linked to the custom preset. When you change the custom preset, the button changes too.
- **Copy**: the button is a one-off copy, which you can edit like any other button. It won't change when the custom preset does.

![The custom presets, ready to be placed](images/custom-presets/presets-custom.png)

When you select a linked button, its editor shows which custom preset it comes from, with a link to edit that custom preset. To change just this button, click **Edit** at the top of the editor. This unlinks it into a normal button, the same as for the preset of a connection.

![A button linked to a custom preset](images/custom-presets/linked-button.png)

## How custom presets work

A custom preset is a definition. **Each button placed from it is a button of its own**: it runs its own actions, has its own feedbacks and steps, and keeps its own local variables. A linked button only takes its setup from the custom preset.

Some things to know:

- **Editing the custom preset** updates every linked button straight away.
- **Deleting the custom preset** leaves its linked buttons showing how they last looked. They still work, but no longer follow any changes. Use **Edit** on them to turn them into normal buttons.
- **Notes** on a linked button are its own, and are kept when the custom preset changes.

## Sharing custom presets

Custom presets and their collections are included when you export your full configuration, and you can choose to import, keep or reset them on their own, like the other building blocks.

A linked button keeps a copy of how its custom preset looked, so exporting a page keeps how its linked buttons look. They only stay linked when their custom presets are imported too.

## Example: Record and talkback

The **Studio** collection has two custom presets:

- **Record** shows `REC`. Its action toggles the custom variable `recording` with the expression `!$(custom:recording)`, and a feedback turns it red while `recording` is true.
- **Talkback** shows `TALK`. It sets the custom variable `talkback` to `true` when pressed and back to `false` when released, and a feedback turns it blue while `talkback` is true.

Button `1/3/0` is **Record** placed as a linked button, `1/3/1` is **Talkback** placed as a linked button, and `1/3/2` is a copy of **Record**. Changing the colour of **Record** changes `1/3/0`, but not `1/3/2`.

![Buttons placed from the custom presets](images/custom-presets/buttons.png)
