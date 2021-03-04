# Getting Started with Companion React UI

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

### `yarn dev`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

It is configured to connect back to a companion instance running on the default port (8000).\
If you need it to use another port, see `yarn start`

### `yarn start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

By default it assumes that companion is running on the same port, which is most likely wrong.\
Instead set the environment variable `REACT_APP_SERVER_URL=http://localhost:8000` in your shell (updating the port to match what you require) before running `yarn start` to direct it to the correct port

### `yarn build`

Builds the app for production to the `build` folder.\
This gets called when doing an electron build and `yarn update`, so should not be needed often
