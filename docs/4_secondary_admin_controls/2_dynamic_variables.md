Some modules can expose their state through dynamic variables. If one of your modules supports this, it will show up in the variables tab. The picture below shows where the tab is located, and if one of your modules supports variables, it will be listed in this tab for you to select.

![Dynamic variables Tab](images/admingui-variables.png?raw=true 'Dynamic variables tab')

When a module is selected, you will get a complete list of available variables. All variables in the list will show their variable name/string, description and current value, and a button that `copies` the string for ease of use.

![Dynamic variables](images/dynamic-variables.png?raw=true 'Dynamic variables')

To use a dynamic variable in a button, just copy/paste the variable into the button's label, or begin typing `$(` in the button's text to choose from a list of available dynamic variables.

![Dynamic variables usage](images/dynamic-variable-usage.png?raw=true 'Dynamic variable usage')

The variables (and the button) will be updated when the device updates.

_A line break can be forced by putting `\n` where you want the line break to be._