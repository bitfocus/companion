---
title: TCP / UDP Control
sidebar_position: 1
description: Control Companion remotely via TCP or UDP commands.
---

Remote triggering can be done by sending TCP or UDP commands. The port numbers must be setup in the [Settings](../3_config/settings.md#tcp) before they can be used.

:::warning
TCP commands must be terminated with a newline character, i.e., \n (0x0A) or \r\n (0x0D, 0x0A).
:::

## Commands

- `SURFACE <surface id> PAGE-SET <page number>`  
  _Set a surface to a specific page_
- `SURFACE <surface id> PAGE-UP`  
  _Page up on a specific surface_
- `SURFACE <surface id> PAGE-DOWN`  
  _Page down on a specific surface_

- `LOCATION <page>/<row>/<column> PRESS`  
  _Press and release a button (run both down and up actions)_
- `LOCATION <page>/<row>/<column> DOWN`  
  _Press the button (run down actions)_
- `LOCATION <page>/<row>/<column> UP`  
  _Release the button (run up actions)_
- `LOCATION <page>/<row>/<column> ROTATE-LEFT`  
  _Trigger a left rotation of the button/encoder_
- `LOCATION <page>/<row>/<column> ROTATE-RIGHT`  
  _Trigger a right rotation of the button/encoder_
- `LOCATION <page>/<row>/<column> SET-STEP <step>`  
  _Set the current step of a button/encoder_

- `LOCATION <page>/<row>/<column> STYLE TEXT <text>`  
  _Change text on a button_
- `LOCATION <page>/<row>/<column> STYLE COLOR <color HEX>`  
  _Change text color on a button (#000000)_
- `LOCATION <page>/<row>/<column> STYLE BGCOLOR <color HEX>`  
  _Change background color on a button (#000000)_

- `CUSTOM-VARIABLE <name> SET-VALUE <value>`  
  _Change custom variable value_
- `SURFACES RESCAN`
  _Make Companion rescan for USB surfaces_

## Examples

Set the emulator surface to page 23:  
`SURFACE emulator PAGE-SET 23`

Press page 1 row 2 column 3:  
`LOCATION 1/2/3 PRESS`

Change custom variable "cue" to value "intro":  
`CUSTOM-VARIABLE cue SET-VALUE intro`

## Deprecated Commands

:::warning
These commands will be removed in a future release of Companion. There is equivalent functionality in the list above.
:::

The following commands are deprecated and have replacements listed above. Support for this must be enabled in the settings for it to work

- `PAGE-SET <page number> <surface id>`  
  _Make device go to a specific page_
- `PAGE-UP <surface id>`  
  _Page up on a specific device_
- `PAGE-DOWN <surface id>`  
  _Page down on a specific surface_
- `BANK-PRESS <page> <bank>`  
  _Press and release a button (run both down and up actions)_
- `BANK-DOWN <page> <bank>`  
  _Press the button (run down actions)_
- `BANK-UP <page> <bank>`  
  _Release the button (run up actions)_
- `STYLE BANK <page> <bank> TEXT <text>`  
  _Change text on a button_
- `STYLE BANK <page> <bank> COLOR <color HEX>`  
  _Change text color on a button (#000000)_
- `STYLE BANK <page> <bank> BGCOLOR <color HEX>`  
  _Change background color on a button (#000000)_
- `RESCAN`
  _Make Companion rescan for newly attached USB surfaces_
