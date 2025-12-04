---
title: Satellite Protocol API
sidebar_label: Satellite Protocol
description: Companion Satellite protocol for remote surfaces.
---

In some environments, it can be useful to connect a remote Streamdeck into Companion.

We have developed [Companion Satellite](https://user.bitfocus.io/product/companion-satellite) for this purpose. The Satellite API can be used for direct communication as well, as follows:

It is possible to remotely connect a 'streamdeck' to companion so that it appears as its own device and follows the paging model. This is different to how the OSC/TCP/UDP servers operate.

This page documents the protocol. The intention is to only ever add non-breaking functionality to this API, and to keep this document updated with new functionality as it is added.

## API Spec

The server by default runs on port TCP 16622, but this will become configurable in the future. You should make sure to support alternate ports to allow for future compatibility as well as firewalls or router port forwarding.  
As of Companion 3.5, it is also possible to use this protocol over websockets, with a default port of 16623.

Each message is presented as a line, with a `\n` or `\r\n` terminator.  
Messages follow the general format of `COMMAND-NAME ARG1=VAL1 ARG2=true ARG3="VAL3 with spaces"\n`.
Key numbers are in the range of 0-31.

Note: You can send boolean values can as both true/false and 0/1, you will always receive them as 0/1

Upon connection you will receive `BEGIN CompanionVersion=2.2.0-d9008309-3449 ApiVersion=1.0.0` stating the build of companion you are connected to. The `CompanionVersion` field should not be relied on to be meaningful to your application, but can be presented as information to the user, or to aid debugging. You should use the `ApiVersion` field to check compatibility with companion. The number followers [semver](https://semver.org/) for versioning. We hope to keep breaking changes to a minimum, and will do so only when necessary.

### Messages to send

Upon receiving an unknown command, the server will respond with the format `ERROR MESSAGE="Unknown command: SOMETHING"`  
Known commands will get either a success or error response like the following:

- `COMMAND-NAME ERROR MESSAGE="Some text here"\n`
- `COMMAND-NAME OK\n`
- `COMMAND-NAME OK ARG1=arg1\n`

#### Close connection

`QUIT`
Close the connection, removing all registered devices

#### Ping/pong

`PING payload`
Check the server is alive, with an arbitrary payload
Responds with `PONG payload`  
You must call this at an interval, we recommend every 2 seconds, this is to ensure the connection does't get closed from being idle.

#### Adding a satellite device

`ADD-DEVICE DEVICEID=00000 PRODUCT_NAME="Satellite Streamdeck"`

- `DEVICEID` should be a unique identifier for the hardware device. such as a serialnumber, or mac address. This should be in the format `streamdeck:12345` to both ensure there arent collisions between device types, and make the id a bit more meaningful.
- `PRODUCT_NAME` is the name of the product to show in the Surfaces table in the UI

Optional parameters:

- `KEYS_TOTAL` - number of keys the device has. (default 32) Valid values varies depending on API Version:
  - Since 1.5.1, this can be any integer value >= 1
  - Before 1.5.1, must be in the range 1-32
- `KEYS_PER_ROW` - number of keys per row. (default 8) Valid values varies depending on API Version:
  - Since 1.5.1, this can be any integer value >= 1
  - Before 1.5.1, must be in the range 1-8
- `BITMAPS` - This varies depending on API Version:
  - Since 1.5.0, this is a number specifying the desired size of the bitmaps. If 0 or false, then bitmaps will not be streamed. If 1 or true, they will be 72px (default 72)
  - Before 1.5.0, this is true/false whether you want to be streamed bitmaps for display on the buttons (default true)
- `COLORS` - Since 1.6 true/false/'hex'/'rgb', before 1.6 true/false whether you want to be streamed colors for display on the buttons and in which format (default false). If you specify true or 'hex', you'll get color readouts in hexadecimal notation, if you specify 'rgb', you'll get color readouts in css rgb notation without spaces.
- `TEXT` - true/false whether you want to be streamed button text for display on the buttons (default false)
- `TEXT_STYLE` - (added in v1.4.0) true/false whether you want to be streamed text style information for display on the buttons (default false)
- `BRIGHTNESS` - (added in v1.7.0) true/false whether the device supporting changing brightness (default true)
- `VARIABLES` - (added in v1.7.0) a base64 encoded json array describing any input or output variables supported for this device  
   Each item in the array should be of the form:
  ```
  {
      "id": "some-id", // This is the identifier used when sending/receiving a value for the variable
      "type": "input", // or "output". When set to `input`, this is a value that the satellite device produces. When `output`, a value will be streamed to the satellite device
      "name": "My value", // A user facing name for this variable
      "description": "Something longer about it. eg Supports values in range 0-100", // A longer user facing description of this variable
  }
  ```
- `PINCODE_LOCK` - (added in v1.8.0) you can set to indicate that you will handle display of the pincode locked state. set to `FULL` to indicate that you will handle display and input or to `PARTIAL` to indicate that you will handle display and the user will not be able to input a pincode. (Partial mode has no difference in behaviour currently, but we will utilise it in the future)

#### Removing a satellite device

`REMOVE-DEVICE DEVICEID=00000`

- `DEVICEID` the unique identifier used to add the device

#### Pressing a key

`KEY-PRESS DEVICEID=00000 KEY=0 PRESSED=true`

- `DEVICEID` the unique identifier used to add the device
- `KEY` number of the key which is pressed/released. Since v1.6 this can be either a legacy key number or the local row/column starting at top left with `0/0` and counting up towards bottom/right
- `PRESSED` true/false whether the key is pressed

#### Rotating an encoder (Since v1.3.0)

Note: there is a checkbox to enable this per bank inside Companion, allowing users to define the actions to execute

`KEY-ROTATE DEVICEID=00000 KEY=0 DIRECTION=1`

- `DEVICEID` the unique identifier used to add the device
- `KEY` number of the key/encoder which is rotated. Since v1.6 this can be either a legacy key number or the local row/column starting at top left with `0/0` and counting up towards bottom/right
- `DIRECTION` direction of the rotation. 1 for right, -1 for left

#### Updating a variable (Since v1.7.0)

This can be used when input variables are defined as part of `ADD-DEVICE`.

`SET-VARIABLE-VALUE DEVICEID=00000 VARIABLE="some-id" VALUE="abc="`

- `DEVICEID` the unique identifier used to add the device
- `VARIABLE` the id of the variable being updated
- `VALUE` the value of the variable, base64 encoded. The encoding is so that special characters and newlines don't have to be escaped, avoiding a wide range of easy to trigger bugs.

#### Pincode key press (Since v1.8.0)

When handling the pincode locked state yourself, report a pincode key was pressed

`PINCODE-KEY DEVICEID=00000 KEY=1`

- `DEVICEID` the unique identifier used to add the device
- `KEY` the value of the pressed key (0-9)

Note: depending on your surface, this may not translate directly to a button press.

### Messages to receive

No responses are expected to these unless stated below, and to do so will result in an error.

#### Ping/pong

`PING payload`
The server is checking you are still alive, with an arbitrary payload
You must respond with `PONG payload`

#### State change for key

`KEY-STATE DEVICEID=00000 KEY=0 BITMAP=abcabcabc COLOR=#00ff00`

- `DEVICEID` the unique identifier of the device
- `KEY` number of the key which the pixel buffer is for
- `TYPE` type of the key. (added in v1.1.0) Either `BUTTON`, `PAGEUP`, `PAGEDOWN` or `PAGENUM`

Optional parameters:

- `BITMAP` base64 encoded pixel data. This is only sent for devices which were added where `BITMAPS` is enabled. Resolution follows the size defined by the `BITMAPS`, also on the version of the api. Currently encoded as 8bit RGB (this may be configurable in the future).
- `COLOR` hex or css encoded 8bit RGB color for the key background. This is only sent for devices which were added where `COLORS` was true
- `TEXTCOLOR` hex or css encoded 8bit RGB color for the key text. This is only sent for devices which were added where `COLORS` was true (added in v1.6)
- `TEXT` base64 encoded text as should be displayed on the key. This is only sent for devices which were added where `TEXT` was true
- `FONT_SIZE` numeric size that should be used when displaying the text on the key. This is only sent for devices which were added where `TEXT_SYLE` was true (added in v1.4.0)

Note: expect more parameters to be added to this message over time. Some could increase the frequency of the message being received.

#### Reset all keys to black

`KEYS-CLEAR DEVICEID=00000`

- `DEVICEID` the unique identifier of the device

#### Change brightness

`BRIGHTNESS DEVICEID=00000 VALUE=100`

- `DEVICEID` the unique identifier of the device
- `VALUE` brightness number in range 0-100

#### Update of a variable (Since v1.7.0)

This can be received when output variables are defined as part of `ADD-DEVICE`.

`VARIABLE-VALUE DEVICEID=00000 VARIABLE="some-id" VALUE="abc="`

- `DEVICEID` the unique identifier used to add the device
- `VARIABLE` the id of the variable being updated
- `VALUE` the value of the variable, base64 encoded. The encoding is so that special characters and newlines don't have to be escaped, avoiding a wide range of easy to trigger bugs.

#### Locked state update (Since v1.8.0)

This can be received when `PINCODE_LOCK` was specified when addign the device

`LOCKED-STATE DEVICEID=00000 LOCKED=true CHARACTER_COUNT=0`

- `DEVICEID` the unique identifier used to add the device
- `LOCKED` whether the surface is locked
- `CHARACTER_COUNT` how many characters have been entered for the pincode

Between this reporting `LOCKED=true` and `LOCKED=false`, you will not receive any other drawing messages, and any input messages you send will be ignored.
