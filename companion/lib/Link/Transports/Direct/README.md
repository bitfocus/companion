# Direct transport

Installations connect directly to each other over a websocket. Two transport types share this folder: accepting
connections, which is built in (switched on by default, as an installation that connects can do nothing until it has
been paired), and making one, which the user adds for each installation to connect to.

This is the recommended transport. For installations on different networks, connect them over a VPN rather than
exposing the port to the internet.

## Encryption and pairing

Every connection is a secure channel, over the websocket, and is paired the first time, using the shared parts in
[`Secure/`](../Secure/README.md). The accepting end lists pairing requests and the paired installations with
`setSections`; the connecting end shows the code.

## Announcements and messages

As a connection is between exactly two installations, a frame is either the sender's announcement (sent when the
connection is linked, and whenever it changes) or a message for the other end (`DirectTransportBase.ts`). When the
last connection to an installation closes, that is its goodbye. Noise numbers every message, so a recorded one can't
be replayed.

## Addresses

The connecting end takes either a host (with an optional port), or a full `ws://`/`wss://` url, so it can go through a
reverse proxy, on a subpath if need be (`Address.ts`). TLS from a proxy is only an outer layer: the Noise handshake is
what authenticates the other end.

## Reconnecting

The first retry is almost immediate, then it backs off to 30 seconds. Each reconnect runs a fresh handshake (no code
needed once paired), and the core then resends everything (see the [Link README](../../README.md)).
