# Companion Link

Companion Link connects Companion installations together, so that a button on one can show and press a button on
another (a **Remote button**). It replaces the deprecated Bitfocus Cloud with a bring-your-own-infrastructure
approach: the installations talk over one or more **transports** (an MQTT broker, direct connections, …) that the
user sets up, and nothing needs to be hosted by the Companion project.

To add a new transport, see [Transports/README.md](./Transports/README.md).

## Architecture

```
          ┌──────────── LinkController (Controller.ts) ─────────────┐
          │  announcements, message dispatch, tRPC api for the UI    │
          │                                                          │
 Remote   │  LinkButtonClient ──┐               ┌── LinkButtonServer │  graphics/
 buttons ─┼─▶ (ButtonClient.ts) │               │ (ButtonServer.ts) ◀┼─ button_drawn,
 (control)│                     ▼               ▼                    │  presses
          │                LinkPeerRegistry   LinkTransportManager   │
          │                (PeerRegistry.ts)  (TransportManager.ts)  │
          └───────────────────────────────────────┬──────────────────┘
                                                  │ publish / subscribe on topics
                                    ┌─────────────┼──────────────┐
                                  Mqtt/       Direct/        (your transport)
```

- **LinkTransportManager** owns the configured transports: persisting them, running the enabled ones, and fanning
  publishes and subscriptions out to them. It knows nothing about the protocol.
- **LinkPeerRegistry** tracks the installations discovered through announcements, and which transports each is
  reachable on.
- **LinkButtonServer** serves this installation's buttons: it tracks what peers have subscribed to, publishes renders
  when those buttons change, and performs the presses peers send.
- **LinkButtonClient** is the other side: it subscribes to the remote buttons shown by Remote buttons
  (`Controls/ControlTypes/Button/Link.ts`), keeps those subscriptions alive, and forwards presses.
- **Protocol/** defines the wire protocol: the message schemas, the topics and the version/feature table.

## Protocol

The protocol is publish/subscribe over MQTT style topics, with JSON messages. It is defined with zod in
[Protocol/Schemas.ts](./Protocol/Schemas.ts); `yarn build:link-schema` generates
[`assets/link-protocol.schema.json`](../../../assets/link-protocol.schema.json) and
[`assets/link-protocol-features.json`](../../../assets/link-protocol-features.json) from it for other
implementations (CI checks they are up to date).

Every message has the envelope `{ version: 1, type, payload }`.

| Topic                                                   | Message         | Notes                                                   |
| ------------------------------------------------------- | --------------- | ------------------------------------------------------- |
| `companion-link/discovery/{id}`                         | `announcement`  | Retained, repeated every 15s. Empty payload = goodbye   |
| `companion-link/{id}/inbox`                             | `subscribe`     | Ask `{id}` to publish some buttons (a lease, see below) |
|                                                         | `unsubscribe`   | Release a lease early                                   |
|                                                         | `button.press`  | Press or release a button of `{id}`                     |
|                                                         | `button.rotate` | Rotate an encoder button of `{id}`                      |
| `companion-link/{id}/button/{page}/{row}/{col}/{w}x{h}` | `button.update` | The render of a button of `{id}`, at a size             |

### Discovery

Each installation publishes a retained announcement on every transport, and repeats it every 15 seconds. It
carries the name, Companion version, protocol version, page count and grid size. A peer is unreachable on a
transport after missing 3 announcements, when it says goodbye (an empty retained announcement, sent when a transport
or Companion stops), or when its last will fires.

### Button subscriptions

Subscribing to a remote button is a **lease**: the subscriber sends `subscribe` to the peer's inbox, then repeats it
every 20 seconds; the peer stops publishing a button 60 seconds after the last renewal. This means nothing leaks when
a subscriber disappears without unsubscribing. The subscriber also subscribes (at the transport level) to the
button's update topic, which is unique per location and size, so a broker only delivers what is wanted and several
subscribers of the same button share the updates.

`subscribe` has `sendCurrent`: set when (re)subscribing, so the current render is published straight away; clear for
renewals, to avoid resending unchanged images.

Subscriptions are sent on every transport the peer is reachable on, so updates keep flowing if one fails. Presses are
only sent on one transport, so they are not performed twice.

### Loops

A Remote button can show a button that is itself a Remote button. `button.update` carries a `sourceChain` of the
installations the image passed through; a subscriber that finds itself in the chain shows a loop placeholder instead
of feeding it back. Presses are forwarded with the surface id extended at each hop (as for button references), and
dropped after too many hops.

### Versioning

The protocol version is a semver string ([Protocol/Versions.ts](./Protocol/Versions.ts)) carried in the
announcement:

- Peers with a different **major** version are listed in the UI as incompatible, and nothing is sent to them. The
  announcement itself must stay readable by every version: only ever add optional fields to it.
- A **minor** version adds a feature, listed in `LINK_FEATURES` with the version it appeared in. A feature is only
  used towards a peer that announced a version that has it (`getLinkPeerFeatures`). Unknown properties are ignored by
  the schemas, so adding optional fields is safe.

## Security

The protocol has no authentication or encryption of its own: anyone who can publish to an installation's inbox can
press its buttons. Securing who can connect is the job of the transports: broker credentials and TLS for MQTT, and for direct
connections Noise encryption with an explicit pairing step (see [Transports/README.md](./Transports/README.md)).

## Not done yet

- Remote buttons request a fixed bitmap size (144px). They should request the sizes the surfaces showing them need.
- Sharing variables between installations, and using connections of another installation.
- Choosing which transport to prefer for a peer (eg by latency), rather than the most recently heard from.
- Access control: limiting what each peer or transport may do (eg read only).
