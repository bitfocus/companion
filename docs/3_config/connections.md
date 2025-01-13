From the Connections tab, you can add, configure and remove devices. You can also see the status of a connection, as well as other information about it in the table.

![Connections Page](images/connection_list.png?raw=true 'Connections Page')

In 3.0 the API used between the connections and Companion was overhauled, and this has resulted in some modules breaking. While a lot of the connections have been updated to fully use the new API, many haven't. Many connections which haven't been updated work just fine, but some unfortonately do not. This is indicated by the ⚠ symbol.

**To add a new device**

1.  Add a new device, by scrolling though the list or through a search.
2.  Choose the specific device you want to add.
3.  Enter the connection information for device. Save the changes.

Your new device should now show in the Connections tab along with all the other devices you want to control.
Each device needs to be a separate connection. If you have two separate Barco E2, you need to add both of them as separate connections.

Once you have added your connections, you can reorder or filter them in the table. In the rightmost column, you can expand a list of buttons:

![Connections Popover](images/connection-popover.png?raw=true 'Connections Popover')

- **Help** will open that module's help information. This is also possible in the list on the right before adding a connection.
- **Known Issues** will take you to the GitHub page for the module. You should report any bugs you encounter with the module here, or any feature requests for missing functionality. Tip: The more detail you give on a bug or feature request, the more likely it is to be handled quickly.
- **Variables** will show a list of all the variables that a connection provides. These can be used in various places either explained later on.
- **View Logs** is a debug log for the module. When reporting a bug, module developers may want extra information from here to help figure out the bug. To most users this will not be interesting.

A full list of supported devices can also be found on the website. [Companion Module Support List](https://bitfocus.io/connections)
