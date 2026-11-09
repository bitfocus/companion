# Secure channels and pairing

Shared parts for transports that carry Link messages between two installations, so that a new transport encrypts and
pairs the same way rather than reinventing it. They run over a `MessagePipe` (`MessagePipe.ts`): anything that carries
opaque messages between the two ends, such as a websocket (`websocketMessagePipe`), a relay or a data channel. The
[direct transport](../Direct/README.md) uses them.

## Encryption

`SecureChannel.ts` runs a Noise XX handshake (`Noise_XX_25519_ChaChaPoly_BLAKE2b`, using
[noise-handshake](https://github.com/holepunchto/noise-handshake)) over the pipe, and encrypts everything after it.
Messages longer than a Noise message are split and reassembled. Each transport has its own Noise static key, kept in
its storage (`NoiseKey.ts`), which each end signs with its installation identity in the handshake, proving its Link id.
A message that has been tampered with closes the channel, and Noise numbers every message, so a recorded one can't be
replayed.

## Pairing

The handshake proves which installation is at the other end, but not that the user wants to trust it.
`PairingSession.ts` decides that, with `acceptAuthentication` at the end that accepted the connection and
`requestAuthentication` at the end that opened it. The frames and the code are in `Pairing.ts`.

The first time, the accepting end doesn't know the connecting end's Link id, so it asks the user to pair it (a
`PairingRequest`). Both ends derive an 8 digit code from the handshake hash; the connecting end shows it, and the user
enters it on the accepting end, which only accepts a matching code. A man in the middle would have run two separate
handshakes, so the codes would not match. Both ends then remember each other's Link id (the transport stores it):
later connections need no code, and a different one is refused.

The connecting end says first whether it has paired with the accepting end, and is asked to pair whenever it hasn't,
even if the accepting end remembers it (eg it forgot the pairing). It only trusts an end it has paired with, so
something impersonating the accepting end can't get itself pinned by claiming they are already paired.

A code that short could be ground to a chosen value: a man in the middle can vary what it sends in one handshake
until its hash gives the code the other already shows. So the code also covers a random nonce from each end,
exchanged commit-then-reveal over the encrypted channel (as in Bluetooth numeric comparison): the accepting end sends
a hash of its nonce, the connecting end answers with its own nonce, then the accepting end reveals its nonce, which
the connecting end checks against the hash. Neither end can choose its nonce once it knows the other's, so a man in
the middle only matches the codes by chance (1 in 10^8).

The code protects the accepting end: it proves the request comes from the installation whose screen the user read
it from. The connecting end has no such proof, as nothing is carried back to it: the first time, it trusts whatever
answers at the address it was given. An impostor there can run the commit-then-reveal, so that a code is shown, and
then say it was entered (`paired`) (like the first connection with SSH, or pairing a phone with a TV). Pinning protects every connection after that. An impostor gains
little by it: it is listed as an installation, but can use and see nothing until the user shares something with it.
For anyone who wants to check, the connecting end shows the identity of the other end alongside the code, which the
real installation shows on its Link page.

Pairing only decides who may connect. What each end shares with the other is chosen in the core.
