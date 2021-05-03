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
