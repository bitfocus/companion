# Companion 1.3
This article is an introduction to Companion’s basic principles and user interface.



## Getting started

### Before you open Companion
  * Connect the hardware and software you want to control. Make sure you are on the same network as they are.
  * In the original Elgato Stream Deck app, make sure to firmware upgrade the Stream Deck to the latest version available.
  * Close the original Elgato Stream Deck app. Companion will not find your device if this is open.



### Start the server

When you open Companion, a server window will open. From the opening screen, choose your network interface and change the port if needed - the default is 8000. This is the port of the Companion server.

![Server](images/server.png?raw=true "Server")


Companion should be running on the same computer that the Stream Deck is connected to. It can run on the same machine as, for example, Barco Event Master or other software for control/playback; it uses minimal resources.

If you need to remotely control Companion from other computers on the same network, use the URL under the text “Running”. Normally, to configure Companion from the computer you're running it on, click the green “Launch GUI” button, it will open the Admin page in your default browser.

We recommend using Google Chrome.




### The user interface
The main window is divided into three sections. From left to right:

- Community section
- Main admin controls
- Log

![Admin GUI](images/admingui.jpg?raw=true "Admin GUI")



## Community section

[Companion GitHub to report bugs.](https://github.com/bitfocus/companion/issues)

[Facebook group to share information and ask questions.](https://www.facebook.com/groups/2047850215433318/)

[The Slack group for developers.](https://bit.ly/2IJ1jT4)

[Donate to show your support and fund future development.](https://donorbox.org/bitfocus-opensource)

You can collapse the Community section by clicking the “burger” icon on the right of Companion logo, or shrink it by clicking the arrow at the bottom of the Community section.




### Elgato Emulator
Elgato Emulator is a tool to test and use the setup, even if you don’t have a Stream Deck connected. It will open in a new browser tab and will function just like a Stream Deck would.



### Web Buttons

Web Buttons is a way of viewing all your buttons across all pages on a single screen, which may be useful if you want to use a web browser on a tablet to control Companion.

If you would like to just view one page or a select few, you can add a little text to the end of the URL in your browser. Just add **?pages=** and the page numbers you want to see separated by a comma.

**Examples**

- http://10.30.4.60:8000/tablet.html?pages=2  
	*View only page 2*

- http://10.30.4.60:8000/tablet.html?pages=3,7,12  
	*View only pages 3, 7, and 12*


- - - -
## Main admin controls
This is where all the connections, buttons, and actions are configured.
This section is divided into four tabs.

### 1. Instances
From the Instances tab, you can add, edit and remove devices. You can also see if a device is connected by looking at the Status column.

**To add a new device**

 1. Add a new device, either by finding it by category, by manufacturer, or through a search.
 2. Choose the specific device you want to add.
 3. Enter the connection information for device. Apply the changes.

Your new device should now show in the instances tab along with all the other devices you want to control.
Each device needs to be a separate instance. If you have two separate Barco E2, you need to add both of them as separate instances.

![Instance](images/instance.jpg?raw=true "Instance")

After an instance has been created and successfully configured, it may provide you with a list of Dynamic Variables you can use when configuring your button. This will be described below.

If something is missing, please make a support request on the [GitHub page by creating an issue/feature request](https://github.com/bitfocus/companion/issues) describing the feature, use cases, and providing documentation, if needed, for the implementation.



- - - -

### 2. Buttons
From the Buttons tab, you can add, edit and remove buttons for your Stream Deck.

The Buttons layout has 99 pages that can be navigated using the blue left/right arrows. Give your pages a unique name by replacing the word *PAGE* right next to the page number.



**Making buttons**

1. First, make at least one instance.
2. Click on the button you want to create on the grid.
3. Set the button style using the green **Set button style** option.
4. Add Actions to the button.



There are three button style options:

- “None” will disable the button.

- “Text” will generate text for the button.

- “PNG image” will allow you to upload a 72x58px .png file to be used as a button image - you can also add text over the image.



**Creating a text button**

Enter your desired button text in the **Button text** field, then select the alignment and font size. Text and background colour can also be changed.

You can force a newline in a label by typing `\n` where you want the newline to appear.

A live preview of the button will be shown on the top right corner. Button information will update in real-time to Elgato Emulator and Stream Deck.

Add actions to the button from the **Add key down/on action** drop-down menu.

You can add multiple actions and set delay times for each action. Delay times are in milliseconds. 1000 ms = 1 second.

![Button](images/button.jpg?raw=true "Button")



**Creating a PNG button**

Make a 72x58px .png image.

Click the blue **Browse** button and find the PNG file you want to use. The picture will appear on the top right preview of the button. Text can be applied over the image. Actions for PNG buttons are created in the same way as text-only buttons.



#### Latch/Toggle

The latch checkbox changes the push behavior of the button, making the first press of the button trigger all the **Key down/on** actions, and a second press of the button trigger the **Key up/off** actions.

When a button is pressed and is latched, its header will appear solid.

![Button latch off](images/button-latch-off.jpg?raw=true "Button latch off") ![Button latch on](images/button-latch-on.jpg?raw=true "Button latch on")  
*Button latch off / on*

> Example: You have a projector and want to close its shutter when you press the button and then open the shutter when you press it a second time. To do this, first enable **Latch** on the button, then add a new action to close the shutter in the **Key down/on** actions list, and the open shutter action to the **Key up/off** action list.



#### Delays

Each action can be delayed to run a certain number of milliseconds after the button is triggered. Delays can be configured to be *Absolute* (default) or *Relative*, by toggling the checkbox in the button styling section.

**Absolute Delays**

All actions run a certain number of milliseconds from the start of the button press. Actions without a delay start immediately. This is the default behaviour.

![Absolute delays](images/delay-absolute.jpg?raw=true "Absolute delays")



**Relative Delays**

Each action runs a certain number of milliseconds after the previous action *started*.

![Relative delays](images/delay-relative.jpg?raw=true "Relative delays")

The order the actions are listed in matters when using relative delays. Actions can be reordered by grabbing the sort icon next to each action and dragging it up or down.



#### Key actions

These actions are performed when the button is pressed or depressed (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. An action may also have options to let you customize how the action is to be performed.

![Button actions](images/button-actions.jpg?raw=true "Button Actions")

The **Key down/on actions** will be performed when the button is triggered.

The **Key up/off actions** are performed when the button is released, *or* when the button becomes unlatched.



#### Internal actions

There are several internal actions you can add to a button in order to control Companion:

|Action  | Description |
| -------------------------- | ---- |
| Enable or disable instance | Allows you to enable or disable a specific instance of a module. |
| Set surface to page        | Changes a surface/controller (Stream Deck or emulator) to a specific page. |
| Trigger a device lockout   | Locks out selected streamdeck immediately. |
| Trigger a device unlock    | Locks out selected streamdeck immediately. |
| Run shell path             | Runs a shell command locally. |
| Trigger all devices to unlock immediately   | Unlocks all streamdecks immediately. |
| Trigger all devices to lock immediately   | Locks all streamdecks immediately. |
| Increment page number      | Increments the page number of a surface. |
| Decrement page number      | Decrements the page number of a surface. |
| Button press and release   | Simulates a button press in a specific page/button on a controller. |
| Button press               | Simulates holding a button down in a specific page/button on a controller. |
| Button release             | Simulates releasing a button in a specific page/button on a controller. |
| Button Text Color          | Changes the color of text on button. |
| Button Background Color    | Changes the background color on button. |
| Abort all delayed actions  | Will cancel all delayed actions (those not yet started). |
| Kill Companion             | Shuts down Companion when its not responding. |
| Restart Companion          | Closes and restarts Companion. |



#### Instance feedback

Some modules are able to provide feedback back to the button, such as changing the button's foreground or background colors to reflect the current status of the device.

![Feedback](images/feedback.jpg?raw=true "Feedback")

The feedbacks can also be reordered by grabbing the sort icon next and dragging it up or down.



#### Dynamic variables

Some modules can expose their state through dynamic variables. If one of your modules supports this, they will be displayed on the configuration page for that instance.

![Dynamic variables](images/dynamic-variables.jpg?raw=true "Dynamic variables")

To use a dynamic variable in a button, just copy/paste the variable into the button's label.

![Dynamic variables usage](images/dynamic-variable-usage.jpg?raw=true "Dynamic variable usage")

The variables (and the button) will be updated when the device updates.

*A newline can be forced by putting `\n` where you want the newline to be.*



#### Button indicators

There are several button indicators you should be familiar with:

| Button                                                       | Description                                                  |
| ------------------------------------------------------------ | ------------------------------------------------------------ |
| ![Button latch off](images/button-latch-off.jpg?raw=true "Button latch off") | An unpressed button.                                         |
| ![Button error](images/button-error.jpg?raw=true "Button error") | One or more instances referenced in this button's actions are in an error state. |
| ![Button latch on](images/button-latch-on.jpg?raw=true "Button latch on") | The button was pressed (if shown briefly) or button is latched (see section above). |
| ![Button delay](images/button-delay.jpg?raw=true "Button delay") | There are delayed actions queued to run for this button.             |



- - - -
### 3. Surfaces
This tab will show the connected Elgato Stream Decks.
If any of your Stream Decks are not showing up, click [Rescan USB]. Use the rescan button with care as rescanning will block all operations while the scan is ongoing.

**Important. If your devices are showing but they don't show the ID, you need to update your Stream Deck using the Elgato app**. See [Update instructions](Updating%20streamdeck.md).

![Devices](images/devices.jpg?raw=true "Devices")



#### Surface Settings

Clicking the **Settings** button next to a device lets you change some things about how the Stream Deck operates:

- Brightness: The brightness of the buttons
- Button rotation: If you've physically rotated your Stream Deck, you can use this setting to make the buttons match that orientation.



### 4. Settings

In the Settings tab you can apply some user settings:



#### Flip counting direction up/down

When unchecked, pressing the **Page Up** button will increase to the next page (from page 2 to page 3). When checked, it will decrease to the previous page (from page 2 to page 1).



#### Show + and - instead of arrows on page buttons

Changes the page buttons from the standard arrows symbols to + and - symbols instead.



#### Artnet

If enabled, Companion will listen for Artnet messages, allowing for external devices to control Companion. An example GrandMA2 fixture file for controlling Companion can be found on that tab.



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

#### OSC Remote control

Remote triggering can be done by sending OSC commands to port <code>12321</code>.</p>

**Commands**

- /press/bank/ <page> <bank>
*Press and release a button (run both down and up actions)*
- /press/bank/ <page> <bank> <1>
*Press the button (run down actions and hold)*
- /press/bank/ <page> <bank> <0>
*Release the button (run up actions)*
- /style/bgcolor/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>
*Change background color of button*
- /style/color/ <page> <bank> <red 0-255> <green 0-255> <blue 0-255>
*Change color of text on button*
- /style/text/ <page> <bank> <text>
*Change text on a button*


**Examples**

Press button 5 on page 1 down and hold
/press/bank/1/5 1

Change button background color of button 5 on page 1 to red
/style/bgcolor/1/5 255 0 0

Change the text of button 5 on page 1 to ONLINE
/style/text/1/5 ONLINE

- - - -

## Log
The Log section gives status updates of commands going out and coming back to Companion. Be sure to check here if you're running into problems with a module.



## Presets
Some modules come with pre-made buttons to speed up creating your pages.

![Presets](images/presets.jpg?raw=true "Presets")

If one of your modules supports presets, it will be listed in this tab for you to select.

Once opened, just drag the preset buttons onto a page's button when in the Button Layout view.



## Import / Export
This tab lets you import or export your configuration to a `.companionconfig` file, which can be used to backup your configuration or move it to a new computer. You can also choose to import just a single page from your file.

You're also able to completely reset your configuration here as well.



- - - -

## Modules

All the instances in Companion are modules, and a module is what's used to control an external device or piece of software.

Here's a partial list of some the included modules:
* **GrandMA2** (MA Lighting) v1.0.0 *by William Viker*
* **AMP** (Grass Valley) v1.0.0 *by Håkon Nessjøen*
* **ATEM** (Blackmagic Design) v1.0.1 *by Håkon Nessjøen*
* **AV-HS50 / AV-HS410** (Panasonic) v1.0.0 *by Håkon Nessjøen*
* **AV-Playback** (if-else{Ware}) v1.0.0 *by Per Røine*
* **AVB** (MOTU) v1.0.0 *by Per Røine*
* **App** (Octopus) v1.0.0 *by Per Røine*
* **Arena** (Resolume) v1.0.0 *by Oliver Herman*
* **Countdown Timer** (Irisdown) v1.0.1 *by Per Røine*
* **DCS 100/200** (Barco) v1.0.0 *by Per Røine*
* **Delta Media Server** (7thSense Design) v1.0.0 *by Per Røine*
* **EKS 500** (Analog Way) v1.0.0 *by Adrian Davis*
* **Encore** (Barco) v1.0.0 *by William Viker*
* **Event Master XML version** (Barco) v1.0.0 *by Jeffrey Davidsz*
* **Event Master** (Barco) v1.0.0 *by William Viker*
* **HELO** (AJA) v1.0.1 *by Casey Selph*
* **HIGHlite** (Digital Projection) v1.0.0 *by Per Røine*
* **HTTP Requests** (Generic) v1.0.0 *by William Viker*
* **Hog 4** (High End Systems) v1.0.0 *by Per Røine*
* **Horae** (Sononum) v1.0.0 *by Daniel Richert*
* **Hyperdeck** (Blackmagic Design) v1.0.0 *by Per Roine*
* **ImagePro** (Barco) v1.0.0 *by Per Røine*
* **Ki Pro Ultra** (AJA) v1.0.0 *by Per Røine*
* **LW2** (Lightware) v1.0.1 *by Håkon Nessjøen*
* **LW3** (Lightware) v1.0.0 *by Håkon Nessjøen*
* **Listener** (Octopus) v1.0.0 *by Jeffrey Davidsz*
* **MRP / Multicon** (Nevion) v1.0.0 *by William Viker*
* **MagicQ (UDP)** (ChamSys) v1.0.0 *by Per Røine*
* **MagicQ** (ChamSys) v1.0.0 *by Per Røine*
* **Media Server** (Modulo) v1.0.0 *by Per Røine*
* **Midra, Eikos2, Saphyr, Pulse2, SmartMatriX2, QuickMatriX, QuickVu (Analog Way) v1.0.0 *by Dorian Meid*
* **Millumin 2** (Anomes) v1.0.0 *by Per Røine*
* **Mitti** (Imimot) v1.0.0 *by Per Røine*
* **Multi Transport Control** (disguise) v1.0.0 *by William Viker*
* **Multiview 4** (Blackmagic Design) v1.2.0 *by Per Røine*
* **OSC Control** (disguise) v1.0.0 *by William Viker*
* **OSC** (Generic) v1.0.0 *by William Viker*
* **PDS** (Barco) v1.0.0 *by Dorian Meid*
* **PLS 300** (Analog Way) v1.0.1 *by Tyler Krupa*
* **PVP 3** (Renewed Vision) v1.0.0 *by Per Røine*
* **Photon** (VYV) v1.0.0 *by Per Roine*
* **PlaybackPro Plus** (DT Videolabs) v1.0.0 *by Per Røine*
* **ProPresenter** (Renewed Vision) v2.1.0 *by Oliver Herrmann*
* **Projector** (Christie) v1.0.0 *by Per Røine*
* **Projector** (PJLink) v1.0.0 *by Per Roine*
* **QLab** (Figure 53) v1.0.0 *by Per Røine*
* **REAPER** (cockos) v1.0.0 *by Oliver Herman*
* **Remote Show Control** (Irisdown) v1.0.0 *by Per Røine*
* **Rosstalk** (Ross Video) v1.2.1 *by William Viker*
* **SCS** (Show Cue Systems) v1.0.0 *by Per Røine*
* **SS-CDR250N / SS-R250N** (Tascam) v1.0.0 *by Håkon Nessjøen*
* **Sender** (Art-Net) v1.0.0 *by Håkon Nessjøen*
* **Server** (CasparCG) v1.0.0 *by Håkon Nessjøen*
* **SmartView/SmartScope** (Blackmagic Design) v1.0.0 *by Per Roine*
* **Spyder X20/X80** (Christie) v1.0.0 *by Per Røine*
* **StageTimer2** (Neodarque) v1.0.1 *by Jeffrey Davidsz*
* **Studio** (OBS) v1.0.0 *by William Viker*
* **VIO 4K** (Analog Way) v1.0.0 *by Dorian Meid*
* **VISCA** (PTZoptics) v1.0.0 *by Håkon Nessjøen*
* **VISCA** (Sony) v1.2.1 *by Per Røine*
* **VLC** (VideoLAN) v1.0.0 *by Håkon Nessjøen*
* **VP-747** (Kramer) v1.0.0 *by Per Røine*
* **Videohub** (Blackmagic Design) v1.0.2 *by William Viker*
* **Watchout Production** (Dataton) v1.0.0 *by Dorian Meid*
* **X32/M32** (Behringer/Midas) v1.0.0 *by Per Roine*
* **XR/MR** (Behringer/Midas) v1.0.0 *by Per Roine*
* **iTach IP2CC** (Global Cache) v1.0.0 *by Casey Selph*
* **iTach IP2IR** (Global Cache) v1.0.0 *by Casey Selph*
* **iTach IP2SL** (Global Cache) v1.0.0 *by Casey Selph*
* **vMix** (StudioCoast) v1.0.0 *by Per Røine*
