# Surface API update plan — rotary velocity / delta

Status: **proposal**. Tracks the surface-side follow-up to
[#2511 "Velocity control for rotary actions"](https://github.com/bitfocus/companion/issues/2511).

## Background

Rotary actions can now read the signed rotation amount of the current turn via the `$(this:delta)`
expression variable. Inside core, the amount is threaded from the surface all the way to action execution:

- `SurfacePanelEvents.rotate` (`companion/lib/Surface/Types.ts`) now carries `delta: number` (signed —
  sign is the direction, magnitude is the number of steps) instead of `rightward: boolean`.
- The whole `rotateControl(...)` chain (`ServiceApi` → `ControlStore` → `Controls/Controller` →
  `ButtonControl.rotateControl`) now takes `delta: number`; the action-set (`rotate_left`/`rotate_right`)
  is still chosen from `delta > 0`.
- `RunActionExtras.rotationDelta` (`companion/lib/Instance/Connection/ChildHandlerApi.ts`) carries the
  value to `buildActionExecutionOverrides`, which exposes it as `this:delta`.

The remaining question is the **surface plugin API** (`@companion-surface/host`) — the out-of-process
contract implemented by hardware surface plugins (Stream Deck, Loupedeck, etc.). This must change in a
**backward-compatible** way, because those plugins are published/versioned independently of core.

## Current state of the plugin API

The plugin API **already carries a numeric delta** — no core-visible field is missing today:

```ts
// node_modules/@companion-surface/host/dist/context.d.ts
export interface HostSurfaceEvents {
	readonly inputPress: (surfaceId: string, controlId: string, pressed: boolean) => void
	readonly inputRotate: (surfaceId: string, controlId: string, delta: number) => void
	// ...
}
```

- `companion/lib/Instance/Surface/IpcTypes.ts` → `InputRotateMessage.delta: number`
  (comment: _"should be -1 or 1, but others should be handled sensibly"_).
- `companion/lib/Instance/Surface/Thread/HostContext.ts` forwards `delta` over IPC.
- `companion/lib/Instance/Surface/ChildHandler.ts` routes it to `PluginPanel.inputRotate(controlId, delta)`.

Historically core threw the magnitude away at `companion/lib/Surface/PluginPanel.ts` (`this.emit('rotate',
col, row, delta > 0)`). **That collapse is now removed** — `PluginPanel` emits the raw `delta`. So for the
common case (a plugin already emitting `±1`), `$(this:delta)` works immediately with no plugin change; a
plugin that wants coarse/velocity steps can start emitting larger magnitudes.

## Options for the backward-compatible API change

The maintainer flagged two shapes. Both are compatible; the recommendation is Option 1.

### Option 1 — Formalise the existing `delta` semantics (recommended)

Keep the single `inputRotate(surfaceId, controlId, delta)` method and **document `delta` as a signed step
count**:

- `delta` sign = direction, magnitude = number of steps for this event.
- Existing plugins keep emitting `±1` per detent → identical behaviour.
- Velocity-aware plugins may emit larger magnitudes (e.g. accumulate detents seen within a short window,
  or map an encoder's reported acceleration onto the magnitude).

Why recommended:

- **Zero new surface area.** The type is unchanged, so every existing plugin keeps compiling and running.
- Matches how core already consumes the value.
- Only requires a **documentation + semver note** in `@companion-surface/host` (a minor version that
  clarifies the contract), plus optional guidance for plugin authors.

Risks / notes:

- A plugin that emits an unexpectedly large magnitude will move a value further than a user expects. This
  is acceptable because it only happens if the plugin opts in, and users compose the scaling in their
  `$(this:delta)` expression anyway.
- Guard against `0` / non-finite deltas in core (already handled: the Satellite parser rejects `0`, and
  set-selection treats `delta > 0` as rightward — document that `delta` must be non-zero).

### Option 2 — Add a new method and deprecate the old one

Introduce a richer event and deprecate `inputRotate`:

```ts
readonly inputRotate2: (
    surfaceId: string,
    controlId: string,
    delta: number,
    meta?: { velocity?: number; timestampMs?: number },
) => void
// inputRotate stays, marked @deprecated, internally adapting to inputRotate2
```

Only worth it if surfaces need to report **more than a signed delta** — e.g. a separately measured angular
velocity, or a timestamp so core can compute velocity itself. Costs:

- Two code paths to maintain in the host package and in core's `ChildHandler`/`HostContext`.
- A deprecation window and migration for every plugin.

Recommendation: **defer Option 2** until a concrete surface needs the extra fields. `delta` as a signed
step count covers issue #2511.

## Proposed work items (surface plugin API)

1. In `@companion-surface/host`: document `inputRotate`'s `delta` as a signed step count (sign = direction,
   magnitude = steps, non-zero), and bump the package minor version with a changelog note.
2. Optional plugin-author guidance: how to derive a velocity-scaled `delta` (window accumulation or
   hardware acceleration), with a note that Companion exposes it verbatim as `$(this:delta)`.
3. Core follow-up (already landed for this issue): `PluginPanel.inputRotate` forwards the raw `delta`;
   `InputRotateMessage.delta` comment stays accurate.
4. If/when Option 2 is chosen: add `inputRotate2` + adapter, deprecate `inputRotate`, thread the extra
   metadata through `HostContext`/`ChildHandler` and (if a `velocity` field is added) a new
   `RunActionExtras` field + `this:` variable.

## Verification

- A plugin emitting `±1` behaves exactly as before; `$(this:delta)` resolves to `1`/`-1` on a rotary action.
- A plugin emitting a larger magnitude moves a `$(this:delta)`-based expression proportionally.
- Non-rotary executions (press, trigger) leave `$(this:delta)` unset.
