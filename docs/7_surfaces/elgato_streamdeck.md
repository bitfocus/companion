Companion is primarily intended to be used with the various models of [Elgato Stream Deck](https://www.elgato.com/en/stream-deck).

We currently support the following models:
- Stream deck (15 key)
- Stream deck Mini
- Stream deck XL
- Stream deck Mk2
- Stream deck Pedal
- Stream deck +

Occasionally Elgato will release new revisions of these products without notice, so we have to play catch up which results in new devices not working for a few weeks.

We recommend connecting to your Streamdecks without using the Elgato software, but there is a plugin in the Elgato software for those who wish to do this. If going via the Elgato software, then all your Streamdecks will display the same buttons, if done directly they can all be different. There is a [setting](#3_config/settings/surfaces.md) to choose between these modes.

##### Stream deck +

The Stream deck + is unusual, in that it has rotary encoders and a touch strip.

The touch strip is a bit limited, and can only provide press events to companion. This means that when you press it, both the down and up actions will be fired with a short delay in between.

To utilise the rotary encoders, enable the `Enable Rotary Actions` checkbox on the button which wants to support the encoder. This will provide additional action groups which will be used when rotating the encoder.
