# Satellite API docs update plan — rotary velocity / delta

Status: **proposal**. Documents the Satellite-protocol changes made for
[#2511 "Velocity control for rotary actions"](https://github.com/bitfocus/companion/issues/2511) and how the
external protocol reference should be updated to match.

## What changed in core (already implemented)

`companion/lib/Service/Satellite/SatelliteApi.ts`:

- **API version** bumped `1.13.0` → `1.14.0`, with the changelog entry:
  > `1.14.0 - Add optional AMOUNT parameter to KEY-ROTATE and SUB-ROTATE to carry a signed rotation amount
(velocity/step count). Advertised via ROTARY_AMOUNT in CAPS. When omitted, DIRECTION is used as before
(±1), so existing clients are unaffected.`
- **`CAPS`** now advertises `ROTARY_AMOUNT=1` so clients can detect support during the handshake.
- **`KEY-ROTATE`** and **`SUB-ROTATE`** accept a new optional `AMOUNT` parameter (a signed number). The
  effective delta is resolved by `parseSatelliteRotationDelta`:
  - if `AMOUNT` is a finite, non-zero number → use it verbatim;
  - otherwise fall back to `DIRECTION` (`1` → `+1`, `0` → `-1`).
- `DIRECTION` is still **required** on both messages (unchanged), so old clients see identical behaviour.

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

   | Field           | Value | Meaning                                                                      |
   | --------------- | ----- | ---------------------------------------------------------------------------- |
   | `ROTARY_AMOUNT` | `1`   | Server accepts the optional `AMOUNT` parameter on `KEY-ROTATE`/`SUB-ROTATE`. |

3. **`KEY-ROTATE`**: add the `AMOUNT` parameter.

   | Parameter           | Required      | Description                                                                                                                                                  |
   | ------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
   | `DEVICEID`          | yes           | Device id.                                                                                                                                                   |
   | `KEY` / `CONTROLID` | yes           | Legacy grid key, or control id in manifest mode.                                                                                                             |
   | `DIRECTION`         | yes           | `1` = clockwise/rightward, `0` = counter-clockwise/leftward.                                                                                                 |
   | `AMOUNT`            | no (≥ 1.14.0) | Signed rotation amount. Sign overrides `DIRECTION`; magnitude = number of steps. Non-zero finite numbers only; invalid/zero values fall back to `DIRECTION`. |

4. **`SUB-ROTATE`**: add the same `AMOUNT` row (`SUBID`, `DIRECTION` required; `AMOUNT` optional, same
   semantics).

5. **Compatibility note**: "Omitting `AMOUNT` reproduces pre-1.14.0 behaviour exactly (`DIRECTION` → ±1).
   Only send `AMOUNT` after observing `ROTARY_AMOUNT=1` in `CAPS`."

## Example wire lines

```
# Legacy / pre-1.14.0 (still valid): one step per event
KEY-ROTATE DEVICEID="dev1" KEY=3 DIRECTION=1

# 1.14.0: coarse step of 5 to the right
KEY-ROTATE DEVICEID="dev1" KEY=3 DIRECTION=1 AMOUNT=5

# 1.14.0: fine step of 4 to the left via a subscription
SUB-ROTATE SUBID="sub1" DIRECTION=0 AMOUNT=-4
```

## Optional in-repo doc touch-up

If desired, add a short note to `docs/user-guide/5_remote-control/satellite.md` that satellite clients can
send a rotation `AMOUNT` (≥ API 1.14.0) which surfaces to expressions as `$(this:delta)`. Keep the full
command table in the external reference to avoid duplication.

## Verification

Covered by `companion/test/Service/Satellite/SatelliteApi.test.ts`:

- `KEY-ROTATE ... AMOUNT=5` → `doRotate(..., 5)`.
- `KEY-ROTATE ... DIRECTION=0 AMOUNT=notanumber` → falls back to `doRotate(..., -1)`.
- `SUB-ROTATE ... DIRECTION=0 AMOUNT=-4` → `rotateControl(..., -4, ...)`.
- Existing `DIRECTION`-only cases still resolve to `±1`.
