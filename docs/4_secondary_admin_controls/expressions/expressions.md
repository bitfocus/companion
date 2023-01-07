Many modules allow for using variables in input fields. A select few places support a new concept of expressions too. We hope to make these avaibale in more places over time.

The key difference is that expressions are capable of a lot more, but are more complex to write.

A simple expression which will add two variables, could look like `$(internal:a) + $(internal:b)`. Other operators can be used here instead.
Or a more complex boolean expression could be `($(internal:a) > $(internal:b)) && !$(internal:c)`.

The normal operator precedence is used in complex expressions. Parentheses can also be used to overrule the precedence or to aid readability, such as `($(internal:a) + $(internal:b) / $(internal:c)`.

You can also do more complex expressions with conditional logic, such as `($(internal:a) > 0) ? $(internal:a) : 0`.

There are various functions that you can use. These can be used in the usual ways to do various things. For example `round($(internal:a))`. There is a full list of available functions documented below.

Strings can be formed in a couple of ways. Either using the addition operator such as `$(internal:a) + 'dB'` or using `` `${$(internal:a)}dB` `` You can use anything instead of `$(internal:a)`, even other templates and conditional logic.

All of these features can be combined into long and complex expressions, and more is sure to be possible in the future. We look forward to seeing what you come up with!
