These actions define the behaviour of the button when it is pressed or depressed (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. Most actions have options to let you customize how it performs.

**Note** Actions are executed in parallel. Companion does not know when the actions finish executing. Therefore when you have something that requires actions to be sent in the correct order, use small relative delays of 10-100ms on each action in order for them to be executed sequentially. The same often applies when many actions (often around five or more) are sent at once to a single device. Add the same kind of delay on every 3-5 action.

![Button actions](images/button-actions.png?raw=true 'Button Actions')

To add an action to a button, you can either search in the box below, or click the folder button to bring up a more detailed view of all the actions available.

Companion has various built-in actions which you can use, as well as those provided by the modules.

Each button has multiple groups of actions that can be executed

The **Press actions** will be performed when the button is pressed or triggered.

The **Release actions** are performed when the button is released.

It is also possible to add some timed groups, to allow for long presses. You can add one with the **Add duration group** button.  
Once added you can edit the time of that group and whether it executed upon release or while being held.  

When there is a duration group added, the **Release actions** becomes **Short release actions**, and will only be executed when released before the first duration group time is reached.


Within each group of actions, each action can be delayed to run a certain number of milliseconds after the button is triggered. Delays can be configured to be _Absolute_ (default) or _Relative_, by toggling the checkbox in the button styling section.

**Absolute Delays**

All actions run a certain number of milliseconds from the start of the button press. Actions without a delay start immediately. This is the default behavior.

![Absolute delays](images/delay-absolute.jpg?raw=true 'Absolute delays')

**Relative Delays**

Each action runs a certain number of milliseconds after the previous action _started_.

![Relative delays](images/delay-relative.jpg?raw=true 'Relative delays')

The order the actions are listed in matters when using relative delays. Actions can be reordered by grabbing the sort icon next to each action and dragging it up or down.