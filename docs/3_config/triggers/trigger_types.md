- **Companion**

  ![Trigger Companion](images/trigger_edit_instance_crop.png?raw=true 'Trigger Companion')  
  Allows automating based on Companion states. Here you have the options for the trigger to activate on startup, webpage load or when a button has been pressed down or released. |

- **Time Interval**

  ![Trigger Time Interval](images/trigger_edit_interval_crop.png?raw=true 'Trigger Time Interval')  
  Creates a Trigger that will get triggered every `X` seconds.

- **Time of day**

  ![Trigger Time Of Day](images/trigger_edit_time_of_day_crop.png?raw=true 'Trigger Time Of Day')  
  Creates a Trigger that will get triggered every `X` day at `Y` time. in this trigger, you will need to specify what time of day in the format, `HH:MM:SS` and you can choose at what day of the week it'll be active.

- **Feedback**

  ![Trigger Feedback](images/trigger_edit_feedback_crop.png?raw=true 'Trigger Feedback')  
  Creates a Trigger that will get triggered every time a set of feedbacks evaluate to true.

  This supports any 'boolean' type feedback. Not all feedbacks are written this way, it is a pretty new way of writing feedbacks. You can try and ask the module developers on the module github page to look at converting existing feedbacks across.

  The 'internal' instance has some feedbacks which can be used to compare variables against other variables or fixed values.
