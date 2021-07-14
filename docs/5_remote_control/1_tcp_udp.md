Remote triggering can be done by sending TCP (port `51234`) or UDP (port `51235`) commands.

**Commands**

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

**Examples**  
Set the emulator surface to page 23:  
`PAGE-SET 23 emulator`

Press page 1 bank 2:  
`BANK-PRESS 1 2`