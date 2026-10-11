---
title: Connections
sidebar_position: 1
description: REST API endpoints for Connections
---

# Connections

## GET `/connections/v1`

**List all connections**

Returns all connections with their current status. Use query parameters to include config and secrets.

**Required scope:** `connections, read`

**Parameters:**

| Parameter         | In    | Type     | Description                                                           |
| ----------------- | ----- | -------- | --------------------------------------------------------------------- |
| `include_config`  | query | `string` | Include connection config in response                                 |
| `include_secrets` | query | `string` | Include connection secrets in response (requires include_config=true) |

**Example:**

`GET /api/v2/connections/v1`

**Response body:**

```json
{
	"data": [
		{
			"id": "KJA1isEECHRDBTFjx-7tf",
			"label": "ATEM",
			"moduleId": "bmd-atem",
			"moduleVersionId": "1.2.0",
			"updatePolicy": "stable",
			"enabled": true,
			"status": {
				"category": "ok",
				"level": "info",
				"message": "Connected"
			},
			"config": {},
			"secrets": {}
		}
	],
	"meta": {
		"total": 1,
		"limit": 100,
		"offset": 0
	}
}
```

**Successful response** (`200`) — List of connections

Response body (collection):

| Field                    | Type                           | Description                                                                                                                                                                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | `string`                       | Unique connection instance id.                                                                                                                                                                    |
| `label`                  | `string`                       | Display name shown for the connection in Companion.                                                                                                                                               |
| `moduleId`               | `string`                       | Connection module id, such as "bmd-atem" or "obs-websocket".                                                                                                                                      |
| `moduleVersionId`        | `string \| null`               | Module version id used by this connection, such as "1.2.0". Null means the newest compatible stable version is selected automatically, and may be returned while that version is being installed. |
| `updatePolicy`           | `manual` \| `stable` \| `beta` | Module version update policy for this connection.                                                                                                                                                 |
| `enabled`                | `boolean`                      | Whether the connection is enabled and allowed to run.                                                                                                                                             |
| `status`                 | `object \| null`               | Latest runtime status reported by the connection.                                                                                                                                                 |
| &nbsp;&nbsp;↳ `category` | `string \| null`               | Status category reported by the connection module.                                                                                                                                                |
| &nbsp;&nbsp;↳ `level`    | `string \| null`               | Severity level of the current connection status.                                                                                                                                                  |
| &nbsp;&nbsp;↳ `message`  | `string \| null`               | Human-readable status message from the connection module.                                                                                                                                         |
| `config`                 | `object`                       | Non-secret connection configuration values.                                                                                                                                                       |
| `secrets`                | `object`                       | Secret connection configuration values.                                                                                                                                                           |

---

## POST `/connections/v1`

**Create a connection**

Create a new connection instance for a given connection module id. If the module is not installed, Companion queues installation of the latest compatible stable version by default.

**Required scope:** `connections, write`

**Request body** (`application/json`):

| Field          | Type                           | Required | Description                                                                                                                                                                  |
| -------------- | ------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `moduleId`     | `string`                       | Yes      | Connection module id to create, such as "bmd-atem" or "obs-websocket".                                                                                                       |
| `label`        | `string`                       | Yes      | Display name for the new connection.                                                                                                                                         |
| `versionId`    | `string \| null`               | No       | Specific module version to use. Omit or use null to use the newest compatible stable version. If the module is not installed, Companion queues installation of that version. |
| `updatePolicy` | `manual` \| `stable` \| `beta` | No       | Module version update policy for the new connection.                                                                                                                         |
| `disabled`     | `boolean`                      | No       | Whether the new connection should be created disabled.                                                                                                                       |

**Example:**

`POST /api/v2/connections/v1`

**Request body:**

```json
{
	"moduleId": "bmd-atem",
	"label": "ATEM",
	"versionId": null,
	"updatePolicy": "stable",
	"disabled": false
}
```

**Response body:**

```json
{
	"data": {
		"id": "KJA1isEECHRDBTFjx-7tf"
	}
}
```

**Successful response** — Connection created

Response body:

| Field | Type     | Description                    |
| ----- | -------- | ------------------------------ |
| `id`  | `string` | Unique connection instance id. |

---

## GET `/connections/v1/tree`

**Get the connection arrangement**

Returns all connections grouped into the complete collection hierarchy. Array order represents the current display order.

**Required scope:** `connections, read`

**Parameters:**

| Parameter         | In    | Type     | Description                                                           |
| ----------------- | ----- | -------- | --------------------------------------------------------------------- |
| `include_config`  | query | `string` | Include connection config in response                                 |
| `include_secrets` | query | `string` | Include connection secrets in response (requires include_config=true) |

**Example:**

`GET /api/v2/connections/v1/tree`

**Response body:**

```json
{
	"data": {
		"connections": [
			{
				"id": "KJA1isEECHRDBTFjx-7tf",
				"label": "ATEM",
				"moduleId": "bmd-atem",
				"moduleVersionId": "1.2.0",
				"updatePolicy": "stable",
				"enabled": true,
				"status": {
					"category": "ok",
					"level": "info",
					"message": "Connected"
				},
				"config": {},
				"secrets": {}
			}
		],
		"collections": [null]
	}
}
```

**Successful response** (`200`) — Connection arrangement

Response body:

| Field         | Type       | Description                                                        |
| ------------- | ---------- | ------------------------------------------------------------------ |
| `connections` | `object[]` | Ungrouped connections at the root, in their current display order. |
| `collections` | `object[]` | Root collections, in their current display order.                  |

---

## PATCH `/connections/v1/move`

**Move connections**

Moves connections atomically. Operations are evaluated in request order against the result of preceding operations.

**Required scope:** `connections, write`

**Request body** (`application/json`):

| Field   | Type       | Required | Description                                            |
| ------- | ---------- | -------- | ------------------------------------------------------ |
| `moves` | `object[]` | Yes      | Moves to evaluate sequentially and persist atomically. |

**Example:**

`PATCH /api/v2/connections/v1/move`

**Request body:**

```json
{
	"moves": [
		{
			"connectionId": "string",
			"collectionId": null,
			"position": 1
		}
	]
}
```

**Successful response** — Connections moved

---

## GET `/connections/v1/{connectionId}`

**Get a connection**

Returns a single connection by ID with its configuration and current status.

**Required scope:** `connections, read`

**Parameters:**

| Parameter         | In    | Type     | Description                                                                     |
| ----------------- | ----- | -------- | ------------------------------------------------------------------------------- |
| `connectionId`    | path  | `string` | Connection instance id, as returned by the list or create connection endpoints. |
| `include_secrets` | query | `string` | Include connection secrets in response                                          |

**Example:**

`GET /api/v2/connections/v1/KJA1isEECHRDBTFjx-7tf`

**Response body:**

```json
{
	"data": {
		"id": "KJA1isEECHRDBTFjx-7tf",
		"label": "ATEM",
		"moduleId": "bmd-atem",
		"moduleVersionId": "1.2.0",
		"updatePolicy": "stable",
		"enabled": true,
		"status": {
			"category": "ok",
			"level": "info",
			"message": "Connected"
		},
		"config": {},
		"secrets": {}
	}
}
```

**Successful response** (`200`) — Connection details

Response body:

| Field                    | Type                           | Description                                                                                                                                                                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | `string`                       | Unique connection instance id.                                                                                                                                                                    |
| `label`                  | `string`                       | Display name shown for the connection in Companion.                                                                                                                                               |
| `moduleId`               | `string`                       | Connection module id, such as "bmd-atem" or "obs-websocket".                                                                                                                                      |
| `moduleVersionId`        | `string \| null`               | Module version id used by this connection, such as "1.2.0". Null means the newest compatible stable version is selected automatically, and may be returned while that version is being installed. |
| `updatePolicy`           | `manual` \| `stable` \| `beta` | Module version update policy for this connection.                                                                                                                                                 |
| `enabled`                | `boolean`                      | Whether the connection is enabled and allowed to run.                                                                                                                                             |
| `status`                 | `object \| null`               | Latest runtime status reported by the connection.                                                                                                                                                 |
| &nbsp;&nbsp;↳ `category` | `string \| null`               | Status category reported by the connection module.                                                                                                                                                |
| &nbsp;&nbsp;↳ `level`    | `string \| null`               | Severity level of the current connection status.                                                                                                                                                  |
| &nbsp;&nbsp;↳ `message`  | `string \| null`               | Human-readable status message from the connection module.                                                                                                                                         |
| `config`                 | `object`                       | Non-secret connection configuration values.                                                                                                                                                       |
| `secrets`                | `object`                       | Secret connection configuration values.                                                                                                                                                           |

---

## PATCH `/connections/v1/{connectionId}`

**Update a connection**

Partially update a connection. Only send the fields you want to change.

**Required scope:** `connections, write`

**Parameters:**

| Parameter      | In   | Type     | Description                                                                     |
| -------------- | ---- | -------- | ------------------------------------------------------------------------------- |
| `connectionId` | path | `string` | Connection instance id, as returned by the list or create connection endpoints. |

**Request body** (`application/json`):

| Field          | Type                           | Required | Description                                                                                                                                               |
| -------------- | ------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`        | `string`                       | No       | New display name for the connection.                                                                                                                      |
| `disabled`     | `boolean`                      | No       | Set true to disable the connection, or false to enable it.                                                                                                |
| `config`       | `object`                       | No       | Non-secret config values to merge into the connection config.                                                                                             |
| `secrets`      | `object`                       | No       | Secret config values to merge into the connection secrets.                                                                                                |
| `updatePolicy` | `manual` \| `stable` \| `beta` | No       | Module version update policy to apply.                                                                                                                    |
| `versionId`    | `string \| null`               | No       | Specific module version to use, such as "1.2.0". Omit to leave the current version unchanged. Use null to switch to the newest compatible stable version. |

**Example:**

`PATCH /api/v2/connections/v1/KJA1isEECHRDBTFjx-7tf`

**Request body:**

```json
{
	"label": "ATEM Program",
	"disabled": false,
	"config": {
		"host": "10.50.0.20",
		"fadeFps": 10
	},
	"secrets": {},
	"updatePolicy": "manual",
	"versionId": "1.2.0"
}
```

**Response body:**

```json
{
	"data": {
		"id": "KJA1isEECHRDBTFjx-7tf",
		"label": "ATEM",
		"moduleId": "bmd-atem",
		"moduleVersionId": "1.2.0",
		"updatePolicy": "stable",
		"enabled": true,
		"status": {
			"category": "ok",
			"level": "info",
			"message": "Connected"
		},
		"config": {},
		"secrets": {}
	}
}
```

**Successful response** (`200`) — Updated connection

Response body:

| Field                    | Type                           | Description                                                                                                                                                                                       |
| ------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                     | `string`                       | Unique connection instance id.                                                                                                                                                                    |
| `label`                  | `string`                       | Display name shown for the connection in Companion.                                                                                                                                               |
| `moduleId`               | `string`                       | Connection module id, such as "bmd-atem" or "obs-websocket".                                                                                                                                      |
| `moduleVersionId`        | `string \| null`               | Module version id used by this connection, such as "1.2.0". Null means the newest compatible stable version is selected automatically, and may be returned while that version is being installed. |
| `updatePolicy`           | `manual` \| `stable` \| `beta` | Module version update policy for this connection.                                                                                                                                                 |
| `enabled`                | `boolean`                      | Whether the connection is enabled and allowed to run.                                                                                                                                             |
| `status`                 | `object \| null`               | Latest runtime status reported by the connection.                                                                                                                                                 |
| &nbsp;&nbsp;↳ `category` | `string \| null`               | Status category reported by the connection module.                                                                                                                                                |
| &nbsp;&nbsp;↳ `level`    | `string \| null`               | Severity level of the current connection status.                                                                                                                                                  |
| &nbsp;&nbsp;↳ `message`  | `string \| null`               | Human-readable status message from the connection module.                                                                                                                                         |
| `config`                 | `object`                       | Non-secret connection configuration values.                                                                                                                                                       |
| `secrets`                | `object`                       | Secret connection configuration values.                                                                                                                                                           |

---

## DELETE `/connections/v1/{connectionId}`

**Delete a connection**

Delete a connection and all its associated configuration.

**Required scope:** `connections, write`

**Parameters:**

| Parameter      | In   | Type     | Description                                                                     |
| -------------- | ---- | -------- | ------------------------------------------------------------------------------- |
| `connectionId` | path | `string` | Connection instance id, as returned by the list or create connection endpoints. |

**Example:**

`DELETE /api/v2/connections/v1/KJA1isEECHRDBTFjx-7tf`

**Successful response** — Connection deleted

---

## GET `/connections/v1/{connectionId}/config-fields`

**Get connection config field definitions**

Returns the config field definitions for a connection module, including field types, constraints, and available options. The connection must be running.

**Required scope:** `connections, read`

**Parameters:**

| Parameter      | In   | Type     | Description                                                                     |
| -------------- | ---- | -------- | ------------------------------------------------------------------------------- |
| `connectionId` | path | `string` | Connection instance id, as returned by the list or create connection endpoints. |

**Example:**

`GET /api/v2/connections/v1/KJA1isEECHRDBTFjx-7tf/config-fields`

**Response body:**

```json
{
	"data": [null]
}
```

**Successful response** (`200`) — Config field definitions

---

## POST `/connections/v1/{connectionId}/restart`

**Restart a connection**

Force-restart the connection process. Fails if the connection is disabled.

**Required scope:** `connections, write`

**Parameters:**

| Parameter      | In   | Type     | Description                                                                     |
| -------------- | ---- | -------- | ------------------------------------------------------------------------------- |
| `connectionId` | path | `string` | Connection instance id, as returned by the list or create connection endpoints. |

**Example:**

`POST /api/v2/connections/v1/KJA1isEECHRDBTFjx-7tf/restart`

**Response body:**

```json
{
	"data": {
		"id": "KJA1isEECHRDBTFjx-7tf",
		"message": "Restart triggered"
	}
}
```

**Successful response** (`200`) — Restart triggered

Response body:

| Field     | Type     | Description                                   |
| --------- | -------- | --------------------------------------------- |
| `id`      | `string` | Connection instance id that was restarted.    |
| `message` | `string` | Confirmation message for the restart request. |

---
