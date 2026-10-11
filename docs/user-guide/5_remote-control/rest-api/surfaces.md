---
title: Surfaces
sidebar_position: 2
description: REST API endpoints for Surfaces
---

# Surfaces

## GET `/surfaces/v1`

**List all surfaces**

Returns all known surfaces, connected or not, with their current state.

**Required scope:** `read`

**Example:**

`GET /api/v2/surfaces/v1`

**Response body:**

```json
{
	"data": [
		{
			"id": "streamdeck:1A2B3C4D",
			"type": "Elgato Stream Deck XL",
			"integrationType": "elgato-stream-deck",
			"name": "Front of house",
			"displayName": "Front of house (streamdeck:1A2B3C4D)",
			"isConnected": true,
			"size": {
				"rows": 4,
				"columns": 8
			},
			"brightness": 80,
			"page": {
				"id": "ggmHXCUQ0RRXUwEr8HHtQ",
				"number": 1,
				"name": "Main"
			},
			"groupId": "streamdeck:1A2B3C4D"
		}
	],
	"meta": {
		"total": 1,
		"limit": 100,
		"offset": 0
	}
}
```

**Successful response** (`200`) — List of surfaces

Response body (collection):

| Field                   | Type             | Description                                                                                                              |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                    | `string`         | Unique surface id.                                                                                                       |
| `type`                  | `string`         | Model of the surface, as reported by the integration.                                                                    |
| `integrationType`       | `string`         | Integration the surface is connected through.                                                                            |
| `name`                  | `string`         | Name given to the surface in Companion.                                                                                  |
| `displayName`           | `string`         | Name shown for the surface in the Companion UI.                                                                          |
| `isConnected`           | `boolean`        | Whether the surface is currently connected.                                                                              |
| `size`                  | `object \| null` | Button grid size of the surface, if known.                                                                               |
| &nbsp;&nbsp;↳ `rows`    | `number`         | Number of button rows on the surface.                                                                                    |
| &nbsp;&nbsp;↳ `columns` | `number`         | Number of button columns on the surface.                                                                                 |
| `brightness`            | `number \| null` | Brightness of the surface in percent, or null if it is not set in the surface config.                                    |
| `page`                  | `object \| null` | Page the surface is currently showing, or null if it is not showing one.                                                 |
| &nbsp;&nbsp;↳ `id`      | `string`         | Unique page id.                                                                                                          |
| &nbsp;&nbsp;↳ `number`  | `number \| null` | Position of the page in the page list, or null if the page is no longer in the list.                                     |
| &nbsp;&nbsp;↳ `name`    | `string \| null` | Display name of the page.                                                                                                |
| `groupId`               | `string`         | Id of the surface group the surface belongs to. Note: if not part of a group, this will typically be the same as the id. |

---

## GET `/surfaces/v1/{surfaceId}`

**Get a surface**

Returns a single surface by id, connected or not, with its current state.

**Required scope:** `read`

**Parameters:**

| Parameter   | In   | Type     | Description                                            |
| ----------- | ---- | -------- | ------------------------------------------------------ |
| `surfaceId` | path | `string` | Surface id, as returned by the list surfaces endpoint. |

**Example:**

`GET /api/v2/surfaces/v1/streamdeck:1A2B3C4D`

**Response body:**

```json
{
	"data": {
		"id": "streamdeck:1A2B3C4D",
		"type": "Elgato Stream Deck XL",
		"integrationType": "elgato-stream-deck",
		"name": "Front of house",
		"displayName": "Front of house (streamdeck:1A2B3C4D)",
		"isConnected": true,
		"size": {
			"rows": 4,
			"columns": 8
		},
		"brightness": 80,
		"page": {
			"id": "ggmHXCUQ0RRXUwEr8HHtQ",
			"number": 1,
			"name": "Main"
		},
		"groupId": "streamdeck:1A2B3C4D"
	}
}
```

**Successful response** (`200`) — The requested surface

Response body:

| Field                   | Type             | Description                                                                                                              |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                    | `string`         | Unique surface id.                                                                                                       |
| `type`                  | `string`         | Model of the surface, as reported by the integration.                                                                    |
| `integrationType`       | `string`         | Integration the surface is connected through.                                                                            |
| `name`                  | `string`         | Name given to the surface in Companion.                                                                                  |
| `displayName`           | `string`         | Name shown for the surface in the Companion UI.                                                                          |
| `isConnected`           | `boolean`        | Whether the surface is currently connected.                                                                              |
| `size`                  | `object \| null` | Button grid size of the surface, if known.                                                                               |
| &nbsp;&nbsp;↳ `rows`    | `number`         | Number of button rows on the surface.                                                                                    |
| &nbsp;&nbsp;↳ `columns` | `number`         | Number of button columns on the surface.                                                                                 |
| `brightness`            | `number \| null` | Brightness of the surface in percent, or null if it is not set in the surface config.                                    |
| `page`                  | `object \| null` | Page the surface is currently showing, or null if it is not showing one.                                                 |
| &nbsp;&nbsp;↳ `id`      | `string`         | Unique page id.                                                                                                          |
| &nbsp;&nbsp;↳ `number`  | `number \| null` | Position of the page in the page list, or null if the page is no longer in the list.                                     |
| &nbsp;&nbsp;↳ `name`    | `string \| null` | Display name of the page.                                                                                                |
| `groupId`               | `string`         | Id of the surface group the surface belongs to. Note: if not part of a group, this will typically be the same as the id. |

---

## PATCH `/surfaces/v1/{surfaceId}`

**Update a surface**

Update a connected surface. Currently only the brightness can be changed.

**Required scope:** `write`

**Parameters:**

| Parameter   | In   | Type     | Description                                            |
| ----------- | ---- | -------- | ------------------------------------------------------ |
| `surfaceId` | path | `string` | Surface id, as returned by the list surfaces endpoint. |

**Request body** (`application/json`):

| Field        | Type      | Required | Description                                     |
| ------------ | --------- | -------- | ----------------------------------------------- |
| `brightness` | `integer` | Yes      | Brightness to apply to the surface, in percent. |

**Example:**

`PATCH /api/v2/surfaces/v1/streamdeck:1A2B3C4D`

**Request body:**

```json
{
	"brightness": 50
}
```

**Response body:**

```json
{
	"data": {
		"id": "streamdeck:1A2B3C4D",
		"type": "Elgato Stream Deck XL",
		"integrationType": "elgato-stream-deck",
		"name": "Front of house",
		"displayName": "Front of house (streamdeck:1A2B3C4D)",
		"isConnected": true,
		"size": {
			"rows": 4,
			"columns": 8
		},
		"brightness": 80,
		"page": {
			"id": "ggmHXCUQ0RRXUwEr8HHtQ",
			"number": 1,
			"name": "Main"
		},
		"groupId": "streamdeck:1A2B3C4D"
	}
}
```

**Successful response** (`200`) — Updated surface

Response body:

| Field                   | Type             | Description                                                                                                              |
| ----------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `id`                    | `string`         | Unique surface id.                                                                                                       |
| `type`                  | `string`         | Model of the surface, as reported by the integration.                                                                    |
| `integrationType`       | `string`         | Integration the surface is connected through.                                                                            |
| `name`                  | `string`         | Name given to the surface in Companion.                                                                                  |
| `displayName`           | `string`         | Name shown for the surface in the Companion UI.                                                                          |
| `isConnected`           | `boolean`        | Whether the surface is currently connected.                                                                              |
| `size`                  | `object \| null` | Button grid size of the surface, if known.                                                                               |
| &nbsp;&nbsp;↳ `rows`    | `number`         | Number of button rows on the surface.                                                                                    |
| &nbsp;&nbsp;↳ `columns` | `number`         | Number of button columns on the surface.                                                                                 |
| `brightness`            | `number \| null` | Brightness of the surface in percent, or null if it is not set in the surface config.                                    |
| `page`                  | `object \| null` | Page the surface is currently showing, or null if it is not showing one.                                                 |
| &nbsp;&nbsp;↳ `id`      | `string`         | Unique page id.                                                                                                          |
| &nbsp;&nbsp;↳ `number`  | `number \| null` | Position of the page in the page list, or null if the page is no longer in the list.                                     |
| &nbsp;&nbsp;↳ `name`    | `string \| null` | Display name of the page.                                                                                                |
| `groupId`               | `string`         | Id of the surface group the surface belongs to. Note: if not part of a group, this will typically be the same as the id. |

---
