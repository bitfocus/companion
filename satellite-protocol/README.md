# @companion-app/satellite-protocol

Definitions of the [Bitfocus Companion](https://github.com/bitfocus/companion) Satellite API wire
protocol, shared by Companion and its clients such as
[companion-satellite](https://github.com/bitfocus/companion-satellite).

It depends only on `zod`, and uses no node built-ins, so it can be used from node, browsers and bundlers.

## Contents

Each part is also available as its own entry point, so a client that doesn't need the schemas doesn't
bundle zod (the package is side-effect free, so bundlers drop it from the root import too).

- **`/codec`**: `parseLineParameters`, `formatSatelliteMessage`, `splitSatelliteCommand`,
  `SatelliteLineBuffer` (splits received data into lines and guards against unbounded lines),
  `isTruthy`/`isFalsey`, `parseSatelliteBitmapFormat`
- **`/constants`**: `API_VERSION`, line and grid limits, `SATELLITE_BITMAP_FORMATS`
- **`/versions`**: `SATELLITE_FEATURES`, `getSatelliteFeatures(apiVersion, caps)`, `isApiVersionAtLeast`,
  `compareApiVersions`. An API version says whether a feature _exists_; a CAPS flag says whether it is
  _enabled_ on this connection.
- **`/schemas`**: `SatelliteSurfaceLayoutSchema`, `SatelliteConfigFieldsSchema` and
  `SatelliteSurfaceAppearanceSchema` (zod), with inferred types

```ts
import {
	formatSatelliteMessage,
	parseLineParameters,
	SatelliteLineBuffer,
	splitSatelliteCommand,
} from '@companion-app/satellite-protocol/codec'
import { MAX_LINE_LENGTH } from '@companion-app/satellite-protocol/constants'

const buffer = new SatelliteLineBuffer(MAX_LINE_LENGTH)
socket.on('data', (data) => {
	const { lines, overflow } = buffer.push(data.toString())
	for (const line of lines) {
		const { command, body } = splitSatelliteCommand(line)
		const params = parseLineParameters(body)
		// ...
	}
	if (overflow) socket.destroy()
})

socket.write(formatSatelliteMessage('KEY-PRESS', null, deviceId, { KEY: 3, PRESSED: true }))
```

Responses carry their status as a parameter without a value, so `ADD-SUB ERROR SUBID="1" MESSAGE="…"`
parses to `{ ERROR: true, SUBID: '1', MESSAGE: '…' }`.

## Assets (for clients in other languages)

- `assets/satellite-surface.schema.json`, `assets/satellite-config-fields.schema.json`,
  `assets/satellite-surface-appearance.schema.json`: JSON schemas for `LAYOUT_MANIFEST`, `CONFIG_FIELDS` and the
  `APPEARANCE` of `DEVICE-APPEARANCE`
- `assets/satellite-api-features.json`: the feature table
- `assets/satellite-protocol-corpus.json`: conformance cases for parsing and formatting lines. Any
  implementation of the protocol can load this and check it agrees.

## Versioning

The package version is independent of the API version it implements. `API_VERSION` is exported.
