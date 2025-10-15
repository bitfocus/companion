It is possible to use the Contour ShuttleXpress and ShuttlePro v1 and v2 with Companion (since v3.1.0; note: support for very old versions of ShuttlePro v1 was added in v4.1.3)

You must enable it in Companion's Settings > Surfaces section and rescan for USB devices.

The button layout closely matches the device.

For the shuttle ring you have the choice of two different buttons:

- **_row2/col2_**: a rotate action will be sent once for each "stop" on the ring (+/- 7, including 0),
- **_row2/col3_**: a rotate action will be sent will repeat at a with increasing frequency proportional as the ring is turned away from the neutral position. Use the variable: `$(internal:shuttle)` if you need to determine direction and magnitude. (No action is sent when the shuttle returns to 0)
- NOTE: In either case, **_rotate-left_** is emitted when the jog is to the left of zero (the neutral position) and **_rotate-right_** is sent when the jog is to the right of zero, regardless of the physical rotation direction.

The contour shuttle defines two internal variables:

- `$(internal:shuttle)` (-7 to +7): indicates the current shuttle position
- `$(internal:jog)` (+1/-1): indicates the rotational direction of the jog wheel for 20 ms after each click-stop.

![Contour Shuttle template](images/contour-shuttle.png?raw=true 'Contour Shuttle template')

[Contour Shuttle template](assets/contour-shuttle-template.companionconfig)
