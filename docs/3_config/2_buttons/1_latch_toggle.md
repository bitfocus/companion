The **Latch/Toggle** checkbox changes the push behavior of the button, making the first press of the button trigger all the **Press/on** actions, and a second press of the button trigger the **Release/off** actions.

When a button is pressed and is latched, its header will appear solid.

![Button latch off with topbar](images/button-latch-off-with-topbar.png?raw=true 'Button latch off with topbar') ![Button latch on with topbar](images/button-latch-on-with-topbar.png?raw=true 'Button latch on with topbar')  
_Button latch off / on with topbar_

When the topbar is hidden and a button is pressed and is latched, its border will appear solid yellow.
Again see the [Settings](#header-5-settings) section below to change this.

![Button latch off without topbar](images/button-latch-off-without-topbar.png?raw=true 'Button latch off without topbar') ![Button latch on without topbar](images/button-latch-on-without-topbar.png?raw=true 'Button latch on without topbar')  
_Button latch off / on without topbar_

> **Example**: You have a projector and want to close its shutter when you press the button and then open the shutter when you press it a second time. To do this, first enable **Latch** on the button, then add a new action to close the shutter in the **Press/on** actions list, and the open shutter action to the **Release/off** action list.