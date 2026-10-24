---
title: Link
sidebar_position: 3.5
description: Link Companion installations together, to show and press each other's buttons.
---

Companion Link connects Companion installations together, so that one can show and press the buttons of another. For example, a surface at a second desk can show buttons that are set up on the main machine, and pressing them runs their actions there.

Each installation decides what the others may use. Nothing is shared until you say so.

## Linking two installations

Installations reach each other over **transports**, which you find on the **Transports** tab of the **Link** page. Today there is one kind: a direct connection over the network.

1. On the installation to connect to, check that **Companion Link** is switched on in **Settings > Protocols**. It is on by default, and listens on port 16624.
2. On the other installation, open **Link > Transports**, click **Add Transport** and choose **Direct connection**. Pick the installation from the list of those found on the network, or choose **Manual** and enter its address (eg `192.168.1.10`, or `192.168.1.10:1234` for another port).
3. The new transport shows a **pairing code**. On the installation you are connecting to, a pairing request appears under **Incoming direct connections** on the **Transports** tab of its Link page, and the Link menu entry shows a count. Enter the code there and click **Pair**.

Pairing is only needed once. After that, the two reconnect by themselves whenever they can reach each other.

Both ends show the other's **Link id** while pairing: a short code such as `abcd-EF01-2345-6789` that identifies an installation. Each installation shows its own under **This installation** on the **Installations** tab of its Link page. If the Link id shown while pairing is not the one the other installation shows for itself, something else is answering: reject the request.

A pairing request is rejected after a few wrong codes. To pair again later, for example after an installation was reset, remove the pairing on both ends (**Forget pairing** on the Direct connection, **Unpair** under Incoming direct connections) and start again.

:::tip
For installations on different networks, connect them over a VPN. Don't expose the Link port to the internet.
:::

## Sharing

Once two installations are linked, each is listed on the other's **Installations** tab. Select one to see:

- its **Status**: whether it is reachable, over which transports, and how quickly it answers
- **Sharing**: what you let it use (**We share**), and what it lets you use (**They share**), with how much of it is in use

Turn on **Buttons** under **We share** to let the other installation show and press your buttons. This is all or nothing: it can show and press any button, on any page. Turn it off at any time, and anything it is holding down is released.

You can also give an installation a **Name** of your own, which is used here in place of the name it gives itself. That is useful when several have the same name.

**Forget** removes an installation from the list. It comes back if it is still reachable.

## Remote buttons

A **remote button** shows a button of another installation, and presses it when it is pressed. Create one from an empty button by choosing **Remote button**, then choose:

- **Installation**: the installation to show a button of
- **Button location**: where the button is on that installation, as page/row/column (eg `2/0/3`). `this` means the same location as the remote button itself. Variables can be used.

The quickest way to place remote buttons is from the **Presets** tab of the Buttons page. Below the connections, **Other installations** lists the installations that share their buttons with this one. Choose one to see its pages laid out as they are there, and drag a button onto the grid.

The other installation draws the button at the size it is shown here, so it stays sharp on any surface. The top bar and status icons are drawn here, with this button's own **Decoration** and **Status icons** settings, and a link icon in the top bar marks it as a remote button. The link turns red while the other installation can't be reached, and the last image is kept for a short while in case it comes back.

When a remote button can't show anything, it says why:

| Shown               | Meaning                                                                                                    |
| ------------------- | ---------------------------------------------------------------------------------------------------------- |
| Remote button       | No installation or location has been chosen yet                                                            |
| Remote bad location | The location isn't a valid button location                                                                 |
| Unknown remote      | The installation hasn't been found on any transport                                                        |
| Remote incompatible | The installation runs a version of Companion that can't be linked with this one                            |
| Remote offline      | The installation can't be reached right now                                                                |
| Remote not shared   | The installation doesn't share its buttons with this one. Turn on **Buttons** sharing on that installation |
| Remote busy         | The installation is already sending as many buttons as it can                                              |
| Loading…            | Waiting for the first image                                                                                |
| ∞                   | The button leads back to itself through other installations                                                |

The button editor explains each of these, and what to do about it.

Remote buttons can be chained: a remote button can show a button that is itself a remote button of a third installation.

## Changing the Link id

The Link id of an installation is generated the first time Companion starts. If a copy of an installation has been made, for example by cloning its disk, both copies have the same Link id and are taken for one installation. Companion warns about this on the Link page when it notices it. Regenerate the Link id of one of them from **This installation** on the **Installations** tab of its Link page. The installations it was paired with then need to pair with it again, and remote buttons on them that show it need to be edited to choose it again.
