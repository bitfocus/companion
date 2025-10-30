---
title: Mirabox Stream Dock
sidebar_position: 5
---

Mirabox's Stream Dock line includes several input devices.  
Companion supports the following models:

- 293V3 — 5×3 LCD keys
- N3 - 3x2 LCD keys, 3 non-LCD buttons, and 3 rotary encoders.
- N4 — 5×2 LCD keys, plus 4 rotary encoders with an LCD strip and a USB hub

To use a Stream Dock with Companion, the Mirabox creator software must not be running (not even minimized to the dock). Also enable Stream Dock support in Companion's settings.

Some Stream Dock models do not provide separate press and release events for all controls — this is a hardware limitation.

**293V3**

The layout is straightforward: all keys map directly to the Companion grid.

**N3**

The N3 has two rows of 3 LCD keys that map to the Companion grid. There are three non-LCD buttons underneath.

There's a large rotary encoder, shown as Rotary 1 and two smaller encoders shown as Rotary 2 and 3. To use the rotary encoders for a specific button, enable the `Enable Rotary Actions` checkbox for that button. This adds additional action groups that Companion will use when the encoder is rotated.

![Stream Dock N3 mapping](images/mirabox-streamdock-n3.png?raw=true 'Stream Dock N3 mapping')

**N4**

The N4 has two rows of five LCD keys that map to the Companion grid. The LCD strip provides four soft keys and four rotary encoders. For compatibility with Stream Deck-style layouts, these four controls are left-aligned in Companion. Although the controls are evenly spaced across the width of the five LCD keys on the device, Companion places them in the first four columns.

The soft keys and rotary encoders do not provide individual press and release events. Soft keys only generate an event when you release your finger, and the rotary encoders only generate an event when you press (push) the encoder. Companion synthesizes a press followed by a release for these controls for compatibility.

To use the rotary encoders for a specific button, enable the `Enable Rotary Actions` checkbox for that button. This adds additional action groups that Companion will use when the encoder is rotated.

The LCD strip also supports a swipe gesture. Swipe events are mapped to the rotary actions of the fifth button in the third row.

![Stream Dock N4 mapping](images/mirabox-streamdock.png?raw=true 'Stream Dock N4 mapping')
