Many modules support using variables in input fields. A subset of places also support expressions (for example, button text when in expression mode). Expressions are more powerful than plain variables but require a small expression language.

Key points

- Expressions are written using the expression language and must be wrapped in `$()` so the renderer can locate them. Example: `$(1 + 2)` or `$(custom:a + custom:b)`.
- Expressions can contain arithmetic and logical operators, conditional (ternary) expressions, function calls, and variable access.

##### Examples

Basic arithmetic:

```
$(custom:a) + $(custom:b)
```

Boolean logic:

```
($(custom:a) > $(custom:b)) && !$(custom:c)
```

Conditional (ternary):

```
($(custom:a) > 0) ? $(custom:a) : 0
```

Using functions (see functions page):

```
round($(custom:a))
```

Template strings use backticks with `${...}` interpolation. The interpolated section can be any valid expression:

```
`${$(custom:a)}dB`
```

Multi-line expressions and intermediate values

You can split expressions across multiple lines and create intermediate variables. The value of the last statement is taken as the expression result:

```
myval = $(custom:a) + $(custom:b)
myval / 2
```

Comments

Block and end-of-line comments are supported:

```
/* block comment */
// end of line comment
```

Notes

- The parser is slightly more permissive than JavaScript when it comes to statement separation; multiple statements may appear on a single line.
- These features can be combined to form long and complex expressions. More functionality will be added in future.
