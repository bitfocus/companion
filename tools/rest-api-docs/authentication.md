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

## Development Tokens

Static tokens are available for development and testing:

| Token         | Scopes        | Description             |
| ------------- | ------------- | ----------------------- |
| `cpn_read`    | read          | Read-only access        |
| `cpn_write`   | read, write   | Read and write access   |
| `cpn_execute` | read, execute | Read and execute access |
| `cpn_admin`   | admin (all)   | Full admin access       |

## Scopes

| Scope     | Grants                                            |
| --------- | ------------------------------------------------- |
| `read`    | Read resources (GET endpoints)                    |
| `write`   | Create, update, delete resources (implies `read`) |
| `execute` | Trigger actions like restart (implies `read`)     |
| `admin`   | Full access (implies all scopes)                  |

## Enabling the REST API

The REST API must be enabled in Companion settings (`rest_api_enabled`). **A restart is required** after changing this setting.

When enabled, interactive documentation is available at `/api/docs` (Swagger UI).
