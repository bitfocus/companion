Many modules allow for using variables in input fields. A select few places support a new concept of expressions too (including button text when in expression mode). We hope to make these available in more places over time.

The key difference is that expressions are capable of a lot more, but are more complex to write.

A simple expression which will add two numeric variables, could look like `$(custom:a) + $(custom:b)`. Other operators can be used here instead.
Or a more complex boolean expression could be `($(custom:a) > $(custom:b)) && !$(custom:c)`.

The normal operator precedence is used in complex expressions. Parentheses can also be used to overrule the precedence or to aid readability, such as `($(custom:a) + $(custom:b) / $(custom:c)`.

You can also do more complex expressions with conditional logic, such as `($(custom:a) > 0) ? $(custom:a) : 0`.

There are various functions that you can use. These can be used in the usual ways to do various things. For example `round($(custom:a))`. There is a full list of available functions documented below.

Strings can be formed using `` `${$(custom:a)}dB` ``. You can use anything instead of `$(custom:a)`, even other templates and conditional logic.

You can split your expression over multiple lines or statements, and create intermediary values too

```
myval = $(custom:a) + $(custom:b)
myval / 2
```

Note: the parser is looser than js in how statements have to be written, it is valid for multiple to be on one line (eg `10 20 30`).  
The value of the last statement will be taken as the output of the expression.

And you can add either `/* block comments */` or `// end of line comments` to document your expressions.

All of these features can be combined into long and complex expressions, and more is sure to be possible in the future. We look forward to seeing what you come up with!
