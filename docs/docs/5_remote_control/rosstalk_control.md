---
title: RossTalk Control
---

Remote triggering can be done by sending RossTalk commands to port `7788`.

## Commands

- `CC <page>/<row>/<column>`  
  _Press and release button_

- `CC <page>:<button>`  
  _Press and release button_

## Examples

Press and release row 3, column 1 on page 2
`CC 2/3/1`

Press and release button 5 on page 2  
`CC 2:5`
