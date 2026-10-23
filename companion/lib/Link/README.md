# Companion Link

Companion Link connects Companion installations together. The first thing it shares is buttons: a button on one can
show and press a button on another (a **Remote button**), and more will follow. It replaces the deprecated Bitfocus
Cloud with a bring-your-own-infrastructure approach: the installations talk over one or more **transports** (direct
connections, …) that the user sets up, and nothing needs to be hosted by the Companion project.

To build a new transport, see [Transports/README.md](./Transports/README.md).

## Architecture

Link is a core that knows nothing about what is being shared, with features built on top of it. Buttons are the
first feature; more will be added the same way, each with its own messages and flag in `access`.

```
  features         buttons  ·  (future features)        what is shared, both directions
  ───────────────────────────────────────────────────
  core             peers  ·  permissions  ·  routing    who is out there, what they may use
  ───────────────────────────────────────────────────
  transports       direct  ·  (future: a relay, a broker)  how messages get there
```

- **Transports** make this installation's announcement known, and send messages to one installation at a time. They
  know nothing about the protocol.
- **The core** announces this installation, tracks the peers it discovers and which transports reach them, applies
  permissions, and dispatches incoming messages to the feature that handles them.
- **Features** each have a server side (sharing this installation's things with peers) and a client side (using a
  peer's things here). For buttons, that is serving renders and handling presses, and the Remote button control.
- **Protocol/** defines what goes over the wire: the announcement and the message schemas.

## Protocol

The protocol is JSON messages sent from one installation to another, defined with zod in two parts:

- discovery ([Protocol/Announcement.ts](./Protocol/Announcement.ts)): the announcement each installation makes to all
  the others. The same for every major version, as it is how installations find out which one to use
- the messages of each major version (v1: [Protocol/v1/](./Protocol/v1/)), each sent to one peer. Each is
  `{ type, payload }`: the version isn't in the message, as it is the one negotiated with that peer

The protocol is internal to Companion: nothing else is expected to implement it, so the zod schemas are its only
definition.

| Message             | Sent to      | Notes                                                         |
| ------------------- | ------------ | ------------------------------------------------------------- |
| announcement        | everyone     | Repeated every 15s. Withdrawn (a goodbye) when going away     |
| `access`            | a peer       | What the sender lets the peer use (see Permissions)           |
| `subscribe`         | a peer       | Ask the peer to send some of its buttons (a lease, see below) |
| `unsubscribe`       | a peer       | Release a lease early                                         |
| `subscribe.refused` | a subscriber | The buttons of a `subscribe` that aren't served, and why      |
| `button.update`     | a subscriber | The content of a button at a size, and its state              |
| `button.press`      | a peer       | Press or release a button of the peer                         |
| `button.rotate`     | a peer       | Rotate an encoder button of the peer                          |
| `button.abort`      | a peer       | Abort the running actions of a button of the peer             |
| `ping`              | a peer       | Asks the peer for a `pong`, to measure the round trip         |
| `pong`              | a peer       | The reply to a `ping`, with its time, over the same transport |

Messages refer to a button with a tagged reference (`{ type: 'location', page, row, column }`), so that other ways of
referring to one can be added as new `type`s.

Messages don't say who sent them. The transport reports that with each announcement and message (`origin.peerId`),
as it is what knows, or can prove, who is at the other end. As each message goes to one installation, the core decides
who receives what: nothing is broadcast but the announcement.

### Discovery

Each installation announces itself on every transport, and repeats it every 15 seconds. The transport makes it known
to every installation it can reach, including those that arrive later. It carries the name, Companion version and
protocol versions, and nothing more, as every installation on the transport can read it, including those that aren't
allowed to use this one. A peer is unreachable on a transport after missing 3 announcements, when it says goodbye
(withdrawing its announcement, when a transport or Companion stops), or when the transport can tell it has gone (eg its
connection closed).

### Button subscriptions

Subscribing to a remote button is a **lease**: the subscriber sends `subscribe` to the peer, repeats it every 20
seconds, and sends `unsubscribe` once nothing here shows the button any more. The peer stops sending a button when it
is unsubscribed, or 60 seconds after the last renewal, so nothing leaks when a subscriber disappears without
unsubscribing.

A button that is served gets no other answer than its updates. One that isn't is listed, by its button and size, in a
`subscribe.refused` with the reason: `denied` when the subscriber isn't allowed buttons, or `limit` when the peer is
already serving as many as it can, or the subscriber already has its share (of buttons, or of sizes of one button). It is sent again for each renewal while that is still so, so a lost one is repaired
like a lost update, and the subscriber can say why a remote button is empty rather than waiting for it forever.

Each `button.update` carries a **revision**: `seq` counts the redraws of the button, and `stream` is chosen at random
when the peer starts serving it, so that the revisions of a restarted peer aren't mistaken for older ones. The revision
is shared by every size the button is served at, so updates at different sizes with the same revision are of the same
render. A subscriber drops an update that isn't newer than the one it has (the same stream, and no higher `seq`), and
any from a stream it has since seen replaced, so updates may arrive out of order, or over different routes, without an
old image replacing a newer one.

Transports only deliver on a best effort basis, so every `subscribe`, renewals included, says which revision the
subscriber has of each button (`have`, null for none), and the peer sends the current render if it has a different
one. So it is sent straight away when subscribing, a lost update is repaired by the next renewal, and an image the
subscriber already has is never sent again.

The peer that owns a button renders it once per size, however many subscribers it has.

### Sizes and decoration

A Remote button is drawn by the peer that owns the button, at the size it is shown at, rather than being scaled. The
subscriber tracks where each of its buttons is shown, and at what sizes (surfaces, previews, satellite subscriptions,
other buttons that embed it, and the peers it serves it on to), and subscribes once per **shape** (aspect ratio) at the
largest size of that shape. A size it no longer shows is let go of after a couple of seconds, so paging back and forth
doesn't churn.

The peer sends the **content** of the button alone, without its decoration (its top bar and status icons), with the
**state** that decoration is drawn from (pressed, step, status, actions running, and whether it is itself a
remote button showing an installation that has dropped out). The subscriber decorates it as it
does its own buttons, with its own settings and location, so it subscribes at the size of the content: what its
decoration leaves of the button.

An update only carries the image when it looks different: when only the state has changed (eg it was pressed), it
says the image is unchanged since an earlier revision. A subscriber that doesn't have that image subscribes again
holding nothing, to be sent it. A button with nothing on it is sent as having no image, rather than as an image of
nothing.

A new render is held back briefly until it has arrived at every shape, so that the shapes change together, and a
shape just subscribed to is waited for briefly (by the latency to the peer) before drawing another shape in its place.
Both waits are bounded, and serving a button on to another peer never waits.

### Routes

A peer may be reachable over several transports (routes). Today, everything about a peer's buttons goes over one of
them (`LinkPeerRegistry.getRoute`): kept while it works, and moved to another when it stops, re-subscribing there to
get anything missed. `access` and `ping` go over each transport, as they are about that transport.

Later, once the user can choose which routes to use for a peer, messages are to go over all of the chosen ones at once,
racing, so that the fastest that works wins, and a route that has stopped working holds nothing up while it goes
unnoticed (eg a press isn't held up waiting for it to time out). The protocol is ready for that, as every message is
already safe to receive more than once, in any order:

- `button.update` has a revision: anything not newer than what is held is dropped
- `button.press`, `button.rotate` and `button.abort` have an `id`, unique to the sender, and an `expiresAt`: the receiver acts on the
  first copy, drops the rest, and drops any that arrive once expired (2 seconds after being sent), as acting on one
  late (eg a camera cut seconds after the button was pressed) is worse than not at all. So the receiver only remembers
  an id until it expires
- `subscribe`, `unsubscribe`, `subscribe.refused` and `access` say how things should be, so a copy changes nothing
- `ping` and `pong` measure one transport, so each is sent over its own

The clocks of two installations can be far apart (eg a Raspberry Pi without a real time clock, on a network without
NTP), so `expiresAt` is in the sender's clock, and the receiver converts it with an estimate of how far apart they
are: each `pong` carries the time it was sent, which compared with the middle of the round trip gives the difference,
to within half the round trip. Until it has been measured, presses aren't dropped for being late.

### Connection drops

There is no session resumption: after a drop, everything needed is sent again, which is cheap (an announcement, and
one image per changed button). When a peer becomes reachable again, the subscriber re-subscribes, getting anything
that changed meanwhile. The same happens when it is reached a different way, after its route stopped working.

To make brief drops (eg a reverse proxy closing a connection) unnoticeable, Remote buttons keep showing the last
image of a peer for 10 seconds after it becomes unreachable, before showing it as offline. Buttons held by a peer stay
held, like those of a surface that is unplugged mid-press: a release that is lost is lost.

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
  its own folder of schemas (`Protocol/v2/`), and keep speaking the old one for a transition period, so that
  installations can be upgraded one at a time. Messages don't say their version: the core reads a peer's messages
  with the schemas of the major version negotiated with it, so it ignores them until the peer has announced itself.
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
can connect, and saying who each message is from, is the job of the transports (see
[Transports/README.md](./Transports/README.md)):

- The direct transport encrypts each connection with Noise, in which each end proves its Link id by signing its key
  with its identity, and only trusts an installation once the user has paired them, by entering the code one shows
  into the other (see [Transports/Direct/README.md](./Transports/Direct/README.md)).
- A transport over a shared service (a relay or broker) can't tell who sent a message, so it signs each of its own
  envelopes with the identity, and drops what doesn't verify. Each kind of signature has its own context, so that a
  signature made for one purpose is never valid for another.

### Permissions

Each installation decides what it lets each other installation use. For now that is one switch, whether to share its
buttons (see `LinkPermissions`), which will grow (eg which pages, variables). Nothing is shared until the user says so.

Permissions are by Link id, stored in the core ([PermissionStore.ts](./PermissionStore.ts)), and chosen in the list of
installations. As the transports prove who sent each message, they are the same over every transport an installation
is reachable on, however many there are. The core enforces them:

- **Incoming**: button requests (`subscribe`, `button.press`, `button.rotate`, `button.abort`) from an installation without
  `buttons` are ignored
- **Outgoing**: as every message goes to one installation, the core only sends one what it is allowed (button images
  need `buttons`)
- **Telling the other side**: an `access` message tells a peer what it may use, when it becomes reachable and whenever
  that changes. Its Remote buttons can then say they are not shared, rather than waiting forever, and it doesn't send
  requests that would be ignored
- **Revoking**: when an installation loses `buttons`, its subscriptions are dropped and anything it was holding is
  released straight away

## Not done yet

- Sharing variables between installations, and using connections of another installation.
- Letting the user choose which routes to use for a peer, and then racing every message over all of them (see
  Routes). Today, everything about a peer's buttons goes over one.
- Finer grained permissions, eg which pages a peer may use, or seeing but not pressing.
