---
title: Action Recorder
sidebar_position: 10
description: Record actions onto buttons
---

The Action Recorder lets you build up a list of actions on a button by performing operations directly on a connected device (such as changing inputs on a switcher) rather than adding each action manually.

:::note
Very few modules currently support the Action Recorder. Whether your connection supports it depends on the module — check the module's documentation or presets for guidance.
:::

## Using the Action Recorder

1. Open a button for editing and navigate to the **Actions** tab.
2. Click **Start recording** in the Action Recorder section.
3. Perform the operations on your device that you want to capture (for example, switch a source on an ATEM).
4. The corresponding actions will appear in the recorder list as Companion detects them.
5. Click **Stop recording** when done.
6. Review the recorded actions and click **Save** to apply them to the button, or **Discard** to cancel.

## Notes

- Not all actions a module supports can be recorded; only operations the module explicitly reports back to Companion will appear.
- The recorder captures the state at the time of the operation. If you want to record a sequence with delays between steps, you may need to add `internal: Wait` actions manually after recording.
