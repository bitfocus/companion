---
title: Expressions
sidebar_position: 5
description: Write expressions using operators, functions, and variables.
---

:::note
We are actively working on wider support for expressions in the next release of Companion.  
Please bear with us as we work on implementing this.
:::

Many modules support using variables in input fields. A subset of places also support expressions (for example, button text when in expression mode). Expressions are more powerful than plain variables but require a small expression language.

Key points

- Expressions are written using the expression language and must be wrapped in `$()` so the renderer can locate them. Example: `$(1 + 2)` or `$(custom:a + custom:b)`.
- Expressions can contain arithmetic and logical operators, conditional (ternary) expressions, function calls, and variable access.

## Valid Expressions

Expressions can contain _number literals_, _custom variables_, _dynamic variables_, _operators_, _functions_, _ternaries_ and _template strings_.

### Number Literals

Number literals can be integer or floating point numbers. For example:

- 1
- 1234
- 1234.5678

You can also write in other encodings, and they will be automatically converted to base 10. For example:

- 0x10 becomes 16
- 0b11 becomes 3

### Dynamic and Custom Variables

You can use any variable within an expression, including custom variables.

Do so with the normal syntax. For example:

- $(internal:time_s)

## Invalid Expressions

If the expression contains an error it will be considered invalid, the variable will not be set and an error message will be logged indicating the problem found.

This should only occur if there is a syntax error in the expression. Missing variables or invalid values should produce a predictable but bad result, often `NaN`.

If you find a case where it is failing to process the expression because of one of the values/functions you have used, please report this as a bug.

## Examples

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
