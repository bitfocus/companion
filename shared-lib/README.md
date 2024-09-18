# Getting Started with Companion Shared Lib

Files in this folder are used by both the backend and ui.

To allow this, we need to be careful about imports, so that we don't attempt to pull backend code into the ui

### `yarn dev`

Runs the development mode watcher.\
This will recompile the typescript when a file changes

### `yarn build`

Builds the library.\
This gets called when doing an electron build or during `yarn dev`, so should not be needed often
