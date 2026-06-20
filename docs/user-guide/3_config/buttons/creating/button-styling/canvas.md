---
title: The canvas & button indicators
sidebar_position: 5
description: The Background layer, the topbar, status icons and button state indicators.
---

# The canvas & button indicators

Every button's stack of [elements](./index.md) sits on top of a special **Background** layer, right at
the bottom of the elements list. Unlike the other elements, the Background is always present and can't
be deleted or reordered — it's the canvas your design is drawn onto, and it controls the "chrome"
around the button: the topbar and the status icons.

## Decoration (the topbar)

Select the **Background** layer and you'll find a **Decoration** dropdown. This controls the bar along
the top of the button:

- **Follow default** — use the global setting from [Settings](../../../settings.md#buttons). This is
  the default, so you can flip the topbar on or off everywhere from one place.
- **Top bar** — always show the topbar. The topbar shows the button's location (page/row/column) and,
  for [multi-step buttons](../steps.md), the current step.
- **Border when pressed** — hide the topbar, but draw a coloured border around the button while it's
  pressed, so you still get visual confirmation of a press.
- **None** — no topbar and no pressed border.

:::tip
The topbar takes up space at the top of the button. If you're placing an image or text right to the
edges, turning the topbar off (here or globally) gives you the full button area to work with.
:::

While a button is held down it shows a **pressed appearance** — the topbar fills with colour (in **Top
bar** mode) or a coloured border is drawn (in **Border when pressed** mode). This is normally brief,
but it stays on if a button is pressed without being released — for example if an action used **Button
Trigger Press** without a matching **Button Trigger Release**.

**📸 Screenshot TODO:** Background layer selected, showing the Decoration + Show status icons dropdowns.

![Background layer options](http://example.com/images/background-layer-options.png?raw=true)

## Status icons

The **Show status icons** dropdown controls the small icons drawn in the top-right corner:

- **Follow default** — use the global setting.
- **Show all** — always show the status icons.
- **None** — never show them.

These icons tell you, at a glance, when something needs attention. You'll see them appear
automatically:

| Indicator            | Meaning                                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Red triangle**     | One or more connections used by this button's actions are in an **error** state.                                                                                                     |
| **Orange triangle**  | A connection used by this button is in a **warning** state.                                                                                                                          |
| **Green play arrow** | Actions on this button are currently **running** or **queued** — for example a delayed sequence from an **internal: Wait** action or a **Sequential** [Action Group](../actions.md). |

**📸 Screenshot TODO:** Buttons showing the error / warning / running indicators in the corner.

![Status indicators](http://example.com/images/status-indicators.png?raw=true)

## Empty buttons

A button with no actions and no elements is drawn in a muted grey style. This is just Companion's way
of showing the button is empty and available — as soon as you add an element or an action it draws
normally.
