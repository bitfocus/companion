It is possible to use the Contour ShuttleXpress and ShuttlePro v1 and v2 with Companion since v3.1.0.

Enable support for it in the Companion settings, and rescan for USB devices.

The layout pretty closely matches what you would expect based on the device.

For the shuttle ring you have the choice of defining:

- **rotate-left/rotate-right actions**: these will execute once for each stop on the ring (+/- 7 stops),
- **button press/release actions**: press actions will repeat at a fixed frequency until the ring returns to zero. Use `$(internal:shuttle)` to determine direction and magnitude. When the ring returns to zero a single release action will be performed.

The contour shuttle defines two internal variables:

- `$(internal:shuttle)` indicates the current shuttle position
- `$(internal:jog)` indicates the rotational direction of the jog wheel for 20 ms after each click-stop (+/-1).

![Contour Shuttle template](images/contour-shuttle.png?raw=true 'Contour Shuttle template')

[Contour Shuttle template](assets/contour-shuttle-template.companionconfig)
