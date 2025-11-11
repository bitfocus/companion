---
title: Contour Shuttle
sidebar_position: 6
description: Setup guide for Contour ShuttleXpress and ShuttlePro.
---

Bitfocus Companion supports using the Contour ShuttleXpress and ShuttlePro v1 and v2, since Companion v3.1.0. (Note: support for very old versions of ShuttlePro v1 was added in v4.1.3)

## Enable USB Detection

You must enable scanning for Contour Shuttle products in Companion's _Settings > Surfaces_ section and rescan for USB devices.

## Setting button/jog wheel/shuttle ring actions

The button layout closely matches the device, with the following addition. For the shuttle ring you have the choice of two different buttons:

- **_row2/col2_**: a rotate action will be sent once for each "stop" on the ring (+/- 7, including 0),
- **_row2/col3_**: rotate actions will be sent with increasing frequency in proportion to how far the ring has been turned away from the neutral position. Use a custom variable (see next section) if you need to determine direction and magnitude. (No action is sent when the shuttle returns to 0)

:::note
In either case, **_rotate-left_** is emitted when the jog is to the left of zero (the neutral position) and **_rotate-right_** is sent when the jog is to the right of zero, regardless of the physical rotation direction.
:::

![Contour Shuttle template](images/contour-shuttle.png?raw=true 'Contour Shuttle template')

**Download a [Contour Shuttle template](assets/contour-shuttle-template.companionconfig) here.** (The template includes the variables described in the next section.)

## Setting Variables

The contour shuttle can set the values of two custom variables of your choosing to indicate shuttle position and jog motion. To enable this feature you must first define custom variables. For example, got to the Custom Variables tab and add the following two variables: `$(custom:contourShuttleJog)` and `$(custom:contourShuttleRing)`...

![Define Contour Shuttle Variables](images/contour-shuttle-custom-variables.png?raw=true 'Define Contour Shuttle Variables')

Once the variables have been defined, go to the **_Configured Surfaces_** page and select the variables in the right-hand _Settings_ panel:

![Set Contour Shuttle Variables](images/contour-shuttle-set-custom-variables.png?raw=true 'Set Contour Shuttle Variables')

Now the variables will be set by the Contour Shuttle. Using the example names defined above:

- `$(custom:contourShuttleJog)` (+1/-1): indicates the rotational direction of the jog wheel for 20 ms after each click-stop.
- `$(custom:contourShuttleRing)` (-7 to +7): indicates the current shuttle position
