# Plan: adopt `@companion-app/satellite-protocol` in the Stream Deck plugin

Repository: [bitfocus/io.bitfocus.companion-plugin](https://github.com/bitfocus/io.bitfocus.companion-plugin).
File references are against `main`; re-check them before starting. Nearly all the work is in
`src/satellite/client.ts`.

## Context

The plugin implements the Satellite protocol client itself. Its comments say the parser and serialiser
are "battle-tested from companion-satellite", but they are separate, simpler implementations that differ
from Companion's:

- **Parser** (`parseLineParameters`, bottom of `client.ts`):
  - It ignores `\` escapes.
  - It only treats a quote at the start of a value as quoting, and an unterminated quote swallows the
    rest of the line.
  - A parameter without a value merges into the next one: `FLAG A=1` gives a key `"FLAG A"`.
  - It writes into a plain `{}`, so it has no prototype pollution guard.
- **Serialiser** (`#sendMessage`):
  - It only quotes a value containing a space, and never escapes.
  - `DEVICEID` is `elgato-plugin:<suffix>`, and the suffix can be edited in the plugin's settings. A `"`
    there corrupts every message the plugin sends.
- **Version and CAPS gating** uses `semver.satisfies` plus hand parsing of `SUBSCRIPTIONS` and
  `BITMAP_FORMATS`.
- **Rotation** sends one `KEY-ROTATE`/`SUB-ROTATE` per tick, with `DIRECTION=1/0`.

## Steps

1. **Add the dependency** to `package.json`: `"@companion-app/satellite-protocol": "^0.1.0"`. Import only
   from `@companion-app/satellite-protocol/codec`, `/versions` and `/constants`, never `/schemas`, so zod
   stays out of `bin/plugin.js`.
   - The plugin's `moduleResolution: Bundler` and rollup's node-resolve both resolve the package's
     `exports` to its compiled `dist`, which is ES2022 ESM, matching the plugin's target.
   - The package is marked side-effect free, so even an import from the root entry point drops zod
     when tree-shaken.

2. **Framing and parsing.** Delete the local `parseLineParameters`. Replace `#receivedBuffer` and
   `#handleReceivedData`:

   ```ts
   #lineBuffer = new SatelliteLineBuffer(MAX_LINE_LENGTH)

   #handleReceivedData(data: string): void {
   	const { lines, overflow } = this.#lineBuffer.push(data)
   	for (const line of lines) {
   		if (line.length > 0) this.#handleLine(line)
   	}
   	if (overflow) this.#client?.destroy()
   }
   ```

   - In `#handleLine`, use `splitSatelliteCommand(line)` and `parseLineParameters(body)`.
   - Reset the buffer with `this.#lineBuffer.clear()` where `#initSocket` resets `#receivedBuffer`.
   - The existing `trim()` was compensating for Companion's trailing space before the newline. The
     package parser ignores it, so drop the `trim()`.

3. **Parameter types.**
   - Params become `ParsedParams` (`string | true | undefined`) instead of `Record<string, string>`.
   - In `#handleBegin`, `#handleCaps`, `#handleState` and `#handleSubState`, read string values with a
     `typeof x === 'string'` guard. Most already compare to `null`/`undefined`.
   - Rewrite `#handleAddSubResponse` to use the parsed params directly:
     `if (params.ERROR === true) { … params.SUBID, params.MESSAGE … }`. The status word parses as a
     parameter without a value, so it no longer needs slicing out of the body.

4. **Serialiser.**
   - Replace the body of `#sendMessage` with `this.#client.write(formatSatelliteMessage(command, null, null, params))`, and type `params` as `SatelliteMessageArgs`.
   - At the call sites, send real types instead of strings:
     - `PRESSED: true/false` instead of `'true'/'false'`
     - `KEY: n` and `KEYS_TOTAL: n` instead of `String(n)`
   - Companion accepts both forms, but the typed values are what Companion and companion-satellite send.
   - Strings are always quoted and escaped, which fixes the `DEVICEID` corruption.
   - `formatSatelliteMessage` throws on a newline in a value; no value here can contain one.
   - Keep sending `DEVICEID` as a parameter as today; passing it as the `deviceId` argument also works.

5. **Version and CAPS gating.**
   - Replace `semverSatisfies(apiVersion, '>=1.10.0', …)` with
     `isApiVersionAtLeast(apiVersion, MINIMUM_PROTOCOL_VERSION)`.
   - Keep the result of `getSatelliteFeatures(apiVersion, null)` from `BEGIN`, and recompute it with the
     CAPS params in `#handleCaps`:
     - `#subscriptionsSupported` becomes `features.subscriptions`
     - `BITMAP_FORMATS` list parsing stays as is (it negotiates, it doesn't gate)
   - Remove `semver` and `@types/semver` from `package.json`.

6. **Rotation.** In `rotate()`, when `features.rotaryAmount` is true (Companion with API 1.14+ and
   `ROTARY_AMOUNT` in CAPS), send a single message with `DIRECTION: ticks` (signed). Otherwise keep the
   current loop of single steps. Companion clamps the step count to ±100.

7. **Comments.** Remove the "battle-tested from companion-satellite" comments on the parser and serialiser.

## Behaviour changes to check

- Messages now end `" \n"` and quote every string value. Companion has always accepted this.
- A server sending more than 2MB without a newline now drops the connection.
- Encoder turns arrive as one message with a step count, on Companion versions that support it.

## Verification

- `yarn check-types`, `yarn lint`, `yarn build`
- Confirm zod is not in the bundle: `grep -c ZodObject io.bitfocus.companion-plugin.sdPlugin/bin/plugin.js` gives 0
- Manually, in Stream Deck:
  - Connect over TCP and WebSocket to a current Companion, with button subscriptions enabled and disabled
  - Check static-page and dynamic-page buttons draw and press
  - Turn an encoder several ticks quickly and check Companion receives one rotation with that amount
  - Set a device id suffix containing a space or `"`, and check the device registers
  - Connect to a Companion older than API 1.10 and check the "wrong version" state is shown
