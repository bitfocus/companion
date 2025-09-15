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

##### Stream Deck +

The Stream Deck + has rotary encoders and a touch strip.

The touch strip only provides press events to Companion; pressing it generates both down and up actions with a short delay.

To use the rotary encoders for a control, enable the `Enable Rotary Actions` checkbox for that control. This adds additional action groups used when rotating the encoder.

##### Stream Deck Neo

The Stream Deck Neo presents as a 4×3 grid, with the LCD spanning the bottom-center two buttons. We do not currently support drawing to the LCD segment.

##### Stream Deck Studio

The studio layout places the left encoder at position 0/0, with buttons starting at 0/1 and continuing across; the right encoder is at 0/17.

You can select a custom variable to write NFC values to in the surface settings.

The LED rings around the encoders are not yet supported.
