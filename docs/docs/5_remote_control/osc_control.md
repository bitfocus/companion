Remote triggering can be done by sending OSC commands to port `12321` (the port number is configurable).

**Commands**

- `/location/<page>/<row>/<column>/press`  
  _Press and release a button (run both down and up actions)_
- `/location/<page>/<row>/<column>/down`  
  _Press the button (run down actions and hold)_
- `/location/<page>/<row>/<column>/up`  
  _Release the button (run up actions)_
- `/location/<page>/<row>/<column>/rotate-left`  
  _Trigger a left rotation of the button/encoder_
- `/location/<page>/<row>/<column>/rotate-right`  
  _Trigger a right rotation of the button/encoder_
- `/location/<page>/<row>/<column>/step`  
  _Set the current step of a button/encoder_

- `/location/<page>/<row>/<column>/style/bgcolor <red 0-255> <green 0-255> <blue 0-255>`  
  _Change background color of button_
- `/location/<page>/<row>/<column>/style/bgcolor <css color>`  
  _Change background color of button_
- `/location/<page>/<row>/<column>/style/color <red 0-255> <green 0-255> <blue 0-255>`  
  _Change color of text on button_
- `/location/<page>/<row>/<column>/style/color <css color>`  
  _Change color of text on button_
- `/location/<page>/<row>/<column>/style/text <text>`  
  _Change text on a button_

- `/custom-variable/<name>/value <value>`  
  _Change custom variable value_
- `/surfaces/rescan`
  _Rescan for USB surfaces_

**Examples**

Press row 0, column 5 on page 1 down and hold  
`/location/1/0/5/press`

Change button background color of row 0, column 5 on page 1 to red  
`/location/1/0/5/style/bgcolor 255 0 0`  
`/location/1/0/5/style/bgcolor rgb(255,0,0)`  
`/location/1/0/5/style/bgcolor #ff0000`

Change the text of row 0, column 5 on page 1 to ONLINE  
`/location/1/0/5/style/text ONLINE`

Change custom variable "cue" to value "intro":  
`/custom-variable/cue/value intro`

**Deprecated Commands**

The following commands are deprecated and have replacements listed above. They will be removed in a future version of Companion.

- `/press/bank/ <page> <bank>`  
  _Press and release a button (run both down and up actions)_
- `/press/bank/ <page> <bank> <1>`  
  _Press the button (run down actions and hold)_
- `/press/bank/ <page> <bank> <0>`  
  _Release the button (run up actions)_
- `/style/bgcolor/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>`  
  _Change background color of button_
- `/style/color/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>`  
  _Change color of text on button_
- `/style/text/ <page> <bank> <text>`  
  _Change text on a button_
- `/rescan 1`
  _Make Companion rescan for newly attached USB surfaces_
