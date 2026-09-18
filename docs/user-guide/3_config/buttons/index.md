---
title: Buttons
sidebar_position: 2
description: Configure buttons, layout, pages, and button management.
---

In the Buttons tab, you can configure the buttons for your Stream Deck.

:::tip
You can change the size of the grid to any size you wish, in the [Buttons settings page](../settings.md).
It can grow in all 4 directions.
:::

![Buttons Page](../images/buttons.png?raw=true 'Buttons Page')

The Buttons layout has multiple pages that can be navigated using the grey left/right arrows or the dropdown. Each page is also listed in the **Pages** tab in the right panel where you can manage pages and give them names.

Hold down the SHIFT key and click a button to trigger it directly.

Above the buttons you'll find:

- **View Scale** — adjust the grid view scale.
- **View as surface** — show only the part of the grid one of your surfaces covers, drawn the way that
  surface will draw it. See [Viewing the grid as a surface](#viewing-the-grid-as-a-surface).
- **Home position** — when scrolling a large grid, snap the view back to 0/0 (top-left).
- **Edit page** — adjust settings for the current page.
- **Export page** — download this page's buttons for import into another page or Companion config. See [Import / Export].

Several actions exist below for rearranging your buttons, **Copy**, **Move**,
**Swap**, or **Delete**. First click on the desired action, then click on the
button you want to apply that action to. Finally (in the case of the `Copy`,
`Swap` and `Move` actions) click on the destination button. Alternatively, use
the standard keyboard shortcuts to perform these operations.

There are also two buttons for resetting the page:

- **Wipe page** — erases all buttons on the page and adds the navigation buttons.
- **Reset page buttons** — leaves the buttons intact, but adds the default navigation buttons.

## Viewing the grid as a surface

The grid is larger than any one surface, and a surface is not always a plain rectangle of square
buttons. The eye button above the grid views the grid as one of your surfaces, which:

- crops the grid to the region that surface covers,
- draws only the cells the surface actually has controls on, so it is clear where things like the
  encoders of a Stream Deck +XL sit among the buttons above them,
- draws each control at the shape that surface draws it, so you can see how a button will really look
  on a widescreen or touch-strip display without opening each one in turn.

While the view is on, a banner above the grid says which surface it is showing, and turns it off
again. The cell coordinates are unchanged — they are still the grid's own, not the surface's.

You can also pick a **model** of surface rather than one you have, and say where on the grid it would
sit, so a surface can be programmed before it arrives. Companion learns how a surface is laid out when
one connects, so only models which have been plugged in at some point can be chosen.
