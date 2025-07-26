Remote triggering can be done by sending `HTTP` Requests to the same IP and port Companion is running on.

**Commands**

This API tries to follow REST principles, and the convention that a `POST` request will modify a value, and a `GET` request will retrieve values.

- Press and release a button (run both down and up actions)  
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/press`
- Press the button (run down actions and hold)  
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/down`
- Release the button (run up actions)  
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/up`
- Trigger a left rotation of the button/encoder
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/rotate-left`
- Trigger a right rotation of the button/encoder
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/rotate-right`
- Set the current step of a button/encoder
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/step`

- Change background color of button
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/style?bgcolor=<bgcolor HEX>`
- Change background color of button
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/style`  
  Body: `{ "bgcolor": "<bgcolor HEX>" }` OR `{ "bgcolor": "rgb(<red>,<green>,<blue>)" }`
- Change text color of button
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/style?color=<color HEX>`
- Change text color of button
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/style`  
  Body: `{ "color": "<color HEX>" }` OR `{ "color": "rgb(<red>,<green>,<blue>)" }`
- Change text of button
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/style?text=<text>`
- Change text of button
  Method: POST  
  Path: `/api/location/<page>/<row>/<column>/style`  
  Body: `{ "text": "<text>" }`

- Change custom variable value  
  Method: POST  
  Path: `/api/custom-variable/<name>/value?value=<value>`
- Change custom variable value  
  Method: POST  
  Path: `/api/custom-variable/<name>/value`  
  Body: `<value>`
- Get custom variable value  
  Method: GET  
  Path: `/api/custom-variable/<name>/value`
- Create a new custom variable  
  Method: POST  
  Path: `/api/custom-variable/<name>`  
  Body: `{ "default": "<default_value>" }` (Content-Type: application/json)
  - Returns 201 on success, 400 if the variable already exists or the default value is missing/invalid.
- Delete a custom variable  
  Method: DELETE  
  Path: `/api/custom-variable/<name>`
  - Returns 204 on success, 404 if the variable does not exist.

- Get Module variable value  
  Method: GET  
  Path: `/api/variable/<Connection Label>/<name>/value`
- Rescan for USB surfaces  
  Method: POST  
  Path: `/api/surfaces/rescan`

**Examples**  
Press page 1 row 0 column 2:  
POST `/api/location/1/0/2/press`

Change the text of row 0 column 4 on page 2 to TEST:  
POST `/api/location/1/0/4/style?text=TEST`

Change the text of row 1, column 4 on page 2 to TEST, background color to #ffffff, text color to #000000 and font size to 28px:  
POST `/api/location/2/1/4/style`  
Body: `{ "text": "TEST", "bgcolor": "#ffffff", "color": "#000000", "size": 28 }`

Change custom variable "cue" to value "intro" by URL:  
POST `/api/custom-variable/cue/value?value=intro`

Change custom variable "cue" to value "Some text" by body:  
POST `/api/custom-variable/cue/value`  
Content-Type `text/plain`  
Body: `Some text`

Change custom variable "cue" to value "Some text" by body using JSON:  
POST `/api/custom-variable/cue/value`  
Content-Type `application/json`  
Body: `"Some text"` - Text needs to be enclosed in double quotes, quotes in the text need to be escaped with a backslash.

Change custom variable "data" to a JSON object:
POST `/api/custom-variable/data/value`  
Content-Type `application/json`  
Body: `{"name":"Douglas", "answer":42}` - Body needs to be a valid JSON.  
The object will be stored in the variable value and will not be converted to a string. You can also use the data types boolean, number, array or null. JSON does not support sending undefined as a value, but we interpret an empty body as undefined, properties of an object can of course be undefined.

**Examples**

Create a new custom variable "myvar" with default value "hello":
POST `/api/custom-variable/myvar`
Content-Type: application/json
Body: `{ "default": "hello" }`

Delete a custom variable "myvar":
DELETE `/api/custom-variable/myvar`

**Deprecated Commands**

The following commands are deprecated and have replacements listed above. They will be removed in a future version of Companion.

- `/press/bank/<page>/<bank>`  
  _Press and release a button (run both down and up actions)_
- `/press/bank/<page>/<bank>/down`  
   Press a button (run both down actions)\_
- `/press/bank/<page>/<bank>/up`  
   Release a button (run up actions)\_
- `/style/bank/<page>/<bank>?bgcolor=<bgcolor HEX>`  
  _Change background color of button_
- `/style/bank/<page>/<bank>?color=<color HEX>`  
  _Change color of text on button_
- `/style/bank/<page>/<bank>?text=<text>`  
  _Change text on a button_
- `/style/bank/<page>/<bank>?size=<text size>`  
  _Change text size on a button (between the predefined values)_
- `/set/custom-variable/<name>?value=<value>`  
  _Change custom variable value_
- `/rescan`  
  _Make Companion rescan for newly attached USB surfaces_
