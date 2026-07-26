---
title: RossTalk Control
description: Control Companion via RossTalk protocol.
---

RossTalk is [Ross Video's](https://help.rossvideo.com/acuity-device/Topics/Protocol/RossTalk.html) simple text-based control protocol. Companion can be triggered by sending RossTalk commands over TCP to port `7788`. This port is fixed and cannot be changed. The listener must first be enabled in the [Settings](../3_config/settings.md#rosstalk).

:::warning
RossTalk commands must be terminated with a newline character, i.e., \n (0x0A) or \r\n (0x0D, 0x0A).
:::

## Commands

Companion listens for the `CC` (Custom Command) verb. The value that follows tells Companion which button to press.

- `CC <page>/<row>/<column>`  
  _Press and release the button at a grid position_

- `CC <page>:<button>` _(deprecated)_  
  _Press and release a button by its legacy button number_

The `<page>:<button>` form uses the old 1–32 button numbering from an 8-column grid (button 1 is row 0 / column 0, button 9 is row 1 / column 0, and so on). It is kept only for backwards compatibility — new setups should use the `<page>/<row>/<column>` form.

## Examples

Press and release row 3, column 1 on page 2  
`CC 2/3/1`

Press and release button 5 on page 2  
`CC 2:5`

## Using RossTalk from other software

Many devices and applications that speak RossTalk have a dedicated "Custom Command" field which adds the `CC ` prefix for you. In that case, enter only the command body — e.g. `2/3/1`, **not** `CC 2/3/1`.

### ProPresenter

ProPresenter automatically prepends `CC ` to whatever you enter, so you should type only the command body:

1. In ProPresenter, add a RossTalk device pointing at Companion's IP address and port `7788`.
2. For a trigger, set the command to just the button reference, e.g. `2/3/1` (page 2, row 3, column 1).
3. Do **not** include the `CC ` prefix — entering `CC 2/3/1` results in ProPresenter sending `CC CC 2/3/1`.

See Renewed Vision's [RossTalk device guide](https://support.renewedvision.com/hc/en-us/articles/1500000025242-Devices-RossTalk) for the full setup steps.
