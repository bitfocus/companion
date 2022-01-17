These actions are performed when the button is pressed or depressed (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. An action may also have options to let you customize how the action performs.

**Note** Actions are executed in parallel. Companion does not know when the actions finish executing. Therefore when you have something that requires actions to be sent in the correct order, use small relative delays of 10-100ms on each action in order for them to be executed sequentially. The same often applies when many actions (often around five or more) are sent at once to a single device. Add the same kind of delay on every 3-5 action.

![Button actions](images/button-actions.png?raw=true 'Button Actions')

The **Press/On ACTIONS** will be performed when the button is triggered.

The **Release/Off ACTIONS** are performed when the button is released, _or_ when the button becomes unlatched.