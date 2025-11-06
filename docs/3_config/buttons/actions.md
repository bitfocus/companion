These actions define the behaviour of the button when it is pressed or depressed (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. Most actions have options to let you customize how it performs.

![Button actions](images/button-actions.png?raw=true 'Button Actions')

To add an action to a button, you can either search in the box below, or click the folder button to bring up a more detailed view of all the actions available.

Companion has various built-in actions which you can use, as well as those provided by the modules.

Each button has multiple groups of actions that can be executed

The **Press actions** will be performed when the button is pressed or triggered.

The **Release actions** are performed when the button is released.

It is also possible to add some timed groups, to allow for long presses. You can add one with the **Add duration group** button.  
Once added you can edit the time of that group and whether it executed upon release or while being held.

When there is a duration group added, the **Release actions** becomes **Short release actions**, and will only be executed when released before the first duration group time is reached.

Starting in Companion 3.5, the delays have been replaced with a new **internal: Wait** Action. This will delay all actions that follow it in the list.  
Actions at the root level get executed in the **Concurrent** mode described below.

To allow for more complex setups and customisability, there is also a new **internal: Action Group** action.  
This action acts as a group that can contain other actions, including other **Action Group**

These groups have a few modes of execution

- **Inherit** follows the mode of the parent group
- **Concurrent** this is equivalent to previous releases of Companion, with **Absolute Delays** enabled.  
  In this mode, the actions get executed in parallel, broken up between any **internal: Wait** actions.
- **Sequential** In this mode, the actions get executed in order, waiting for the previous one to complete execution before starting the next.
  Not every module implementats actions in a way that lets Companion know that execution has completed, but many do.  
  This allows for programming complex sequences that must be done in a particular order without relying on small delays

![Action Group Sequential](images/action-group-sequential.png?raw=true 'Action Group Sequential')
