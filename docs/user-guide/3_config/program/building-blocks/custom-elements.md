---
title: Custom Elements
sidebar_position: 3
description: Build your own reusable button elements out of other elements, with inputs.
slug: /config/custom-elements
---

:::warning[Beta]
Custom elements are new and still in beta. The way they behave may change in future releases.
:::

A custom element is a group of elements that you build once, and then add to any button, just like any other element. You can give it **inputs**, so each button that uses it can change what it draws.

Use them when the same design appears on many buttons. For example, a channel strip with a name, a level meter and a mute indicator. You draw it once, and each button only sets its inputs, such as the channel number.

Custom elements are the partner of [custom actions](./custom-actions.md) and [custom feedbacks](./custom-feedbacks.md). They work in the same way as the composite elements that some modules provide. You find them under **Building Blocks → Elements** in the sidebar.

## Creating a custom element

Click **Add Custom Element**, then select it in the list to open the editor. Give it a **Name** and a **Description**. These are what you see when you add the element to a button.

The editor has three tabs: **Elements**, **Inputs** and **Uses**.

### Elements

This is the same editor as the **Style** tab of a button: a preview, the list of elements, and the properties of the selected one. You can use any element, including groups, the composite elements of your connections, and other custom elements.

A custom element has no canvas. It is drawn inside the bounds that each button gives it, so the preview draws it without a top bar, and its positions and sizes are a percentage of those bounds. Use the aspect ratio picker under the preview to see how it looks in different shapes.

The preview draws each input with its default value.

### Inputs

Inputs are the options that appear on the element when you add it to a button. Inside the custom element, you read them with `$(options:<id>)`, in any expression or text. They work in the same way as the [inputs of a custom action](./custom-actions.md#inputs). For example, a missing input uses its default, and renaming an input keeps the values that each button has set.

### Uses

The **Uses** tab lists every button and custom element that uses this custom element. An element that is disabled, or inside a disabled group, is marked as such.

## Using a custom element

A custom element shows up in a button's **Add element** list, under **Custom**. Each use has the usual position, size, opacity and rotation, and an option for each input. Like any other element property, an input can be an expression, and can be changed by a feedback's style overrides.

A custom element can't use itself, directly or through others. The list hides any custom element that would. If uses still loop (after an import, for example), the element that comes back round is drawn as `∞`.

## How custom elements work

A custom element is a definition. **Each button draws its own copy of it**, with its own inputs.

| Variable                                             | Inside a custom element           |
| ---------------------------------------------------- | --------------------------------- |
| `$(options:…)`                                       | The inputs of **that use**.       |
| `$(this:…)`, `$(local:…)`, `$(page:…)`               | Those of the button that uses it. |
| `$(custom:…)`, `$(internal:…)`, connection variables | Shared, as everywhere else.       |

Some things to know:

- **Editing the custom element** redraws every button that uses it straight away.
- **Deleting the custom element** draws every use of it as a missing element.
- A custom element has no feedbacks or local variables of its own. To change how it looks, give it inputs, and set them from the button's feedbacks or expressions.

## Example: Channel label

This element draws a channel's name over a coloured bar.

- **Inputs**: `name` (text, default `CH`), `color` (colour, default red)
- **Elements**:
  - a **Box** filling the element, with its colour set to the expression `$(options:color)`
  - a **Text** filling the element, with its text set to `$(options:name)`

Each button adds **Channel label** and sets **Name** and **Color** to suit its channel. A feedback on the button can override **Color**, to show that the channel is muted.
