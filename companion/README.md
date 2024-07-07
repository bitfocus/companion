# Getting Started with Companion Application

This package contains the main application of Companion.

## Available Scripts

### `yarn dev`

Runs the app in the development mode.\
You can open the web interface at [http://localhost:8000](http://localhost:8000) in the browser if you have built the web interface, or run the web interface in development mode too for the full setup

#### `yarn dev:debug`

This is the same as `yarn dev` but with additional debug logging enabled

#### `yarn dev:inner`

This is similar to `yarn dev` but does not specify the interface to bind to, and leaves logging at the default 'info' level.  
It is intended for advanced usage where a custom startup command is wanted.

### `yarn build`

Builds the app for production to the `dist` folder.\
This gets called when doing an electron build, so should not be needed often
