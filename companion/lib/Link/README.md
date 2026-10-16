# Companion Link

Companion Link connects Companion installations together, so that a button on one can show and press a button on
another (a **Remote button**). It replaces the deprecated Bitfocus Cloud with a bring-your-own-infrastructure
approach: the installations talk over one or more **transports** (direct connections, an MQTT broker, …) that the
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
                                 Direct/      (your transport)
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

The protocol is publish/subscribe over MQTT style topics, with JSON messages, defined with zod in two parts:

- discovery ([Protocol/Announcement.ts](./Protocol/Announcement.ts)): the announcement, and the discovery topics. The
  same for every major version, as it is how installations find out which one to use
- the messages of each major version, on topics under that version (v1: [Protocol/v1/](./Protocol/v1/)). Each is
  `{ type, payload }`: the version isn't in the message, as the topic says it

| Topic                                                      | Message         | Notes                                                   |
| ---------------------------------------------------------- | --------------- | ------------------------------------------------------- |
| `discovery/{id}`                                           | `announcement`  | Retained, repeated every 15s. Empty payload = goodbye   |
| `v1/peers/{id}/inbox`                                      | `access`        | What the sender lets `{id}` use (see Permissions)       |
|                                                            | `subscribe`     | Ask `{id}` to publish some buttons (a lease, see below) |
|                                                            | `unsubscribe`   | Release a lease early                                   |
|                                                            | `button.press`  | Press or release a button of `{id}`                     |
|                                                            | `button.rotate` | Rotate an encoder button of `{id}`                      |
|                                                            | `ping`          | Asks `{id}` for a `pong`, to measure the round trip     |
|                                                            | `pong`          | The reply to a `ping`, over the transport it came on    |
| `v1/peers/{id}/button/location/{page}/{row}/{col}/{w}x{h}` | `button.update` | The render of a button of `{id}`, at a size             |

Messages refer to a button with a tagged reference (`{ type: 'location', page, row, column }`), so that other ways of
referring to one can be added as new `type`s; the update topic starts with the type too.

Messages don't say who sent them. The transport reports that with each message (`origin.peerId`), as it is what
knows, or can prove, who is at the other end. The core only accepts an announcement on the discovery topic of its
sender, and button updates on the sender's own topics.

Topics are relative to Link: a transport on a backend shared with other things puts them under a prefix of its own
(eg the MQTT transport's topic prefix).

### Discovery

Each installation publishes a retained announcement on every transport, and repeats it every 15 seconds. It
carries the name, Companion version and protocol versions, and nothing more, as anyone who can see the discovery
topics can read it, including installations that aren't allowed to use this one. A peer is unreachable on a
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

Everything about a peer's buttons (subscriptions, renewals, presses) goes over one route: a transport it is reachable
on, which stays the same while it keeps working (`LinkPeerRegistry.getRoute`). The publisher sends each update once
per transport its subscribers reach it through, so nothing is sent twice. When the route stops reaching the peer, the
subscriber moves to another (the fastest measured, see pinging) and re-subscribes there asking for the current state.
`access` and `ping` are the exceptions: they are about each transport, so they go over all of them.

### Connection drops

There is no session resumption: after a drop, everything needed is sent again, which is cheap (an announcement, and
one image per subscribed button). When a peer becomes reachable again, the subscriber re-subscribes asking for the
current state. The same happens when it is reached a different way, after its route stopped working.

To make brief drops (eg a reverse proxy closing a connection) unnoticeable, Remote buttons keep showing the last
image of a peer for 10 seconds after it becomes unreachable, before showing it as offline. And as a release could be
lost in a drop, buttons held by a peer are released as soon as it becomes unreachable.

### Loops

A Remote button can show a button that is itself a Remote button. `button.update` carries a `sourceChain` of the
installations the image passed through; a subscriber that finds itself in the chain shows a loop placeholder instead
of feeding it back. Presses are forwarded with the surface id extended at each hop (as for button references), and
dropped after too many hops.

### Versioning

Each installation announces the protocol versions it speaks (`LINK_PROTOCOL_VERSIONS` in
[Protocol/Versions.ts](./Protocol/Versions.ts)), one semver string per **major** version:

- Two installations use the highest major version they both speak (`negotiateLinkProtocolVersion`). If they have
  none in common, they are listed in the UI as incompatible, and nothing is sent to them.
- To bump the major version without breaking linked installations, add the new major alongside the old one, with
  its own folder of schemas and topics under its own version (`Protocol/v2/`, `v2/peers/…`), and keep speaking the old
  one for a transition period, so that installations can be upgraded one at a time. As each major has its own topics,
  peers on different ones never see each other's messages, even on topics shared by several subscribers (eg button
  updates).
- The announcement is how they find out, so it is the same for every version, and must stay readable by all of them:
  only ever add optional fields to it.
- A **minor** version adds a feature. Only use it towards a peer whose version of that major has it (its
  `protocolVersion`). Unknown properties are ignored by the schemas, so adding optional fields is safe.

## Security

### Identity

Each installation generates an Ed25519 key pair the first time ([Identity.ts](./Identity.ts)). Its public key
(base64url) is the Link id, so the id is stable, and can be proven: the transports use the key to prove who sent a
message, eg signing the key of a direct connection's handshake, or each message over a broker. Regenerating the id in
the UI makes a new key pair, so other installations see a new installation, and pairings must be redone.

### Transports

The protocol has no authentication or encryption of its own, and messages don't say who sent them. Securing who
can connect, and saying who each message is from, is the job of the transports:
Noise encryption with an explicit pairing step for direct connections, and broker credentials and TLS for MQTT (see
[Transports/README.md](./Transports/README.md)).

### Permissions

Each installation decides what it lets each other installation use. For now that is one switch, whether to share its
buttons (see `LinkPermissions`), which will grow (eg which pages, variables). Nothing is shared until the user says so.

Permissions are by Link id, stored in the core ([PermissionStore.ts](./PermissionStore.ts)), and chosen in the list of
installations. As the transports prove who sent each message, they are the same over every transport an installation
is reachable on, however many there are. The core enforces them:

- **Incoming**: button requests (`subscribe`, `button.press`, `button.rotate`) from an installation without
  `buttons` are ignored
- **Outgoing**: a publish says what the receiver needs to be allowed (button images need `buttons`), and the transport
  only delivers it to installations that are (asking the core). This matters as the update topics are shared by all
  subscribers of a button. A broker can't do this, so anyone who can connect to it can read what is shared
- **Telling the other side**: an `access` message tells a peer what it may use, when it becomes reachable and whenever
  that changes. Its Remote buttons can then say they are not shared, rather than waiting forever, and it doesn't send
  requests that would be ignored
- **Revoking**: when an installation loses `buttons`, its subscriptions are dropped and anything it was holding is
  released straight away

## Not done yet

- Remote buttons request a fixed bitmap size (144px). They should request the sizes the surfaces showing them need.
- Sharing variables between installations, and using connections of another installation.
- Choosing which transport to prefer for a peer (eg by latency), rather than the most recently heard from.
- Finer grained permissions, eg which pages a peer may use, or seeing but not pressing.
