---
title: Authentication
sidebar_position: 0
description: How to authenticate with the REST API
---

# Authentication

The REST API uses **Bearer token** authentication. Include your token in every request:

```http
Authorization: Bearer <token>
```

Tokens can be created in the admin UI (in development).

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
