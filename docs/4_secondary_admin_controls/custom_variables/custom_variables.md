The variables tab also includes an section for custom variables. The button labeled `Custom Variables`, which appears along with the other modules that expose dynamic variables, takes you to the **Custom Variables** view.

![Custom Variables Button](images/custom-variables-1.png?raw=true 'Custom Variables Button')

Within the **Custom Variables** view you can:

- Create new custom variables,
- Edit the "Current" and "Startup" values for each custom variable, and
- Delete existing custom variables

All custom variables will appear with `internal` as the instance name, and their names begin with a `custom_` prefix.

```
                           +------- custom prefix
                           |
instance name ------+      |       +--------------variable name
                    |      |       |
                    v      v       v
            $(internal:custom_counter)
```

![Custom Variables View](images/custom-variables-2.png?raw=true 'Custom Variables View')
