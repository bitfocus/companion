The following controls are available via emberplus:

- Companion Product Infomation<br>
  Path: `/Companion Tree/identity/<parameter name>`<br>
  Permissions: Read Only<br>
  Parameter Types: `string`<br>
- Button Manipulation<br>
  Path: `/Companion Tree/pages/<page name>/<button number>/<parameter name>`<br>
  Path: `/Companion Tree/location/<row number>/<coloumn number>/<parameter name>`<br>
  Permissions: Read/Write<br>
  Parameters: `State`, `Label`, `Text_Color`, `Background_Color`<br>
  Parameter Types: `boolean`, `string`<br>
- Internal Variables<br>
  Path: `/Companion Tree/variables/internal/<parameter name>/<parameter type>`<br>
  Permissions: Read Only<br>
  Parameter Types: `boolean`, `integer`, `string`<br>
- Custom Variables
  Path: `/Companion Tree/variables/custom/<parameter name>/string`<br>
  Permissions: Read/Write<br>
  Parameter Types: `string`<br>
- Action Recorder<br>
  Path: `/Companion Tree/action recorder/<parameter name>`<br>
  Permissions: Read/Write<br>
  Parameters: `Enable`, `Discard`<br>
  Parameter Types: `boolean`<br>

## Server Restarts

The Ember Plus server will automatically restart to rebuild the ember tree under the following condictions, as such they should not be performed during production useage:

- Page count change
- Button matrix size change
- Adding new connections
- Changing the label of a connection
- Adding new custom variables

## Node path stability

The Ember Plus server can not guarantee the stability of the numerical paths to variables between Companion restarts, as this is contingent upon initialisation order. Whenever possible one should preference use of texutal paths such as `Companion Tree/variables/internal/instance_warns` rather than `0.3.1.3` as these are stable. After significant changes, which will have triggered a restart of the ember plus server, a full Companion restart can help stabilise the numeric ember paths.
