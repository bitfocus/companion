There are several button indicators you should be familiar with:

| Button                                                                                   | Description                                                                                    |
| ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| ![Button latch off](images/button-latch-off-with-topbar.png?raw=true 'Button latch off') | An unpressed button.                                                                           |
| ![Button error](images/button-error.png?raw=true 'Button error')                         | One or more connections referenced in this button's actions are in an error state.             |
| ![Button latch on](images/button-latch-on-with-topbar.png?raw=true 'Button latch on')    | The button was pressed. Usually the bar is only shown briefly, but it can stay on if you press and don't release the button; this can happen via an Action too, if you use "Button Trigger Press" without "Button Trigger Release" or instead of using "Button Trigger Press and Release" for example.                              |
| ![Button delay](images/button-delay.png?raw=true 'Button delay')                         | Some delayed actions are still queued to run for this button, typically due to the **internal: Wait** action (see [Actions](#header-actions) above), or if they are set to run sequentially (using the **internal: Action Group** action). |
