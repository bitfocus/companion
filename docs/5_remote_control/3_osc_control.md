Remote triggering can be done by sending OSC commands to port `12321`.

**Commands**

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

**Examples**

Press button 5 on page 1 down and hold  
`/press/bank/1/5 1`

Change button background color of button 5 on page 1 to red  
`/style/bgcolor/1/5 255 0 0`

Change the text of button 5 on page 1 to ONLINE  
`/style/text/1/5 ONLINE`