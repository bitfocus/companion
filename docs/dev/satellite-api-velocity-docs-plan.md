# Satellite API docs update plan — rotary velocity / delta

Status: **proposal**. Documents the Satellite-protocol changes made for
[#2511 "Velocity control for rotary actions"](https://github.com/bitfocus/companion/issues/2511) and how the
external protocol reference should be updated to match.

## What changed in core (already implemented)

`companion/lib/Service/Satellite/SatelliteApi.ts`:

- **API version** bumped `1.13.0` → `1.14.0`, with the changelog entry:
  > `1.14.0 - DIRECTION on KEY-ROTATE and SUB-ROTATE may now be a signed number to carry a rotation amount
(velocity/step count): sign is the direction, magnitude is the number of steps. 0 still means a single
counter-clockwise step for backwards compatibility. Support is advertised via ROTARY_AMOUNT in CAPS.`
- The existing **`DIRECTION`** parameter is **widened** rather than adding a second parameter. It is now
  parsed as a signed number by `parseSatelliteRotationDelta`:
  - a finite number → used verbatim, except `0` which stays `-1` (legacy: `0` = counter-clockwise);
  - so `DIRECTION=1` → `+1`, `DIRECTION=0` → `-1`, `DIRECTION=5` → `+5`, `DIRECTION=-3` → `-3`;
  - a non-numeric value falls back to the legacy "truthy means a single clockwise step" behaviour.
- **`CAPS`** advertises `ROTARY_AMOUNT=1` so clients can detect that the server honours magnitudes in
  `DIRECTION` (an older server treats `DIRECTION=5` as a single clockwise step, so sending a magnitude
  degrades gracefully — still the right direction, just one step).

The delta flows into `doRotate` / `doRotateFromId` / `rotateControl` and, through core, becomes the
`$(this:delta)` expression variable available while a rotary action runs.

## Where the protocol reference lives

The authoritative Satellite protocol reference is **hosted externally**, not in this repo. The in-repo user
guide (`docs/user-guide/5_remote-control/satellite.md`) only links to it:

> `https://companion.free/for-developers/Satellite-API`

So this plan targets **that external reference** plus the in-repo changelog comment (already updated in
`SatelliteApi.ts`). No `docs/user-guide` page currently enumerates the rotate commands, so none needs
editing for correctness — but see "Optional" below.

## Edits required in the external Satellite API reference

1. **Version table / changelog**: add `1.14.0` with the same wording as the `SatelliteApi.ts` header block.

2. **CAPS section**: document the new flag.

   | Field           | Value | Meaning                                                                        |
   | --------------- | ----- | ------------------------------------------------------------------------------ |
   | `ROTARY_AMOUNT` | `1`   | Server honours a signed magnitude in `DIRECTION` on `KEY-ROTATE`/`SUB-ROTATE`. |

3. **`KEY-ROTATE`** / **`SUB-ROTATE`**: redefine `DIRECTION` from a boolean to a signed number.

   | Value      | Meaning                                                  |
   | ---------- | -------------------------------------------------------- |
   | `1`        | One clockwise step (unchanged).                          |
   | `0`        | One counter-clockwise step (unchanged, kept for compat). |
   | `n` (`>0`) | `n` clockwise steps.                                     |
   | `-n`       | `n` counter-clockwise steps.                             |

   `DIRECTION` remains **required** on both messages.

4. **Compatibility note**: "`DIRECTION=0`/`1` behave exactly as before. Sending a larger magnitude to a
   pre-1.14.0 server is safe: it is interpreted as a single step in the same direction. Only rely on the
   magnitude after observing `ROTARY_AMOUNT=1` in `CAPS`."

## Example wire lines

```
# Legacy (still valid): one step per event
KEY-ROTATE DEVICEID="dev1" KEY=3 DIRECTION=1
KEY-ROTATE DEVICEID="dev1" KEY=0 DIRECTION=0

# 1.14.0: coarse step of 5 clockwise
KEY-ROTATE DEVICEID="dev1" KEY=3 DIRECTION=5

# 1.14.0: 4 counter-clockwise steps via a subscription
SUB-ROTATE SUBID="sub1" DIRECTION=-4
```

## Optional in-repo doc touch-up

If desired, add a short note to `docs/user-guide/5_remote-control/satellite.md` that satellite clients can
send a signed `DIRECTION` magnitude (≥ API 1.14.0) which surfaces to expressions as `$(this:delta)`. Keep
the full command table in the external reference to avoid duplication.

## Verification

Covered by `companion/test/Service/Satellite/SatelliteApi.test.ts`:

- `KEY-ROTATE ... DIRECTION=5` → `doRotate(..., 5)`.
- `KEY-ROTATE ... DIRECTION=-3` → `doRotate(..., -3)`.
- `KEY-ROTATE ... DIRECTION=0` → `doRotate(..., -1)` and `DIRECTION=1` → `doRotate(..., 1)` (unchanged).
- `SUB-ROTATE ... DIRECTION=-4` → `rotateControl(..., -4, ...)`.
