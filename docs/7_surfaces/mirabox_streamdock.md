Mirabox offers a range of input devices in their Stream Dock line.  
Companion supports the models:

- 293V3 - 5x3 LCD Keys
- N4 - 5x2 LCD Keys + 4 Rotary encoders with LCD strip + USB-Hub

If you want to use a Stream Dock with Companion the Mirabox creator software must not be running, not even minimized to the Dock, and Stream Dock support needs to be enabled in the settings.

**293V3**

The layout is straight forward, all keys match the Companion grid.

**N4**

The two rows with the five LCD keys each are mapped to the Companion grid like you expect.  
The LCD strip offers four soft keys and there are four corresponding rotary encoders. For better compatibility with the layout of e.g. the Stream Deck + the four controls of these rows are mapped left aligned. That means although in reality they are spread evenly across the width of the five LCD keys, in Companion they are placed in the first four columns.

The softkeys of the LCD strip and the rotary encoders do not offer individual press and release events. The softkeys only fire an event when you release your finger and the rotary encoders only fire an event when you push the encoder. This is a limitation of the Stream Dock hardware. For your convenience the events of a softkey or a rotary encoder will trigger a press and a release in Companion.

To utilise the rotary encoders, enable the `Enable Rotary Actions` checkbox on the button which wants to support the encoder. This will provide additional action groups which will be used when rotating the encoder.

The LCD strip also offers a swipe gesture. The events of the swipe gesture are mapped to rotary actions on the fifth button in the third row.

![Stream Dock N4 mapping](images/mirabox-streamdock.png?raw=true 'Stream Dock N4 mapping')
