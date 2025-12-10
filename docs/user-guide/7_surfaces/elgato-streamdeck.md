---
title: Elgato Stream Deck
sidebar_position: 1
description: Setup guide for Elgato Stream Deck models.
---

Companion is primarily intended to be used with various [Elgato Stream Deck](https://www.elgato.com/en/stream-deck) models.

We currently support the following models:

- Stream Deck (15 key)
- Stream Deck Mini
- Stream Deck XL
- Stream Deck Mk2
- Stream Deck Pedal
- Stream Deck +
- Stream Deck Neo
- Stream Deck Studio

Occasionally Elgato releases new revisions without notice, so some new devices may not work immediately.

We recommend connecting Stream Decks without the Elgato software. If you use the Elgato software, all Stream Decks will display the same buttons; connecting directly allows each to be different. See the surfaces settings to choose between modes.

### Stream Deck +

The Stream Deck + has rotary encoders and a touch strip.

The touch strip is mapped to four buttons. These buttons provide _press_ events to Companion without a separate _release_ event; "pressing" (tapping) the strip generates both down and up actions with a short delay. Consequently, the touch strip cannot respond to long-press actions.

Starting with Companion v4.2, the touch strip also supports two types of swipe responses:

- swiping horizontally will change the page: swipe left to get the next page; right to get the previous page (as if you're dragging a piece of paper that is just under the surface). To enable or disable page-turning, [change the settings in the Surfaces tab](../3_config/surfaces.md).
- swiping vertically: up emits _rotate-right_; down emits _rotate-left_ (enable the `Enable Rotary Actions` checkbox for the button to access these events).

Note that the LCD Strip may occasionally confuse a vertical swipe with a press, so best practice may be to chose either _rotation_ actions or _press_ actions for the LCD buttons but not both at once. Or else to avoid _press actions_ that change something critical, if using both.

To use the rotary encoders for a control, enable the `Enable Rotary Actions` checkbox for that control. This adds additional action groups used when rotating the encoder.

### Stream Deck Neo

The Stream Deck Neo presents as a 4×3 grid, with the LCD spanning the bottom-center two buttons. We do not currently support drawing to the LCD segment.

### Stream Deck Studio

The studio layout places the left encoder at position 0/0, with buttons starting at 0/1 and continuing across; the right encoder is at 0/17.

You can select a custom variable to write NFC values to in the surface settings.

The LED rings around the encoders are not yet supported.
