# Writing a Companion Link transport

A transport is one way for Companion installations to reach each other: a direct websocket, an MQTT broker, and so
on. The user can configure any number of transports, of any type, and Link uses all of them: a peer reachable on more
than one transport is reached through one of them at a time, and moves to another if that one stops working.

Transports are deliberately dumb. A transport moves opaque string payloads between installations, and does two
things with them: it makes this installation's **announcement** known to every installation it can reach, and it
**sends a message to one installation**. It knows nothing about the Link protocol: everything to do with discovery,
subscriptions, buttons and versioning lives in the core (see [../README.md](../README.md)).

Each transport is a self-contained folder here. It may import small utilities from outside (eg the logger), but
nothing outside the folder imports from it except [`index.ts`](./index.ts), which lists the available types.

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

A transport that every installation should run, without the user adding it, can instead be built in
(`LinkBuiltinTransport`, in `LINK_BUILTIN_TRANSPORTS`): it has one instance with a fixed id, switched on and
configured from the user config, so it appears in Settings under Protocols like Companion's other listeners. Accepting
direct connections is one.

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

	announce(payload: string | null): void {}
	send(peerId: string, payload: string): void {}
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

| Member                                 | Use                                                                                                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `receiveAnnouncement(peerId, payload)` | Hand over another installation's announcement, or `null` when it has gone                             |
| `receive(payload, origin)`             | Hand over a message sent to this installation, with who sent it                                       |
| `setStatus(status, message)`           | Report `connecting` / `connected` / `error`, with an explanation the user can act on                  |
| `setInfo(items)`                       | Facts to show the user, eg the address being listened on. Mark values they must copy as `copyable`    |
| `setSections(sections)`                | Things the user can act on, eg pairing requests (see below)                                           |
| `logger`                               | Logs under the transport's name                                                                       |
| `identity`                             | Who this installation is: its Link id (`identity.id`), and the key to prove it with (`identity.sign`) |
| `getName()`                            | The name of this installation, eg to introduce it to the other end                                    |
| `storage`                              | Persistent key-value storage for state that isn't user config (eg a generated key)                    |

### Who sent a message

Link messages and announcements don't say who sent them: the transport does, with the `peerId` it gives
`receiveAnnouncement`, and the `origin` it gives `receive`. Every installation has an Ed25519 key pair, whose public
key is its Link id (`context.identity`, see [`../Identity.ts`](../Identity.ts)), so the id can be proven rather than
claimed. Establish it as part of the connection where you can, eg by signing your key in an authenticated handshake.
A transport whose backend can't tell (eg a broker) wraps each payload in an envelope of its own that carries the
sender and their signature of it, and drops what doesn't verify (`LinkIdentity.verify`). That includes goodbyes: an
installation's announcement must only be withdrawn by that installation, or by the transport itself when it can tell
it has gone. Sign with a context of the transport's own (eg `companion-link mqtt envelope`), so that its signatures
can't be passed off as any other kind.

### Permissions

The user decides what other installations may use of this one (see `LinkPermissions`), by Link id, in the core: as the
transports prove who sent each message, that is the same whichever transport it arrives on. The core checks what each
sender may use, and only sends to an installation what it is allowed, so a transport has nothing to do beyond saying
who sent each message.

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

- **Announcements reach everyone, including latecomers.** `announce(payload)` must reach every installation reachable
  on the transport, and any that become reachable later, until it is replaced (eg a retained message on a broker, or
  sent to each new connection). `announce(null)` withdraws it, and is delivered to them as `null`.
- **Goodbyes when an installation vanishes.** If another installation disappears without saying goodbye (crash,
  network loss) and the transport can tell (a connection closing, a broker's last will), report it with
  `receiveAnnouncement(peerId, null)`. If it can't, peers still notice after a few missed announcements.
- **Messages go to one installation.** `send(peerId, payload)` delivers only to that installation, and
  `receive` only hands over messages sent to this one.
- **The sender is authenticated** (see above), so `peerId` can be trusted.
- **No replays.** A message must not be delivered twice because someone recorded and resent it. Where the sender is
  proven per connection (eg a secure channel with numbered messages), this comes with it. A transport that signs
  each message instead must make the signature cover something that can't repeat, eg a per-start session id and a
  counter, and drop what it has seen.
- **Sending is fire and forget.** When the installation can't be reached, drop the message: the protocol is built so
  that state is re-sent (announcements repeat, subscriptions are renewed and ask for the current state).
- **Status.** Only report `connected` when messages can actually flow. The core announces itself on every transport
  as it becomes connected, and treats peers as unreachable through a transport when it stops being connected.
- **Message size.** Payloads are JSON strings, mostly small. The largest are button images, normally well under
  100KB. Make sure the backend accepts at least 1MB.
- **Duplicates over several transports are tolerated.** The core may receive the same message over more than one
  transport; it is written so that this is harmless.

What a transport does **not** need to do: ordering, delivery guarantees beyond best effort, or knowing anything about
the messages.

## Security

The Link protocol has no authentication or encryption of its own: anyone a transport delivers messages from can press
the buttons they are allowed to, and anyone who can read what it carries can see them. Securing who can connect,
proving who sent what, and keeping it private are the job of the transport (pairing, signatures, encryption, broker
credentials, …).

Prefer encrypting end to end, between the two installations, in the transport itself, rather than relying on TLS: TLS
may end at a reverse proxy before it reaches the other installation, and its certificates are hard to manage between
installations. Use the secure channels and pairing in [`Secure/`](./Secure/README.md) for this, as the direct transport
does, rather than writing your own: anything that carries messages between two installations can run them. A transport
that can't keep what it carries private (eg a broker without encryption of its own) must say so, in its description or
a `static-text` field.

## Testing

Test the transport against fakes of the context, as in
[`test/Link/DirectTransport.test.ts`](../../../test/Link/DirectTransport.test.ts). Where the backend can be run
in-process, an end to end test of two instances exchanging messages is the most valuable test to have. Check at
least: announcements reach installations that arrive later, messages only reach their recipient, goodbyes (including
when an installation vanishes), and the status reported when the backend is unreachable.

## Existing transports

Each transport documents how it works in a README in its folder:

- [Direct](./Direct/README.md): installations connect directly to each other over a websocket, encrypted and paired
