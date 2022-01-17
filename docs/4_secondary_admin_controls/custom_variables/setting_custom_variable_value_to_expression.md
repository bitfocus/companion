You can also calculate the value of a custom variable by using the **Set custom variable to expression** action.

![Store variable value to custom variable](images/custom-variables-6.png?raw=true 'Store variable value to custom variable')

The **Set custom variable to expression** accepts basic arithmetic expressions such as:

```
$(internal:custom_counter) - 1
$(internal:custom_score) + 10
$(internal:custom_seconds) / 60
( 32 − $(internal:custom_fahrenheit) ) * 5 / 9
```

> **Note:** All whitespace is ignored. They're only included here for clarity.
