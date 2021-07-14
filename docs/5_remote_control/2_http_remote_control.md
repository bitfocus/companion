Remote triggering can be done by sending `HTTP` Requests to the same IP and port Companion is running on.

**Commands**

- `/press/bank/<page>/<bank>`  
  _Press and release a button (run both down and up actions)_
- `/style/bank/<page>/<bank>?bgcolor=<bgcolor HEX>`  
  _Change background color of button_
- `/style/bank/<page>/<bank>?color=<color HEX>`  
  _Change color of text on button_
- `/style/bank/<page>/<bank>?text=<text>`  
  _Change text on a button_
- `/style/bank/<page>/<bank>?size=<text size>`  
  _Change text size on a button (between the predefined values)_

**Examples**  
Press page 1 bank 2:  
`/press/bank/1/2`

Change the text of button 4 on page 2 to TEST:  
`/style/bank/2/4/?text=TEST`

Change the text of button 4 on page 2 to TEST, background color to #ffffff, text color to #000000 and font size to 28px:  
`/style/bank/2/4/?text=TEST&bgcolor=%23ffffff&color=%23000000&size=28px`