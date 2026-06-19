---
title: Image element
sidebar_position: 3
description: Show an image on a button, from your computer or the Image Library.
---

# Image element

An **Image** element shows a picture on your button — an icon, a logo, a camera thumbnail, anything
you like. You can stack a Text element on top of an Image element to label it.

As well as the shared **Layer** and **Position & Size** sections (see
[Button styling](./index.md#element-properties)), an Image element has a **Content** section.

## Choosing the image

The **Image** field is a picker. There are two ways to give it an image:

1. **Upload one directly.** Click **Select image** and choose a file from your computer. The image is
   stored inside that button.
2. **Reference the Image Library.** Pick an image you've already uploaded to the
   [Image Library](../../../image-library.md). This is the recommended approach when you want to reuse
   the same image on lots of buttons — update it once in the library and every button that references
   it updates too.

A library image is referenced by name using the `$(image:name)` syntax, so you can also type or paste
a reference into an expression if you prefer.

## Fitting and positioning

- **Fill Mode** controls how the image is scaled to the element's size:
  - **Fit** — scale the image so the whole thing is visible inside the element (the default).
  - **Fill** — scale the image so it covers the whole element, cropping any overflow.
  - **Crop** — crop the image to the element's size without scaling.
- **Horizontal Alignment** / **Vertical Alignment** — where the image sits within the element when it
  doesn't fill it completely.
