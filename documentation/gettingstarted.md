# Getting started in Companion 1.1.1.



### This article is an introduction to Companion’s basic principles and user interface.
- - - -

### Before you open Companion
Connect your hardware and software you want to control.
Make sure you are in the same network with them.

### Starting the server
When you open Companion a server window will open.
From the opening view choose your network interface, and change the port if needed, the default is 8000. This is the port of the Companion server.

![Server](images/server.png?raw=true "Server")


Companion should be running on the same computer the streamdeck is connected, maximum of three units, the number might increase in future updates.
Companion can run on the same machine than Barco eventmaster or other control/playback software; it uses minimal resources.

If you need to remotely control companion from other computers in the network, use the URL under the text “Running”. Normally to configure Companion from the computer your running it click green “Launch GUI” button, it will open the Admin page in your default browser.

We recommende using Google Chrome

### The user interface / Admin GUI
- - - -
The main window is divided into three parts.
From left to right Community section, Main admin controls and Log
![Admin GUI](images/admingui.jpg?raw=true "Admin GUI")

## Community section with links
[Companion GitHub to report bugs.](https://github.com/bitfocus/companion/issues)
[Facebook group to share information and ask questions.](https://www.facebook.com/groups/2047850215433318/)
[The slack group for developers.](https://bit.ly/2IJ1jT4)
On top, there is also Elgato Emulator.

You can collapse the Community section by clicking the “burger icon” on the right of Companion logo.


### Elgato Emulator

Elgato emulator is a tool to test and use the setup even if you don’t have a streamdeck connected. It will open to a new tab on the browser and will function just like a stream deck would.

- - - -
## Main admin controls 
Here all the connections, buttons and actions are configured.
This section is divided into four tabs.

### Instances
From the Instances tab, you can add, edit and remove devices. You can also see if a device is connected from the Status column.

To add a new device, click on the [Add new instance] scroll down menu.
Choose the device you want to add.
Give the IP address of the device and apply changes.
Your new device should now show in the instances tab.
Add all the devices you want to control.
Each device needs to be a separate instance. If you have two separate Barco E2, you need to add both of them as a separate instance.

![Instance](images/instance.jpg?raw=true "Instance")


If something is missing, please make a support request on the ,[GitHub page by creating an issue/feature request](https://github.com/bitfocus/companion/issues)describing the feature, use cases and providing documentation, if needed for the implementation.


### Buttons
from the Buttons tab, you can add, edit and remove buttons for your stream deck.
Buttons layout has 99 pages that can be navigated from the blue top arrows left and right. Typing text on the field beside the page number can rename pages.

Making buttons.
First, make at least one instance.
Then click on the button you want to create on the grid.
Set button style from the green “Set button style” button.
There are three options,
“None” will disable the button.
“Text” will generate text to the button. 
“PNG image” will allow you to upload a 72x58px .png image to be used as a button and also lets you add text over the image.

Creating a text button.
Type button text to field, select alignment and font size. Text and background colour can also be changed.
Live preview of the button will be shown on the top right corner. Button information will update in real-time to Elgato emulator and stream deck.

![Button](images/button.jpg?raw=true "Button")

Add action to the button from the [Add new action for this button] drop-down menu.

You can add multiple actions and set delay times to each action. Delay times are in milliseconds. 1000ms = 1 second.

Creating a png button.
Make a 72x58px .png image
Click the blue Browse button and find the png file you want to use. The picture will appear on the top right preview of the button. Text can be applied over the image if wanted, and actions can be created the same way that to text only buttons.

### Devices
This tab will show the connected Elgato Streamdecks.
If your streamdecks are not showing, click on the blue Re-scan USB button. Use the re-scan button with care as re-scanning will block all operations while the scan is ongoing.

### User Config
On User Config tab you can change some of the preferences of the page up/down behaviour and symbols used.

- - - -

## Log on the right
On the Log segment right gives status updates of commands going out and coming back to Companion.
 could someone that knows better write something about the log 
Meaning of colours blue, grey, red





