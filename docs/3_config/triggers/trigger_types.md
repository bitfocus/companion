- **Instance**

  ![Trigger Instance](images/trigger_edit_instance_crop.png?raw=true 'Trigger Instance')  
  Allows automating based on Companion states. Here you have the options for the trigger to activate on startup, webpage load or when a button has been pressed down or released. |

- **Time Interval**

  ![Trigger Time Interval](images/trigger_edit_interval_crop.png?raw=true 'Trigger Time Interval')  
  Creates a Trigger that will get triggered every `X` seconds.

- **Time of day**

  ![Trigger Time Of Day](images/trigger_edit_time_of_day_crop.png?raw=true 'Trigger Time Of Day')  
  Creates a Trigger that will get triggered every `X` day at `Y` time. in this trigger, you will need to specify what time of day in the format, `HH:MM:SS` and you can choose at what day of the week it'll be active.

- **Variable value**

  ![Trigger Variable](images/trigger_edit_variable_crop.png?raw=true 'Trigger Variable')  
  Creates a Trigger that will get triggered every time a selected variable matches the condition or multiple conditions specified.

  To find the variable you want to use, go to the instance page and click edit on the module you want a variable from. Copy the variable and paste it into the text field. The variable will look something like this when you copy it `$(vmix:fullscreen_active)`, please remove `$( )`, and it should now look like in the picture.

  For each variable you add, you can perform some basic functions `=`, `!=`, `<` or `>`.

  And last, you need to specify what value to check for, so for my example, I would type in `True` or `False` based if it's on or off. You might want to specify a value based on a specific state, like what input is currently on program. To find the values do as before and copy the variables page's value to ensure it matches up correctly.