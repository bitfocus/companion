Steps is a new concept in 3.0, to allow for creating much more powerful and complex buttons. This replaces the **Latch** functionality that was possible in previous versions.

To start with steps, click the **Add step** tab on a button. You will now have a second tab of actions on the button

![Button Step 2](images/button-step2.png?raw=true 'Button Step 2')

Now when you press the button, on the first press it will execute the actions from **Step 1**, the following press with execute the actions from **Step 2**. It will keep on cycling through between the two.

You can add as many steps as you like to a button, depending on your use case.

Sometimes you don't want it to progress between steps automatically like this. You can disable this with the **Progress** option in the button configuration further up. Instead you can use the internal actions to change the step of the button.
With this, you can do complex scenarios like shift layers where holding one button will change other buttons to step 2, and switch back to 1 upon release.

> **Example**: You have a projector and want to close its shutter when you press the button and then open the shutter when you press it a second time. To do this, add an action to close the shutter in the **Step 1** **Press actions** list, and the open shutter action to the **Step 2** **Release actions** list.
