---
title: Authentication
sidebar_position: 0
description: How to authenticate with the REST API
---

# Authentication

The REST API uses **Bearer token** authentication. Include your API key in every request:

```http
Authorization: Bearer <token>
```

For example, using `curl`:

```bash
curl -H "Authorization: Bearer cpn_..." http://127.0.0.1:8000/api/v2/surfaces/v1
```

A request without a valid key is rejected with `401 Unauthorized`. A request whose key does not have the
scope an endpoint needs is rejected with `403 Forbidden`.

## Why API keys are required

You may notice that the rest of Companion does not ask for this. The admin interface has no real
authentication yet (the [Admin UI Password](../../3_config/settings.md#admin-ui-password) only stops casual
browsers), and the older remote control protocols such as [HTTP Remote Control](../http-remote-control.md),
[TCP/UDP](../tcp-udp.md) and [OSC](../osc-control.md) accept requests from anyone who can reach them.

Adding proper authentication to Companion is something we intend to work on. Requiring API keys from
the start means that the REST API will not need a breaking change when that happens: scripts and integrations
written today will keep working, rather than suddenly needing credentials they were never given.

Keys also give you some control in the meantime. Each script or system can have its own key, limited to just
the [scopes](#scopes) it needs, and a key can be revoked without affecting anything else.

## Managing API keys

API keys are managed in **Settings > Protocols**, in the **REST API** section. This section only shows
the keys once the REST API is turned on.

- Click **+** (_Add API key_) to create a key. Give it a **Name** so you can recognise it later, and pick
  the **Scopes** it should have. Only give a key the scopes it needs.
- When a key is created it is shown once. Copy it straight away: Companion only stores a hash of it, so
  it cannot be shown again. If you lose a key, revoke it and create a new one.
- The table shows the start of each key and when it was **Last used**, to help you find keys which are
  no longer in use.
- Use the pencil button to rename a key or change its scopes, and the bin button to revoke it. A revoked
  key stops working immediately.

API keys are separate from the [Admin UI Password](../../3_config/settings.md#admin-ui-password),
which does not protect the REST API.

## Scopes

| Scope         | Grants                                                            |
| ------------- | ----------------------------------------------------------------- |
| `read`        | Read resources (GET endpoints)                                    |
| `write`       | Create, update, delete resources (implies `read`)                 |
| `execute`     | Trigger actions like execute triggers or buttons (implies `read`) |
| `connections` | Access connection operations when combined with `read` or `write` |
| `admin`       | Full access (implies all scopes)                                  |

Connection endpoints require both the `connections` scope and an access scope. Use `connections` + `read` for
read operations, or `connections` + `write` for create, update, delete, move, and restart operations. Connection
secrets follow the same rules as the rest of the connection configuration.
