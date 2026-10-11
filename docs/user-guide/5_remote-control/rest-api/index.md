---
title: REST API
sidebar_position: 0
---

import DocCardList from '@theme/DocCardList'

# REST API

Companion 5.1 introduces a new REST API for configuring Companion from scripts and other software. It is a
proper, versioned API, which will grow over time to cover most of what can be done in the UI. It will
eventually replace the older [HTTP Remote Control](../http-remote-control.md) API.

:::note
The REST API is new in Companion 5.1, and so far only covers managing [connections](./connections.md) and
[surfaces](./surfaces.md). More areas will be added in future releases.
:::

## Enabling the API

The REST API is **disabled** by default. To use it:

1. Go to **Settings > Protocols** and turn on **REST API**.
2. In the table of API keys that appears, click **+** (_Add API key_), give the key a name and choose
   its [scopes](./authentication.md#scopes).
3. Copy the key that is shown. For security it is not stored, so it cannot be shown again.

See [Authentication](./authentication.md) for how to use the key.

## Base URL and versioning

All endpoints live under `/api/v2` on the same address and port as the Companion admin interface, for
example `http://127.0.0.1:8000/api/v2/surfaces/v1`. Each area of the API is versioned on its own (the `v1`
in `/surfaces/v1`), so that one area can change without affecting the others.

Errors are returned as JSON, in the form `{ "error": { "code": "...", "message": "..." } }`.

## Interactive documentation

While the API is enabled, Companion serves:

- interactive documentation at `[companion url]/api/v2/docs`, where you can try out requests from
  your browser
- the OpenAPI schema at `[companion url]/api/v2/openapi.json`, which can be used to generate client
  code

<DocCardList />
