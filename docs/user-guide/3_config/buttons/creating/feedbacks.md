---
title: Feedbacks
sidebar_position: 3
description: Configure dynamic button styling based on device state.
---

Feedbacks are a way of dynamically updating a buttons style based on the state of devices or other variables.

Some modules are able to provide feedback back to the button, such as changing the button's foreground or background colors to reflect the current status of the device.

Companion has some builtin feedbacks, to allow for generic functionality such as changing the style when a variable has a certain value.

![Feedback](images/feedback.png?raw=true 'Feedback')

The feedbacks can also be reordered by grabbing the sort icon next and dragging it up or down, their value gets applied on top of the configured style of the button in the order shown.

Most feedbacks allow you to change any drawing property on a button, but some feedbacks are older and are limited to only changes the colours.  
Some modules provide some feedbacks which provide a generated image typically to show complex statuses in a thought out and well arranged fashion.

:::note
If you find these limited feedbacks to be a problem for your use of a module, open a feature request on that modules GitHub to get the feedbacks updated.
:::
