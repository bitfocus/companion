---
title: Actions
sidebar_position: 3
description: Define button behavior with press, release, and duration actions.
slug: /config/buttons/creating/actions
---

The actions define the behaviour of the button when it is pressed or released (or when triggered externally).

Multiple actions, even those from multiple modules, can be linked to a button. Most actions have options to let you customize how it performs.

![Button actions](images/button-actions.png 'Button Actions')

To add an action to a button, you can either search in the box below, or click the folder button to bring up a more detailed view of all the actions available.

Companion has various built-in actions which you can use, as well as those provided by the modules.

Each button has multiple groups of actions that can be executed

The **Press actions** will be performed when the button is pressed or triggered.

The **Release actions** are performed when the button is released.

It is also possible to add some timed groups, to allow for long presses. You can add one with the **Add duration group** button.  
Once added you can edit the time of that group and whether it executed upon release or while being held.

When there is a duration group added, the **Release actions** becomes **Short release actions**, and will only be executed when released before the first duration group time is reached.

## Surface cues

Some surfaces can let you feel or see that a press did something, for example with a short haptic click. Companion tells the surface when a press on it runs actions, and the surface decides how to show it. Surfaces that can't show a cue ignore it.

- A press sends one cue, when its **Press actions** or **Release actions** run, whichever comes first.
- A duration group set to execute while held sends another cue each time it runs. Duration groups that run on release don't send a cue yet.
- Only presses made on the surface itself send a cue. Presses from triggers, the web buttons, or other APIs don't.
- A group with no enabled actions sends nothing.

The cue is on for every group by default. To turn it off for one group, click the pencil button on that group and untick **Surface cue**.

## Execution order

The actions of a button, and of a trigger, start together: Companion doesn't wait for one action to finish before starting the next. This is called **Concurrent** mode.

The exception is the **internal: Wait** action. The actions after a Wait are held back until it is over, so you can use it to space out a sequence.

To run actions strictly one after another, put them inside an **internal: Action Group** set to **Sequential**. Each action then waits for the one before it to finish. Not every module lets Companion know when one of its actions has finished, but many do. This lets you build sequences which must happen in a particular order, without relying on short waits.

An **Action Group** has three modes:

- **Concurrent**: its actions start together, held back by any Wait actions.
- **Sequential**: its actions run one at a time, in order.
- **Inherit**: it uses the mode of the group it is in. At the top level of a button or trigger, that is Concurrent.

Groups can be put inside each other. The actions inside a **Logic: If statement** or **Logic: While loop** use the mode of the place the If statement or While loop is in.

![Action Group Sequential](images/action-group-sequential.png 'Action Group Sequential')

## Conditional actions and loops

The **Logic: If statement** action runs its **Then** actions only when all of its **When True** conditions are
true, and its **Else** actions otherwise. The **Logic: While loop** action repeats its actions for as long as all
of its **While True** conditions are true.

The conditions are feedbacks. The built-in (internal) feedbacks in these conditions are
checked at the moment the action runs, rather than using a value which was calculated earlier. This means:

- they see variable values as they are right now, including values changed by actions which ran just before
  them. A **While loop** checks the latest values on every repeat, so the actions inside it can change the
  variable which ends the loop.
- they can use the details of what caused the actions to run, such as `$(this:surface_id)` for the surface
  which was pressed, or `$(this:delta)` inside a rotary action.

Feedbacks from connections can also be used as conditions, but they still use the most recent value reported
by the connection.

:::tip
Put a **Wait** action inside a **While loop**. Without one, the loop repeats as fast as it can, up to hundreds of
times a second, which can use a lot of CPU and flood your devices with commands. Waiting even a short time, such
as 100ms, between repeats is usually plenty.
:::

## Storing an action's result

Some module actions return a result — for example fetching a value from a device, or running a query.
For these actions you'll see a **Store Action Result** option, which lets you capture that result for
use elsewhere instead of discarding it.

You can store the result into:

- a **Local variable** — choose a button location (such as `$(this:page)/$(this:row)/$(this:column)`
  for this button) and the local variable name to write to,
- a **Page variable** — choose a page and the [page variable](../pages.md#page-variables) name to write
  to, or
- a **Custom variable** — choose an existing [custom variable](../../variables.md#custom-variables),
  with an option to create it if it doesn't exist yet.

Choose **&lt;discard&gt;** if you don't need the result.

Once stored, the value is just a normal variable you can reference in button text, feedbacks or other
actions. This only appears on actions that actually return a result; most actions don't.

{/* Future: a screenshot would be good here */}
