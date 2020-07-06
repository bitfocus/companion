# Companion 2.0
This article is an introduction to Companion’s basic principles and user interface.


## Getting started

### Before you open Companion
  * Connect the hardware and software you want to control. Make sure you are on the same network as they are.
  * In the Elgato Stream Deck app, make sure to firmware upgrade the Stream Deck to the latest version available.
  * Close the Elgato Stream Deck app. Companion will not find your device if this is open.



### Start the server

When you open Companion, a server window will open. From the opening screen, choose your network interface and change the port if needed - the default is 8000. This is the port of the Companion server.

![Server](images/server.png?raw=true "Server")


Companion should be running on the same computer that the Stream Deck is connected to. It can run on the same machine as, for example, Barco Event Master or other software for control/playback; it uses minimal resources.

If you need to remotely control Companion from other computers on the same network, use the URL under the text “Running”. Normally, to configure Companion from the computer you're running it on, click the **Launch GUI** button, it will open the Admin page in your default browser.

We recommend using Google Chrome.




### The user interface
The main window is divided into three sections. From left to right:

- Sidebar
- Main admin controls and settings
- Log, Presets, and your Companion configuration

![Admin GUI](images/admingui.png?raw=true "Admin GUI")



## Sidebar

*You can collapse the sidebar by clicking the "burger" icon on the left of Companion logo, or shrink it by clicking the arrow at the bottom of the sidebar.*

### Community Links

- [Companion GitHub to report bugs](https://github.com/bitfocus/companion/issues)

- [Facebook group to share information and ask questions](https://www.facebook.com/groups/2047850215433318/)

- [The Slack group for developers](https://bit.ly/2IJ1jT4)

- [Donate to show your support and fund future development](https://donorbox.org/bitfocus-opensource)




### Emulator
**Emulator** is a tool to test and use the setup, even if you don’t have a Stream Deck connected. It will open in a new browser tab and will function just like a Stream Deck would.

You can use keyboard hotkeys to control the emulator and trigger button presses. Instructions are found on the bottom of the emulator page.



### Web buttons

**Web buttons** is a way of viewing all your buttons across all pages on a single screen, which may be useful if you want to use a web browser on a tablet to control Companion.

If you would like to just view one page or a select few, you can add text to the end of the URL in your browser. Just add **?pages=** and the page numbers you want to see separated by a comma.

**Examples**

- http://127.0.0.1:8000/tablet.html?pages=2  
	*Includes only page 2*
- http://127.0.0.1:8000/tablet.html?pages=3,7,12  
	*Includes only pages 3, 7, and 12*



- - -

## Main admin controls
This is where all the connections, buttons, and actions are configured.
This section is divided into four tabs.

### 1. Instances
From the Instances tab, you can add, edit and remove devices. You can also see if a device is connected by looking at the Status column.

Press the question mark icon to open that module's help information.



**To add a new device**

 1. Add a new device, either by finding it by category, by manufacturer, or through a search.
 2. Choose the specific device you want to add.
 3. Enter the connection information for device. Apply the changes.

Your new device should now show in the Instances tab along with all the other devices you want to control.
Each device needs to be a separate instance. If you have two separate Barco E2, you need to add both of them as separate instances.

![Instance](images/instance.png?raw=true "Instance")

After an instance has been created and successfully configured, it may provide you with a list of [Dynamic Variables](#header-dynamic-variables) you can use when configuring your button. This will be described below.

If something is missing, please make a support request on the [GitHub page by creating an issue/feature request](https://github.com/bitfocus/companion/issues) describing the feature, use cases, and providing documentation, if needed, for the implementation.



- - - -

### 2. Buttons
From the Buttons tab, you can add, edit and remove buttons for your Stream Deck.

The Buttons layout has 99 pages that can be navigated using the red left/right arrows. Give your pages a unique name by replacing the word *PAGE* right next to the page number.

You can move to a specific page by clicking on the gray page number, entering in the desired page number, and pressing the ENTER key on your keyboard.

If you hold down the SHIFT key on your keyboard, you can trigger a button directly by clicking on it.

![Instance](images/buttons.png?raw=true "Buttons")

Several actions exist for rearranging your buttons, **Copy**, **Move**, or **Delete**.

First click on the desired action, then click on the button you want to apply that action to. Finally (in the case of the `Copy` and `Move` actions) click on the destination button. 



There are also two buttons for resetting the page:

- **Wipe page**: Erases all buttons on the page and adds the navigation buttons.
- **Reset page buttons**: Leaves the buttons intact, but adds the navigation buttons.



**Export page** exports just this page's buttons to a download which can later be imported to another page or a different Companion config. See the [Import / Export](#header-import--export) section below.



**Making buttons**

1. Make at least one instance.
2. Click on the button space you want the button to be located on.
3. Set the button's type:
   1. **Regular button**: Can trigger one or more actions.
   2. **Page up**: Can move up to the next page set of buttons.
   3. **Page number**: Shows the current page number/name.
      1. Pressing this button will return to page 1.
   4. **Page down**: Can move down to the previous page set of buttons.
4. Give the button a name, and optionally style it further.
5. Add Actions or Instance Feedbacks to the button.



**Button styling**

There are several ways you can make your button stand out, including:

- Adjusting the font's size.
- Adding a PNG image (72x58px) to be used as a button's background. Text can added on top.
- Setting the alignment of the text.
- Setting the alignment of the PNG image.
- Changing the text's color.
- Changing the button's background color.



**Creating a button**

Enter your button's text in the **Button text** field, then select the alignment and font size. Text and background colors can also be changed.

You can force a newline in a label by typing `\n` where you want the newline to appear.

A live preview of the button will be shown on the top right corner. Button information will update in real-time in the Emulator and Stream Deck.

Add actions to the button from the **Add key down/on action** drop-down menu.

You can add multiple actions and set delay times for each action. Delay times are in milliseconds. 1000ms = 1 second.

![Button](images/button.png?raw=true "Button")



**Creating a PNG button**

Make a 72x58px PNG image.

Click the red **Browse** button and choose the PNG file you want to use. The picture will appear on the top right preview of the button. Text can be applied over the image.



#### Latch/Toggle

The **Latch/Toggle** checkbox changes the push behavior of the button, making the first press of the button trigger all the **Key down/on** actions, and a second press of the button trigger the **Key up/off** actions.

When a button is pressed and is latched, its header will appear solid.

![Button latch off](images/button-latch-off.jpg?raw=true "Button latch off") ![Button latch on](images/button-latch-on.jpg?raw=true "Button latch on")  
*Button latch off / on*

> Example: You have a projector and want to close its shutter when you press the button and then open the shutter when you press it a second time. To do this, first enable **Latch** on the button, then add a new action to close the shutter in the **Key down/on** actions list, and the open shutter action to the **Key up/off** action list.



#### Delays

Each action can be delayed to run a certain number of milliseconds after the button is triggered. Delays can be configured to be *Absolute* (default) or *Relative*, by toggling the checkbox in the button styling section.

**Absolute Delays**

All actions run a certain number of milliseconds from the start of the button press. Actions without a delay start immediately. This is the default behavior.

![Absolute delays](images/delay-absolute.jpg?raw=true "Absolute delays")



**Relative Delays**

Each action runs a certain number of milliseconds after the previous action *started*.

![Relative delays](images/delay-relative.jpg?raw=true "Relative delays")

The order the actions are listed in matters when using relative delays. Actions can be reordered by grabbing the sort icon next to each action and dragging it up or down.



#### Key actions

These actions are performed when the button is pressed or depressed (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. An action may also have options to let you customize how the action performs.

![Button actions](images/button-actions.png?raw=true "Button Actions")

The **KEY DOWN/ON ACTIONS** will be performed when the button is triggered.

The **KEY UP/OFF ACTIONS** are performed when the button is released, *or* when the button becomes unlatched.



#### Internal actions

There are several internal actions you can add to a button in order to control Companion:

|Action  | Description |
| -------------------------- | ---- |
| Enable or disable instance | Allows you to enable or disable a specific instance of a module. |
| Set surface to page        | Changes a surface/controller (Stream Deck or emulator) to a specific page. |
| Trigger a device lockout   | Locks out selected Stream Decks immediately. |
| Trigger a device unlock    | Unlocks selected Stream Decks immediately. |
| Run shell path             | Runs a shell command locally. |
| Trigger all devices to unlock immediately   | Unlocks all Stream Decks immediately. |
| Trigger all devices to lock immediately   | Locks all Stream Decks immediately. |
| Increment page number      | Increments the page number of a surface. |
| Decrement page number      | Decrements the page number of a surface. |
| Button press and release   | Simulates a button press in a specific page/button on a controller. |
| Button press               | Simulates holding a button down in a specific page/button on a controller. |
| Button release             | Simulates releasing a button in a specific page/button on a controller. |
| Button Text Color          | Changes the color of text on button. |
| Button Background Color    | Changes the background color on button. |
| Rescan USB for devices     | Scans for any newly attached Stream Decks. |
| Abort all delayed actions  | Will cancel all delayed actions (those not yet started). |
| Kill Companion             | Shuts down Companion when its not responding. |
| Restart Companion          | Closes and restarts Companion. |



#### Instance feedback

Some modules are able to provide feedback back to the button, such as changing the button's foreground or background colors to reflect the current status of the device.

![Feedback](images/feedback.png?raw=true "Feedback")

The feedbacks can also be reordered by grabbing the sort icon next and dragging it up or down.



#### Dynamic variables

Some modules can expose their state through dynamic variables. If one of your modules supports this, those dynamic variables will be shown on the configuration page for that instance.

![Dynamic variables](images/dynamic-variables.png?raw=true "Dynamic variables")

To use a dynamic variable in a button, just copy/paste the variable into the button's label, or begin typing `$(` in the button's text to choose from a list of available dynamic variables.

![Dynamic variables usage](images/dynamic-variable-usage.png?raw=true "Dynamic variable usage")

The variables (and the button) will be updated when the device updates.

*A line break can be forced by putting `\n` where you want the line break to be.*



#### Button indicators

There are several button indicators you should be familiar with:

| Button                                                       | Description                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| ![Button latch off](images/button-latch-off.jpg?raw=true "Button latch off") | An unpressed button.                                         |
| ![Button error](images/button-error.jpg?raw=true "Button error") | One or more instances referenced in this button's actions are in an error state. |
| ![Button latch on](images/button-latch-on.jpg?raw=true "Button latch on") | The button was pressed (if shown briefly) or button is latched (see section above). |
| ![Button delay](images/button-delay.jpg?raw=true "Button delay") | There are delayed actions queued to run for this button.     |



- - - -
### 3. Surfaces
This tab will show the connected Elgato Stream Decks.

If any of your Stream Decks are not showing up, press the **Rescan USB** button. Use with care as rescanning will block all operations while the scan is ongoing.

**Important: If your devices are showing but they don't show the ID, you need to update your Stream Deck using the Elgato app**. See [Update instructions](https://github.com/bitfocus/companion/blob/master/documentation/Updating%20streamdeck.md).

![Devices](images/devices.png?raw=true "Devices")



#### Surface settings

Clicking the **Settings** button next to a device lets you change some things about how the Stream Deck operates:

- **Brightness**: The brightness of the buttons
- **Button rotation**: If you've physically rotated your Stream Deck, you can use this setting to make the buttons match that orientation.



### 4. Settings

In the Settings tab you can apply some user settings:



#### Navigation Buttons

- **Flip counting direction up/down**  
  When unchecked, pressing the **Page Up** button will increase to the next page (from page 2 to page 3). When checked, it will decrease to the previous page (from page 2 to page 1).

- **Show + and - instead of arrows on page buttons**  
  Changes the page buttons from the standard arrows symbols to + and - symbols instead.



#### Devices

- **Enable emulator control for Logitec R400/Mastercue/dSan**  
  A logitec R400/Mastercue/dSan will send a button press to button; 2 (Back), 3 (forward), 4 (black) and for logitec: 10/11 (Start and stop) on each page.  


#### PIN Lockout

- **Enable Pin Codes**  
  Allows Stream Deck devices to be locked out after a timeout and require a PIN to unlock.

- **Link Lockouts**  
  Locks out all Stream Decks when one is locked out.

- **Pin Code**  
  The PIN that needs to be entered to unlock the Stream Deck.

- **Pin Timeout (seconds, 0 to turn off)**  
  The number of seconds of inactivity before a Stream Deck locks. Enter `0` if you don't want it to lock out due to inactivity (instead, add an action to a button to trigger a lockout on demand).  


#### Artnet Listener

*If enabled, Companion will listen for Artnet messages, allowing for external devices to control Companion. An example GrandMA2 fixture file for controlling Companion can be found on the bottom of that tab.*

- **Artnet Listener**  
  Check to allow Companion to be controlled over Artnet.

- **Artnet Universe (first is 0)**  
  The Artnet universe Companion will listen on.

- **Artnet Channel**  
  The starting channel on the universe Companion listens to.  



#### TCP/UDP Remote Control

Companion can be controlled through TCP or UDP packets.

Remote triggering can be done by sending TCP (port `51234`) or UDP (port `51235`) commands.

**Commands**

- `PAGE-SET <page number> <surface id>`  
*Make device go to a specific page*
- `PAGE-UP <surface id>`  
*Page up on a specific device*
- `PAGE-DOWN <surface id>`  
*Page down on a specific surface*
- `BANK-PRESS <page> <bank>`  
*Press and release a button (run both down and up actions)*
- `BANK-DOWN <page> <bank>`  
*Press the button (run down actions)*
- `BANK-UP <page> <bank>`  
*Release the button (run up actions)*

**Examples**  
Set the emulator surface to page 23:  
`PAGE-SET 23 emulator`

Press page 1 bank 2  
`BANK-PRESS 1 2`



#### OSC Remote Control

Remote triggering can be done by sending OSC commands to port <code>12321</code>.

**Commands**

- `/press/bank/ <page> <bank>`  
*Press and release a button (run both down and up actions)*
- `/press/bank/ <page> <bank> <1>`  
*Press the button (run down actions and hold)*
- `/press/bank/ <page> <bank> <0>`  
*Release the button (run up actions)*
- `/style/bgcolor/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>`  
*Change background color of button*
- `/style/color/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>`  
*Change color of text on button*
- `/style/text/ <page> <bank> <text>`  
*Change text on a button*

**Examples**

Press button 5 on page 1 down and hold  
`/press/bank/1/5 1`

Change button background color of button 5 on page 1 to red  
`/style/bgcolor/1/5 255 0 0`

Change the text of button 5 on page 1 to ONLINE  
`/style/text/1/5 ONLINE`

- - - -

## Log
The Log section gives status updates of commands going out and coming back to Companion. Different log levels can be filtered.

Be sure to check here if you're running into problems with a module.



## Presets
Some modules come with pre-made buttons to speed up creating your pages.

![Presets](images/presets.png?raw=true "Presets")

If one of your modules supports presets, it will be listed in this tab for you to select.

Drag the preset buttons onto a page's button when in the Button Layout view. You may still need to configure the preset after adding it to a button.



## Import / Export
This tab lets you import or export your configuration to a `.companionconfig` file, which can be used to backup your configuration or move it to a new computer. You can also choose to import just a single page from your file.

You're also able to completely reset your configuration here as well.



- - - -

## Modules

All the instances in Companion are modules, and a module is what's used to control an external device or piece of software.

Modules are being added and updated all the time. A complete list of supported devices/modules can be found on the [Support List](https://bitfocus.io/support) page.



If your device or software is missing from this list, please [let us know](https://bitfocus.io/about#intouch), and we'll try to create support for it. If you're in a hurry and need express delivery, we'll get back to you with a price and delivery date. You can also [ask the open source community](https://github.com/bitfocus/companion/issues/new?template=feature_request.md) by submitting a feature request.

