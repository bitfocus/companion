There are several internal actions you can add to a button in order to control Companion:

| Action                                    | Description                                                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Enable or disable instance                | Allows you to enable or disable a specific instance of a module.                                                   |
| Set surface with s/n to page              | Changes a surface/controller (Stream Deck or emulator) to a specific page.                                         |
| Set surface with index to page            | Changes a surface/controller (Stream Deck or emulator) based on their index in the device list to a specific page. |
| Trigger a device lockout                  | Locks out selected Stream Decks immediately.                                                                       |
| Trigger a device unlock                   | Unlocks selected Stream Decks immediately.                                                                         |
| Run shell path                            | Runs a shell command locally.                                                                                      |
| Trigger all devices to unlock immediately | Unlocks all Stream Decks immediately.                                                                              |
| Trigger all devices to lock immediately   | Locks all Stream Decks immediately.                                                                                |
| Increment page number                     | Increments the page number of a surface.                                                                           |
| Decrement page number                     | Decrements the page number of a surface.                                                                           |
| Button press and release                  | Simulates a button press in a specific page/button on a controller.                                                |
| Button press                              | Simulates holding a button down in a specific page/button on a controller.                                         |
| Button release                            | Simulates releasing a button in a specific page/button on a controller.                                            |
| Button Text                               | Changes the text on a button.                                                                                      |
| Button Text Color                         | Changes the color of text on a button.                                                                             |
| Button Background Color                   | Changes the background color on a button.                                                                          |
| Rescan USB for devices                    | Scans for any newly attached Stream Decks.                                                                         |
| Abort actions on button                   | Will cancel all delayed actions on a specific button (those not yet started).                                      |
| Abort all delayed actions                 | Will cancel all delayed actions on all buttons (those not yet started).                                            |
| Kill Companion                            | Shuts down Companion when its not responding.                                                                      |
| Restart Companion                         | Closes and restarts Companion.                                                                                     |