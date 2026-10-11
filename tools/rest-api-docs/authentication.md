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
