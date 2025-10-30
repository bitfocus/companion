---
title: Triggers
sidebar_position: 4
---

In the Triggers tab, you can add, edit and remove triggers for your Companion Setup.

Triggers can provide an extra hand in making any setup more automated and allow for you to program some simple automation.

To add a new trigger, click the button **Add Trigger** and fill in the information mentioned below.

![Triggers](images/triggers.png?raw=true 'Triggers')

## Configuring

Once you add a trigger, it can be opened in the edit panel on the right.

When adding a new trigger, it starts off as disabled so that it doesn't get executed until you are ready for it.

To begin with you should give it a name, and fill in the other fields.

Triggers have 3 sections to configure

### Events

This defines when the trigger will be executed.  
 The trigger will be executed when any of these events occur.  
 Common events are **Time interval** and **On variable change**

![Events](images/triggers/events.png?raw=true 'Events')

### Condition

This allows you to apply a filter on the events.  
 For example, if using the **On variable change** event, you can use a condition to limit the trigger to execute only when the variable has a value of `1`.  
 This is a subset of the feedbacks that can be used on buttons.

![Condition](images/triggers/condition.png?raw=true 'Condition')

### Actions

This defines what will happen when the trigger executes and condition is met.  
 Every action that can be used on a button can also be used here. If you want, you can make it press a button using the 'internal: Press and release' action.

![Actions](images/triggers/actions.png?raw=true 'Actions')
