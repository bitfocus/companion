The variables tab also includes an section for custom variables. The button labeled `Custom Variables`, which appears along with the other modules that expose module variables, takes you to the **Custom Variables** view.

Custom Variables behave just like module variables, they can be used within Button text and some modules allow their use within the options of their actions. Please check the module documentation for availability.  
The key difference is that their values are set by you. This can be done either through the internal actions, or some modules are able to store the result of an action to a custom variable (generic-http is able to do this.)


![Custom Variables View](images/custom-variables.png?raw=true 'Custom Variables View')

All custom variables will appear with `internal` as the connection label, and their names begin with a `custom_` prefix.

```
                           +------- custom prefix
                           |
connection label----+      |       +--------------variable name
                    |      |       |
                    v      v       v
            $(internal:custom_counter)
```

For each Custom variable, you can see and set:
- **Current value** The current value of the variable
- **Startup value** The value to use for the variable upon restarting Companion
- **Persist value** Whether to persist the current value to be used upon startup. This will increase disk IO.
