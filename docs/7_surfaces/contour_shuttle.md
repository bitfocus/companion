It is possible to use the Contour ShuttleXpress and ShuttlePro v1 and v2 with Companion (since v3.1.0).

Enable support for it in Companion's settings and rescan for USB devices.

The layout closely matches the device.

For the shuttle ring you have the choice of defining:

- **rotate-left/rotate-right actions**: these will execute once for each "stop" on the ring (+/- 7),
- **button press/release actions**: press actions will repeat at a with increasing frequency proportional as the ring is turned away from the neutral position. Use `$(internal:shuttle)` to determine direction and magnitude; `$(internal:shuttle-sign)` if all you need is direction. When the ring returns to zero a single release action will be performed.

The contour shuttle defines two internal variables:

- `$(internal:shuttle)` -7 to +7; indicates the current shuttle position
- `$(internal:shuttle-sign)` -1, 0, or 1 to indicate the direction of action. (Multiply this by your "increment" value.)
- `$(internal:jog)` indicates the rotational direction of the jog wheel for 20 ms after each click-stop (+/-1).

![Contour Shuttle template](images/contour-shuttle.png?raw=true 'Contour Shuttle template')

[Contour Shuttle template](assets/contour-shuttle-template.companionconfig)
