# Companion 2.2

This article is an introduction to Companion’s basic principles and user interface.

## Table of Content

- [Getting started](#header-getting-started)
  - [Before you open Companion](#header-before-you-open-companion)
  - [Start the server](#header-start-the-server)
  - [The user interface](#header-the-user-interface)
- [Sidebar](#header-sidebar)
  - [Community Links](#header-community-links)
  - [Emulator](#header-emulator)
  - [Web buttons](#header-web-buttons)
  - [Mobile buttons and New Web / Mobile buttons](#header-mobile-buttons-and-new-web--mobile-buttons)
- [Main admin controls](#header-main-admin-controls)
  - [1. Connections](#header-1-connections)
  - [2. Buttons](#header-2-buttons)
    - [Latch / Toggle](#header-latch--toggle)
    - [Delays](#header-delays)
    - [Key actions](#header-key-actions)
    - [Internal actions](#header-internal-actions)
    - [Instance feedback](#header-instance-feedback)
    - [Button indicators](#header-button-indicators)
  - [3. Surfaces](#header-3-surfaces)
    - [Surface settings](#header-surface-settings)
  - [4. Triggers](#header-4-triggers)
    - [Trigger Setup](#header-trigger-setup)
    - [Trigger Types](#header-trigger-types)
  - [5. Settings](#header-5-settings)
    - [Navigation Buttons](#header-navigation-buttons)
    - [Devices](#header-devices)
    - [PIN Lockout](#header-pin-lockout)
    - [RossTalk](#header-rosstalk)
    - [Artnet Listener](#header-artnet-listener)
  - [6. Log](#header-6-log)
- [Secondary admin controls](#header-secondary-admin-controls)
  - [1. Presets](#header-1-presets)
  - [2. Dynamic variables](#header-2-dynamic-variables)
  - [3. Import / Export](#header-3-import--export)
- [Remote Control](#header-remote-control)
  - [TCP / UDP Control](#header-tcp--udp-control)
  - [HTTP Remote Control](#header-http-remote-control)
  - [OSC Control](#header-osc-control)
  - [Artnet / DMX Control](#header-artnet--dmx-control)
  - [RossTalk Control](#header-rosstalk-control)
- [Modules](#header-modules)

## Getting started

### Before you open Companion

- Connect the hardware and software you want to control. Make sure you are on the same network as they are.
- In the Elgato Stream Deck app, make sure to firmware upgrade the Stream Deck to the latest version available.
- Close the Elgato Stream Deck app. Companion will not find your device if this is open.

### Start the server

When you open Companion, a server window will open. From the opening screen, choose your network interface and change the port if needed - the default is 8000. This is the port of the Companion server.

![Server](images/server.png?raw=true 'Server')

Companion should be running on the same computer that the Stream Deck is connected to. It can run on the same machine as, for example, Barco Event Master or other software for control/playback; it uses minimal resources.

If you need to remotely control Companion from other computers on the same network, use the URL under the text “Running”. Normally, to configure Companion from the computer you're running it on, click the **Launch GUI** button, it will open the Admin page in your default browser.

We recommend using Google Chrome.

### The user interface

The main window is divided into three sections. From left to right:

- Sidebar
- Main admin controls, settings, log and your Companion configuration
- Presets, Variables and Import/Export settings

![Admin GUI](images/admingui.png?raw=true 'Admin GUI')

## Sidebar

_You can collapse the sidebar by clicking the "burger" icon on the left of Companion logo, or shrink it by clicking the arrow at the bottom of the sidebar._

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

If you would like to just view one page or a select few, you can add text to the end of the URL in your browser. Just add **?pages=** and the page numbers you want to see separated by a comma. This works in all three **Web Buttons** layouts.

**Examples**

- http://127.0.0.1:8000/tablet.html?pages=2  
  _Includes only page 2_
- http://127.0.0.1:8000/tablet.html?pages=3,7,12  
  _Includes only pages 3, 7, and 12_

### Mobile buttons and New Web / Mobile buttons

**Mobile buttons and New Web / Mobile buttons** is a new alternative to the older **Web buttons** way of viewing all your buttons across all pages on a single screen, which may help you control Companion on a mobile device like a phone or tablet.

Please give all three a go and use what works best for you.

---

## Main admin controls

This is where all the connections, buttons, and actions are configured.
This section is divided into six tabs.

### 1. Connections

From the Connections tab, you can add, edit and remove devices. You can also see if a device is connected by looking at the Status column.

Press the question mark **"?"** icon to open that module's help information.

**To add a new device**

1.  Add a new device, by scrolling though the list or through a search.
2.  Choose the specific device you want to add.
3.  Enter the connection information for device. Apply the changes.

Your new device should now show in the Instances tab along with all the other devices you want to control.
Each device needs to be a separate instance. If you have two separate Barco E2, you need to add both of them as separate instances.

![Instance](images/instance.png?raw=true 'Instance')

After an instance has been created and successfully configured, it may provide you with a list of [Dynamic Variables](#header-dynamic-variables) you can use when configuring your button. This will be described below. **Please note** these have moved places since Companion 2.1.2, and they are now located in their own tab under **Buttons**

If something is missing, please make a support request on the [GitHub page by creating an issue/feature request](https://github.com/bitfocus/companion/issues) describing the feature, use cases, and providing documentation, if needed, for the implementation.

A full list of supported devices can also be found on our website. [Companion Module Support List](https://bitfocus.io/support)

---

### 2. Buttons

From the Buttons tab, you can add, edit and remove buttons for your Stream Deck.

The Buttons layout has 99 pages that can be navigated using the light grey left/right arrows. Give your pages a unique name by replacing the word _PAGE_ right next to the page number.

You can move to a specific page by clicking on the gray page number, entering in the desired page number, and pressing the ENTER key on your keyboard.

If you hold down the SHIFT key on your keyboard, you can trigger a button directly by clicking on it.

**Note** that the light grey outline shows the layout for the 15 buttons Streamdeck, and the six dark buttons in the middle match up with the nano Streamdeck.

![Instance](images/buttons.png?raw=true 'Buttons')

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
- Adding a PNG image (72x58px or 72x72px) to be used as a button's background. Text can added on top.
- Setting the alignment of the text.
- Setting the alignment of the PNG image.
- Changing the text's color.
- Changing the button's background color.
- Change whether it's a standard button or a [Latch / Toggle](#header-latch--toggle) button.
- Change whether to use absolute delays or [Relative Delays](#header-delays).

**Creating a button**

Enter your button's text in the **Button text** field, then select the alignment and font size. Text and background colors can also be changed.

You can force a newline in a label by typing `\n` where you want the newline to appear.

A live preview of the button will be shown on the top right corner. Button information will update in real-time in the Emulator and Stream Deck.

Add actions to the button from the **Add Press/on action** drop-down menu.

You can add multiple actions and set delay times for each action. Delay times are in milliseconds. 1000ms = 1 second.

![Button](images/button.png?raw=true 'Button')

**Creating a PNG button**

Make a 72x58px PNG image or use a 72x72px PNG, but it will get cropped to fit 72x58px by the topbar. Unless you disable the bar in the settings tab. See the [Settings](#header-5-settings) section below.

Click the red **Browse** button and choose the PNG file you want to use. The picture will appear on the top right preview of the button. Text can be applied over the image.

![Button with topbar](images/button-with-topbar.png?raw=true 'Button with topbar') ![Button without topbar](images/button-without-topbar.png?raw=true 'Button without topbar')  
_Same 72x72px image, but with and without the topbar_

#### Latch / Toggle

The **Latch/Toggle** checkbox changes the push behavior of the button, making the first press of the button trigger all the **Press/on** actions, and a second press of the button trigger the **Release/off** actions.

When a button is pressed and is latched, its header will appear solid.

![Button latch off with topbar](images/button-latch-off-with-topbar.png?raw=true 'Button latch off with topbar') ![Button latch on with topbar](images/button-latch-on-with-topbar.png?raw=true 'Button latch on with topbar')  
_Button latch off / on with topbar_

When the topbar is hidden and a button is pressed and is latched, its border will appear solid yellow.
Again see the [Settings](#header-5-settings) section below to change this.

![Button latch off without topbar](images/button-latch-off-without-topbar.png?raw=true 'Button latch off without topbar') ![Button latch on without topbar](images/button-latch-on-without-topbar.png?raw=true 'Button latch on without topbar')  
_Button latch off / on without topbar_

> **Example**: You have a projector and want to close its shutter when you press the button and then open the shutter when you press it a second time. To do this, first enable **Latch** on the button, then add a new action to close the shutter in the **Press/on** actions list, and the open shutter action to the **Release/off** action list.

#### Delays

Each action can be delayed to run a certain number of milliseconds after the button is triggered. Delays can be configured to be _Absolute_ (default) or _Relative_, by toggling the checkbox in the button styling section.

**Absolute Delays**

All actions run a certain number of milliseconds from the start of the button press. Actions without a delay start immediately. This is the default behavior.

![Absolute delays](images/delay-absolute.jpg?raw=true 'Absolute delays')

**Relative Delays**

Each action runs a certain number of milliseconds after the previous action _started_.

![Relative delays](images/delay-relative.jpg?raw=true 'Relative delays')

The order the actions are listed in matters when using relative delays. Actions can be reordered by grabbing the sort icon next to each action and dragging it up or down.

#### Key actions

These actions are performed when the button is pressed or depressed (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. An action may also have options to let you customize how the action performs.

**Note** Actions are executed in parallel. Companion does not know when the actions finish executing. Therefore when you have something that requires actions to be sent in the correct order, use small relative delays of 10-100ms on each action in order for them to be executed sequentially. The same often applies when many actions (often around five or more) are sent at once to a single device. Add the same kind of delay on every 3-5 action.

![Button actions](images/button-actions.png?raw=true 'Button Actions')

The **Press/On ACTIONS** will be performed when the button is triggered.

The **Release/Off ACTIONS** are performed when the button is released, _or_ when the button becomes unlatched.

#### Internal actions

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

#### Instance feedback

Some modules are able to provide feedback back to the button, such as changing the button's foreground or background colors to reflect the current status of the device.

![Feedback](images/feedback.png?raw=true 'Feedback')

The feedbacks can also be reordered by grabbing the sort icon next and dragging it up or down.

#### Button indicators

There are several button indicators you should be familiar with:

| Button                                                                                   | Description                                                                                                                 |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ![Button latch off](images/button-latch-off-with-topbar.png?raw=true 'Button latch off') | An unpressed button.                                                                                                        |
| ![Button error](images/button-error.png?raw=true 'Button error')                         | One or more instances referenced in this button's actions are in an error state.                                            |
| ![Button latch on](images/button-latch-on-with-topbar.png?raw=true 'Button latch on')    | The button was pressed (if shown briefly) or button is latched (see [Latch / Toggle](#header-latch--toggle) buttons above). |
| ![Button delay](images/button-delay.png?raw=true 'Button delay')                         | There are delayed actions queued to run for this button (see [Delays](#header-delays) above).                               |

---

### 3. Surfaces

This tab will show the connected Elgato Stream Decks.

If any of your Stream Decks are not showing up, press the **Rescan USB** button. Use with care as rescanning will block all operations while the scan is ongoing.

**Important: If your devices are showing but they don't show the ID, you need to update your Stream Deck using the Elgato app**. See [Update instructions](https://github.com/bitfocus/companion/blob/master/documentation/Updating%20streamdeck.md).

![Devices](images/devices.png?raw=true 'Devices')

#### Surface settings

Clicking the **Settings** button next to a device lets you change some things about how the Stream Deck operates:

- **Brightness**: The brightness of the buttons.
- **Button rotation**: If you've physically rotated your Stream Deck, you can use this setting to make the buttons match that orientation.
- **Page**: Sets the startup page on a surface but also changes the current page to match.

![Device Settings](images/device-settings.png?raw=true 'Device Settings')

---

### 4. Triggers

From the Triggers tab, you can add, edit and remove triggers for your Companion Setup.

Triggers can provide an extra hand in making any setup more automated and allow for you to program some simple automation based on time of day, intervals, variable state.

To add a new trigger, please click the button "Add New Trigger" and fill in the information mentioned below.

![Instance](images/triggers.png?raw=true 'Buttons')

#### Trigger Setup

All triggers have a few identical configuration fields that need to be filled out before they can be created.

- **Name**  
  An identifier for you has no direct purpose other than giving a quick way to identify one trigger from the rest.

- **Button**  
  This defines what button should be pressed when the condition below is met. The button is defined with the same syling as can be seen at the top of each button, with the page number first and the button number on that page after. A quick example could be with button 6 on page 1 becomes 1.6 , button 19 on page 3 becomes 3.19, and so on.

- **Type**  
  This specifies what type of condition should be met before the trigger presses the button selected above. Each trigger type will change what specific information will be needed for it to trigger the button press.

![Trigger Edit](images/trigger_edit.png?raw=true 'Trigger Edit')

There are several trigger types you should be familiar with:

#### Trigger Types

- **Instance**

  ![Trigger Instance](images/trigger_edit_instance_crop.png?raw=true 'Trigger Instance')  
  Allows automating based on Companion states. Here you have the options for the trigger to activate on startup, webpage load or when a button has been pressed down or released. |

- **Time Interval**

  ![Trigger Time Interval](images/trigger_edit_interval_crop.png?raw=true 'Trigger Time Interval')  
  Creates a Trigger that will get triggered every `X` seconds.

- **Time of day**

  ![Trigger Time Of Day](images/trigger_edit_time_of_day_crop.png?raw=true 'Trigger Time Of Day')  
  Creates a Trigger that will get triggered every `X` day at `Y` time. in this trigger, you will need to specify what time of day in the format, `HH:MM:SS` and you can choose at what day of the week it'll be active.

- **Variable value**

  ![Trigger Variable](images/trigger_edit_variable_crop.png?raw=true 'Trigger Variable')  
  Creates a Trigger that will get triggered every time a selected variable matches the condition or multiple conditions specified.

  To find the variable you want to use, go to the instance page and click edit on the module you want a variable from. Copy the variable and paste it into the text field. The variable will look something like this when you copy it `$(vmix:fullscreen_active)`, please remove `$( )`, and it should now look like in the picture.

  For each variable you add, you can perform some basic functions `=`, `!=`, `<` or `>`.

  And last, you need to specify what value to check for, so for my example, I would type in `True` or `False` based if it's on or off. You might want to specify a value based on a specific state, like what input is currently on program. To find the values do as before and copy the variables page's value to ensure it matches up correctly.

---

### 5. Settings

In the Settings tab, you can apply some user settings:

![Settings](images/settings.png?raw=true 'Settings')

##### Navigation Buttons

- **Flip counting direction up/down**  
  When unchecked, pressing the **Page Up** button will increase to the next page (from page 2 to page 3). When checked, it will decrease to the previous page (from page 2 to page 1).

- **Show + and - instead of arrows on page buttons**  
  Changes the page buttons from the standard arrows symbols to + and - symbols instead.

- **Remove the topbar on each button**  
  Hides the Yellow bar and the button number at the top of each button.

##### Devices

- **Enable emulator control for Logitec R400/Mastercue/dSan**  
  A logitec R400/Mastercue/dSan will send a button press to button; 2 (Back), 3 (forward), 4 (black) and for logitec: 10/11 (Start and stop) on each page.

##### PIN Lockout

- **Enable Pin Codes**  
  Allows Stream Deck devices to be locked out after a timeout and require a PIN to unlock.

- **Link Lockouts**  
  Locks out all Stream Decks when one is locked out.

- **Pin Code**  
  The PIN that needs to be entered to unlock the Stream Deck.

- **Pin Timeout (seconds, 0 to turn off)**  
  The number of seconds of inactivity before a Stream Deck locks. Enter `0` if you don't want it to lock out due to inactivity (instead, add an action to a button to trigger a lockout on demand).

##### RossTalk

_If enabled, Companion will listen for RossTalk messages, allowing for external devices to control Companion._

- **RossTalk Listener**  
  Check to allow Companion to be controlled over RossTalk.

##### Artnet Listener

_If enabled, Companion will listen for Artnet messages, allowing for external devices to control Companion. An example GrandMA2 fixture file for controlling Companion can be found on the bottom of that tab._

- **Artnet Listener**  
  Check to allow Companion to be controlled over Artnet.

- **Artnet Universe (first is 0)**  
  The Artnet universe Companion will listen on.

- **Artnet Channel**  
  The starting channel on the universe Companion listens to.

---

### 6. Log

The Log section gives status updates of commands going out and coming back to Companion. Different log levels can be filtered.

Use the three buttons to toggle warnings, info and debug on and off. Errors will always be displayed in the log, no matter the settings. Last, of all, you have the option to clear the current log history.

Be sure to check here if you're running into problems with a module.

![Log File](images/log.png?raw=true 'Log File')  
_An example of a log with everything enabled_

---

## Secondary admin controls

### 1. Presets

Some modules come with pre-made buttons to speed up creating your pages.

Presets works in a folder like structure where you first select the module, then a category, and last, you get a list of pre-made presets ready to be "drag and dropped" onto your pages.

If one of your modules supports presets, it will be listed in this tab for you to select, just like below.

![Preset Modules](images/preset-modules.png?raw=true 'Preset Modules')  
_An exsample of modules curently loaded with premade presets_

![Preset Folders](images/preset-folders.png?raw=true 'Preset Folders')  
_An example of categories of presets you might meet in a single module_

![Preset Buttons](images/preset-buttons.png?raw=true 'Preset Buttons')  
_Here is an example of presets made for mix 1 in vMix_

Drag the preset buttons onto a page's button when in the Button Layout view.  
Keep in mind you may still need to configure the preset after adding it to a button.

_**Note:** you can't add new presets as a user, they are all pre-made in code._

---

### 2. Dynamic variables

Some modules can expose their state through dynamic variables. If one of your modules supports this, it will show up in the variables tab. The picture below shows where the tab is located, and if one of your modules supports variables, it will be listed in this tab for you to select.

![Dynamic variables Tab](images/admingui-variables.png?raw=true 'Dynamic variables tab')

When a module is selected, you will get a complete list of available variables. All variables in the list will show their variable name/string, description and current value, and a button that `copies` the string for ease of use.

![Dynamic variables](images/dynamic-variables.png?raw=true 'Dynamic variables')

To use a dynamic variable in a button, just copy/paste the variable into the button's label, or begin typing `$(` in the button's text to choose from a list of available dynamic variables.

![Dynamic variables usage](images/dynamic-variable-usage.png?raw=true 'Dynamic variable usage')

The variables (and the button) will be updated when the device updates.

_A line break can be forced by putting `\n` where you want the line break to be._

---

### 3. Import / Export

This tab lets you import or export your configuration to a `.companionconfig` file, which can be used to backup your configuration or move it to a new computer. You can also choose to import just a single page from your file.

If you only want to export a single page, this can be done from the primary [buttons](#header-2-buttons) page via the `Export Page` button.

You're also able to completely reset your configuration here as well.

_**Note:** if you experience problems with importing a setup or a page, please try creating the required instances manually before importing. This has been known to fix imports with certain modules._

![Import](images/import.png?raw=true 'import')

---

## Remote Control

Companion can be remote controlled in several ways. Below you'll find how to do it.

##### TCP / UDP Control

Remote triggering can be done by sending TCP (port `51234`) or UDP (port `51235`) commands.

**Commands**

- `PAGE-SET <page number> <surface id>`  
  _Make device go to a specific page_
- `PAGE-UP <surface id>`  
  _Page up on a specific device_
- `PAGE-DOWN <surface id>`  
  _Page down on a specific surface_
- `BANK-PRESS <page> <bank>`  
  _Press and release a button (run both down and up actions)_
- `BANK-DOWN <page> <bank>`  
  _Press the button (run down actions)_
- `BANK-UP <page> <bank>`  
  _Release the button (run up actions)_
- `STYLE BANK <page> <bank> TEXT <text>`  
  _Change text on a button_
- `STYLE BANK <page> <bank> COLOR <color HEX>`  
  _Change text color on a button (#000000)_
- `STYLE BANK <page> <bank> BGCOLOR <color HEX>`  
  _Change background color on a button (#000000)_

**Examples**  
Set the emulator surface to page 23:  
`PAGE-SET 23 emulator`

Press page 1 bank 2:  
`BANK-PRESS 1 2`

##### HTTP Remote Control

Remote triggering can be done by sending `HTTP` Requests to the same IP and port Companion is running on.

**Commands**

- `/press/bank/<page>/<bank>`  
  _Press and release a button (run both down and up actions)_
- `/style/bank/<page>/<bank>?bgcolor=<bgcolor HEX>`  
  _Change background color of button_
- `/style/bank/<page>/<bank>?color=<color HEX>`  
  _Change color of text on button_
- `/style/bank/<page>/<bank>?text=<text>`  
  _Change text on a button_
- `/style/bank/<page>/<bank>?size=<text size>`  
  _Change text size on a button (between the predefined values)_

**Examples**  
Press page 1 bank 2:  
`/press/bank/1/2`

Change the text of button 4 on page 2 to TEST:  
`/style/bank/2/4/?text=TEST`

Change the text of button 4 on page 2 to TEST, background color to #ffffff, text color to #000000 and font size to 28px:  
`/style/bank/2/4/?text=TEST&bgcolor=%23ffffff&color=%23000000&size=28px`

##### OSC Control

Remote triggering can be done by sending OSC commands to port `12321`.

**Commands**

- `/press/bank/ <page> <bank>`  
  _Press and release a button (run both down and up actions)_
- `/press/bank/ <page> <bank> <1>`  
  _Press the button (run down actions and hold)_
- `/press/bank/ <page> <bank> <0>`  
  _Release the button (run up actions)_
- `/style/bgcolor/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>`  
  _Change background color of button_
- `/style/color/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>`  
  _Change color of text on button_
- `/style/text/ <page> <bank> <text>`  
  _Change text on a button_

**Examples**

Press button 5 on page 1 down and hold  
`/press/bank/1/5 1`

Change button background color of button 5 on page 1 to red  
`/style/bgcolor/1/5 255 0 0`

Change the text of button 5 on page 1 to ONLINE  
`/style/text/1/5 ONLINE`

##### Artnet / DMX Control

Please take a look at the attached files under settings for more information.

##### RossTalk Control

Remote triggering can be done by sending RossTalk commands to port `7788`.

**Commands**

- `CC <page>:<button>`  
  _Press and release button_

**Examples**

Press and release button 5 on page 2  
`CC 2:5`

---

## Modules

All the instances in Companion are modules, and a module is what's used to control an external device or piece of software. Modules can't be upgraded by the user after a release. Any update to a module will need a new build of Companion. Please look at the Beta builds to test newer versions of specific modules.

Modules are being added and updated all the time. A complete list of supported devices/modules can be found on the [Support List](https://bitfocus.io/support) page.

If your device or software is missing from this list, please [let us know](https://bitfocus.io/about#intouch), and we'll try to create support for it. If you're in a hurry and need express delivery, we'll get back to you with a price and delivery date. You can also [ask the open source community](https://github.com/bitfocus/companion/issues/new?template=feature_request.md) by submitting a feature request.
