# Writing a Companion Link transport

A transport is one way for Companion installations to reach each other: a direct websocket, an MQTT broker, and so
on. The user can configure any number of transports, of any type, and Link uses all of them: a peer reachable on more
than one transport is reached through one of them at a time, and moves to another if that one stops working.

Transports are deliberately dumb. A transport moves opaque string payloads between installations using
**publish/subscribe on MQTT style topics**, and knows nothing about the Link protocol. Everything to do with
discovery, subscriptions, buttons and versioning lives in the core (see [../README.md](../README.md)).

Each transport is a self-contained folder here. It may import small utilities from outside (eg
[`../TopicMatcher.ts`](../TopicMatcher.ts), the logger), but nothing outside the folder imports from it except
[`index.ts`](./index.ts), which lists the available types.

## The pieces

### 1. The definition

Everything the UI shows about a transport type comes from its definition, so adding one needs no UI changes.

```ts
// Transports/Example/index.ts
import type { LinkTransportDefinition } from '../Types.js'
import { ExampleTransport, type ExampleTransportConfig } from './ExampleTransport.js'

export const ExampleTransportDefinition: LinkTransportDefinition<ExampleTransportConfig> = {
	// Persisted in the user's config. Never change it once released
	type: 'example',
	// Shown in the "Add Transport" menu and in the list of transports
	name: 'Example service',
	// One or two sentences: what it is, and when to choose it
	description: 'Connect through the Example service. Works anywhere with internet access.',
	// The config editor is built from these
	configFields: [
		{ id: 'apiKey', type: 'secret-text', label: 'API key', default: '' },
		{ id: 'region', type: 'dropdown', label: 'Region', default: 'eu', choices: [/* … */] },
	],

	create: (context, config) => new ExampleTransport(context, config),
}
```

Then add it to `LINK_TRANSPORT_DEFINITIONS` in [`index.ts`](./index.ts), in the order it should be offered.

Config fields are a subset of the input fields used elsewhere in Companion (`LinkTransportConfigField`: text,
secret, number, checkbox, dropdown and static text), holding plain values. Give every field a `default`. Values are validated and sanitised
against the fields, and missing values are filled in from the defaults, before they reach `create`, so the config
your transport receives always matches `TConfig`. A transport whose config is incomplete (eg a required field that
is empty) is not started, and the user is told which fields to fill in. Use `isVisibleUi` to hide fields that don't apply, and a
`static-text` field to explain something (eg security implications).

### 2. The transport

`create` returns a `LinkTransport` (see [`Types.ts`](./Types.ts)):

```ts
export class ExampleTransport implements LinkTransport {
	constructor(context: LinkTransportContext, config: ExampleTransportConfig) {
		context.setStatus('connecting', null)
		// Start connecting. Don't block the constructor
	}

	publish(topic: string, payload: string, options: LinkPublishOptions): void {}
	subscribe(pattern: string): void {}
	unsubscribe(pattern: string): void {}
	async handleSectionAction(entryId: string, actionId: string, input: string | null): Promise<string | null> {
		return 'Unknown action'
	}
	async destroy(): Promise<void> {}
}
```

A new instance is created whenever the user changes the config, so a transport never has to handle being
reconfigured. It is destroyed when the config changes, the transport is disabled or deleted, or Companion shuts
down.

The `context` is how the transport talks to the core:

| Member                            | Use                                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `receive(topic, payload, origin)` | Hand over a message that arrived on a subscribed topic, with who sent it                              |
| `getPermissions(peerId)`          | What the user lets an installation use (see Permissions)                                              |
| `setStatus(status, message)`      | Report `connecting` / `connected` / `error`, with an explanation the user can act on                  |
| `setInfo(items)`                  | Facts to show the user, eg the address being listened on. Mark values they must copy as `copyable`    |
| `setSections(sections)`           | Things the user can act on, eg pairing requests (see below)                                           |
| `logger`                          | Logs under the transport's name                                                                       |
| `identity`                        | Who this installation is: its Link id (`identity.id`), and the key to prove it with (`identity.sign`) |
| `getName()`                       | The name of this installation, eg to introduce it to the other end                                    |
| `lastWill`                        | What to publish for us if we vanish without saying goodbye (see below)                                |
| `storage`                         | Persistent key-value storage for state that isn't user config (eg a generated key)                    |

### Who sent a message

Link messages don't say who sent them: the transport does, with the `peerId` in the `origin` it gives `receive`.
Every installation has an Ed25519 key pair, whose public key is its Link id (`context.identity`, see
[`../Identity.ts`](../Identity.ts)), so the id can be proven rather than claimed. Establish it as part of the
connection where you can, eg by signing your key in an authenticated handshake. A transport whose backend can't tell
(eg a broker) wraps each payload in an envelope of its own that carries the sender and their signature of it, and
drops what doesn't verify (`LinkIdentity.verify`). Use `null` only for a
message nobody can be said to have sent (eg an empty retained message clearing a topic on a broker): the core only
accepts that as a goodbye.

### Permissions

The user decides what other installations may use of this one (see `LinkPermissions`), by Link id, in the core: as the
transports prove who sent each message, that is the same whichever transport it arrives on. A transport only has to:

- say who sent each message (`origin.peerId`, see above). The core checks what it may use
- honour `options.requires` on `publish` (eg button images need `buttons`), by only delivering to installations that
  `context.getPermissions` says are allowed it. Read it when publishing rather than keeping it, as it can change at
  any time. A transport that can't control who receives what (eg a broker) delivers it anyway, and should say that
  anyone who can connect to it can read what is shared

### Interacting with the user

Some transports need the user to do something that isn't config, like accepting a pairing request. Rather than
adding UI for it, report it with `context.setSections`: each section is a titled list of entries, and each entry can
offer actions (buttons), optionally asking for a value first (eg a pairing code). The UI renders these in the
transport's panel, and when the user chooses an action it arrives at `handleSectionAction(entryId, actionId, input)`.
Return an error message to show next to the entry, or `null` on success, and report the new sections. A transport
with nothing to show never calls `setSections`, and returns an error from `handleSectionAction`.

Mark a section with `attention` when the user should act on it, and use the status message to say so too, as that
is what shows in the list of transports.

## What a transport must guarantee

- **Topics** use MQTT conventions: `/` separated levels, `+` matches one level, a trailing `#` matches the rest.
  Brokers that use other conventions must translate. [`../TopicMatcher.ts`](../TopicMatcher.ts) implements the
  matching for transports that route messages themselves.
- **Subscriptions survive reconnects.** The core subscribes once; resubscribe after reconnecting if the backend
  forgot.
- **Publishing is fire and forget.** When not connected, drop the message: the protocol is built so that state is
  re-sent (announcements repeat, subscriptions are renewed and ask for the current state).
- **Retained messages.** A publish with `retain: true` must be delivered to subscribers that arrive later, until it
  is replaced. An empty retained payload clears it, and must itself be delivered to current subscribers. Only the
  discovery announcements are retained.
- **Last will.** If this installation disappears without saying goodbye (crash, network loss), peers should
  receive `context.lastWill`. A broker with a last will feature does this for you; a point to point transport can
  emulate it by delivering an empty payload locally for each retained topic the other side had published when the
  connection drops (see [`Direct/PeerConnectionBus.ts`](./Direct/PeerConnectionBus.ts)). If neither is possible,
  peers still notice after a few missed announcements.
- **Status.** Only report `connected` when messages can actually flow. The core announces itself on every transport
  as it becomes connected, and treats peers as unreachable through a transport when it stops being connected.
- **Message size.** Payloads are JSON strings, mostly small. The largest are button images, normally well under
  100KB. Make sure the backend accepts at least 1MB.
- **No duplicates are needed, but they are tolerated.** The core may receive the same message over several
  transports; it is written so that this is harmless.

What a transport does **not** need to do: ordering, delivery guarantees beyond best effort, encryption of the
payload (do secure the connection itself, eg with TLS, or encryption in the stream like `Direct/`), or knowing anything about the messages.

## Security

The Link protocol has no authentication of its own: anyone who can publish to an installation's topics can press its
buttons. Securing who can connect is the job of the transport (broker credentials, TLS, pairing, …).
Explain the implications in the transport's description or a `static-text` field when they are not obvious.

## Testing

Test the transport against fakes of the context, as in
[`test/Link/DirectTransport.test.ts`](../../../test/Link/DirectTransport.test.ts). Where the backend can be run
in-process, an end to end test of two instances exchanging messages is the most valuable test to have. Check at
least: messages only arrive for subscribed patterns, retained messages reach late subscribers, the last will
behaviour, and the status reported when the backend is unreachable.

## Existing transports

- [`Direct/`](./Direct): installations connect directly to each other over a websocket. Two transport types share
  the folder: one accepts connections, the other makes one. This is the recommended transport: for installations on
  different networks, connect them over a VPN, rather than exposing the port to the internet.
  - **Encryption**: every connection runs a Noise XX handshake (`Noise_XX_25519_ChaChaPoly_BLAKE2b`, using
    [noise-handshake](https://github.com/holepunchto/noise-handshake)), and everything after it is encrypted
    (`SecureChannel.ts`). Each transport has its own Noise static key (`Identity.ts`), which each end signs with its
    installation identity in the handshake, proving its Link id.
  - **Pairing** (`Pairing.ts`): the first time, the accepting end doesn't know the connecting end's Link id, so it shows a
    pairing request. Both ends derive an 8 digit code from the handshake hash; the connecting end shows it, and the
    user enters it on the accepting end, which only accepts a matching code. A man in the middle would have run two
    separate handshakes, so the codes would not match. Both ends then remember each other's Link id: later
    connections need no code, and a different one is refused. This uses `setSections` for the requests and the paired list.
  - **Permissions**: pairing only decides who may connect. What each end shares with the other is chosen in the core,
    and the transport only delivers what needs permission to a connection whose Link id has it.
  - **Broker emulation**: as this is point to point, it emulates the broker features itself in
    `PeerConnectionBus`.
  - **Addresses** (`Address.ts`): the connecting end takes either a host (with an optional port), or a full
    `ws://`/`wss://` url, so it can go through a reverse proxy, on a subpath if need be. TLS from a proxy is only an
    outer layer, the Noise handshake is what authenticates the other end.
  - **Reconnecting**: the first retry is almost immediate, then it backs off to 30 seconds. Each reconnect runs a
    fresh handshake (no code needed once paired), and the core then resends everything (see the Link README).
