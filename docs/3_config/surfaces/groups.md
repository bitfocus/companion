Surface groups, introduced in Companion v3.2, allow multiple surfaces to be linked for several uses.

## Use Case 1: Linking Control Surfaces

All surfaces in a group are linked to the same page in Companion. This is convenient for setups such as having two Stream Deck XLs side by side, which want to be treated as a single 4x16 device.

To do this, use the **+ Add Group** button to create a new surface group. Then for each surface you want to add to the group, open its settings and change the surface group dropdown to the newly created group.
Finally, set the horizontal or vertical offset for each surface, to display the desired part of the Companion page.

For example, in the _Settings > Buttons_ page specify the grid size to be 4 x 16, then on the _Surfaces_ page, put the two surfaces in a group, as described above, then select the line for the second Stream Deck XL in the group, and set _Horizontal Offset in grid_ to 8: the first XL will display columns 0-7; the second XL will show columns 8-15 of your pages.

Elsewhere in Companion, the actions that can change the page of a surface will no longer see the individual surfaces, and can instead pick the group.

## Use Case 2: Addressing a surface without being tied to its serial number

A second use case for groups, is that you can use a group as a stable id for a surface.  
This helps setups where you need to be able to swap out a Stream Deck quickly, and also need actions to reference specific Stream Decks.  
You can create your groups and program the system ahead of time, then later add or remove surfaces to the groups without needing to update any buttons.

## Use Case 3: Establishing "Permission Groups" with restricted access

Starting with v4.2, groups -- as well as ungrouped surfaces -- now provide the option to restrict which pages a device in that group may access. Using this in a surface-group configuration can be very useful if:

1. Each surface is controlled independently (for example, each surface is controlled by its own computer or Raspberry Pi)

...OR...

2. It is expected that all user in a group should be on the same page (for example, if users are restricted to a single page)

By creating groups for each role, a single site configuration can be created, with page access permissions determined by the device or group ID. Any surface "registered" to (i.e. included in) a particular group will then be able to access only the pages allowed for that surface group.

See: [Page Permissions](#3_config/surfaces/pagepermissions.md) for additional details.
