---
title: Authentication
sidebar_position: 0
description: How to authenticate with the REST API
---

# Authentication

The REST API uses **Bearer token** authentication. Include your token in every request:

```
Authorization: Bearer <token>
```

Tokens can be created in the admin UI (in development).

## Scopes

| Scope     | Grants                                                            |
| --------- | ----------------------------------------------------------------- |
| `read`    | Read resources (GET endpoints)                                    |
| `write`   | Create, update, delete resources (implies `read`)                 |
| `execute` | Trigger actions like execute triggers or buttons (implies `read`) |
| `admin`   | Full access (implies all scopes)                                  |
