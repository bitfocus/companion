---
title: Custom Variables
sidebar_position: 3
description: Create and manage custom variables with different types.
---

The variables tab also includes a section for custom variables. The button labeled `Custom Variables`, which appears alongside other modules that expose module variables, takes you to the **Custom Variables** view.

Custom Variables behave just like module variables, they can be used within Button text and some modules allow their use within the options of their actions. Please check the module documentation for availability.  
The key difference is that their values are set by you. This can be done either through the internal actions, or some modules are able to store the result of an action to a custom variable (generic-http is able to do this.)

![Custom Variables View](images/custom-variables.png?raw=true 'Custom Variables View')

All custom variables will appear with `custom` as the connection label.

```
connection label----+      +--------------variable name
                    |      |
                    v      v
               $(custom:counter)
```

For each custom variable, you can see and set:

- **Current value** The current value of the variable
- **Startup value** The value to use for the variable upon restarting Companion
- **Persist value** Whether to persist the current value to be used upon startup. This will increase disk IO.

Just like module variables a custom variable can hold data in different formats, called types.  
The available types are:

- string: a UTF-8 encoded text, e.g. `Hello "world" 😀`
- number: a IEEE754 floating-point number e.g. `2.4`, `-8`. Internally 64bits are used to store the number. That means that there is a limit in size and precision. When used as integer the range is -2^53 + 1 to 2^53 - 1
- boolean: the smallest digital information, `true` or `false`
- object: a collection of objects or other data types. Basically there are two forms, a keyed collection, often referred as a JSON (JavaScript object notation), and a indexed collection, called an Array.  
  JSON is enclosed in curly brackets and holds a comma delimited list of properties with a key name and a value, e.g. `{"key1":"value1", "key2":42, "third_key":{"description":"objects can be nested"}}`  
  Arrays are enclosed in square brackets and hold a comma delimited list of values without keys, the values are referenced by their position with the first position having the index 0, e.g. `["value1", 42, {"description":"arrays can hold different data types"}]`
- null: this is a special value that can't be called a string or a number or something else, so it has its own data type. The value and data type is called `null`. It is often used to express invalidity.

You can enter a value or startup value in two different ways: Text and JSON.
When the button on the left of a text entry field shows a T, you can enter text in the field and the variable will be updated with that text. The data type of the variable will be string.  
When the button on the left is switched to {}, you can enter JSON and the variable will be updated with the corresponding value. If you want to enter a number, just type it in JSON entry. If you want to enter a boolean just type true or false in JSON entry. If you want to enter a text in JSON entry you would need to enclose it in double quotation marks and escape all quotation marks inside the text, so it is easier to enter text with text entry.

Objects are very useful when you want to store multiple values in _one_ variable. Let's assume you want to store the names of 3 persons. You could add three custom variables with the names `name1`, `name2` and `name3`. But you can also create one custom variable for it with the name `names` and set it to the array `["Peter","Paul","Mary"]`. When you want to show a name on a button, you have to access it with an expression. E.g. the expression for getting the second name (index 1) is `$(custom:names)[1]`. If you want to change a single name in that array from an action, you have to use an expression to. Set for example the variable using the expression `arr=$(custom:names); arr[1] = 'John'; arr`. This expression will read the current array, set the second element to John and finally return the new array. This may sound more complicated than just updating a dedicated variable for name2, but now think of having to do this for 100 names.

_For backwards compatibility, all custom variables will also parse under the legacy `$(internal:custom_counter)` scheme. This usage is deprecated and expected to be removed in a future Companion release._
