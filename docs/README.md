# Docs

This is the user-guide documentation offered inside of Companion.

It is also synced to https://github.com/bitfocus/website to publish on https://companion.free as part of the public website, with a different build config

## Installation

```bash
yarn
```

## Generated pages

The REST API reference (`user-guide/5_remote-control/rest-api/`) is generated from the API definition rather than committed. Generate it before starting or building the docs, otherwise links to it will be broken:

```bash
yarn build:rest-api-docs
```

This is done automatically when building Companion, and when syncing the docs to the website.

## Local Development

```bash
yarn start
```

This command starts a local development server and opens up a browser window. Most changes are reflected live without having to restart the server.
