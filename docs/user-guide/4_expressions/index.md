---
title: Expressions
sidebar_position: 5
description: Write expressions using operators, functions, and variables.
---

Expressions are a small formula language built into Companion. While a normal input field can only substitute variables into text, an expression can do maths, compare values, make decisions and format text — letting you build behaviour that would otherwise need extra buttons, triggers or an external script.

As a taste of what is possible, this expression produces a countdown to a 19:30 show start, suitable for use as button text:

```
secondsToTimestamp(max(0, timeDiff($(internal:time_hms), '19:30:00')), 'HH:mm:ss')
```

## Where you can use expressions

Expressions can be used in many places throughout Companion:

- **Button text** — enable the expression mode toggle on a text element to compute the text instead of writing it literally.
- **Internal actions** — for example, the value of the **Custom Variable: Set value** action can be set with an expression.
- **Internal feedbacks** — **Variable: Check boolean expression** lets you style a button whenever an expression evaluates to true, and **Evaluate Expression** exposes the result for use in styling.
- **Expression variables and local variables** — variables whose value is recalculated automatically from an expression. See [Variables](../3_config/variables.md).
- **Trigger conditions** — trigger conditions use the same feedbacks as buttons, so the boolean expression feedback works there too.
- **Any action or feedback field** — since Companion 4.3, modules can support expressions in **any** action or feedback field. Look for the expression toggle button next to an input field to switch it into expression mode.

:::note

Not all modules support expressions in their action and feedback fields yet. This will improve over time as modules are updated to the newer APIs.

:::

### Expression mode vs variables in text

This is the most common point of confusion, so it is worth being clear about:

- In a **normal text field** (with variables support), you write plain text and `$(...)` variables are substituted into it: `Cam $(atem:input_1_name)`.
- In an **expression field**, the entire field is one expression — a formula, not text. Plain words are not valid, and text must be quoted: `Cam $(atem:input_1_name)` is a syntax error, but `` `Cam ${$(atem:input_1_name)}` `` works (see [template strings](#template-strings) below).

In both cases `$(connection:variable)` is how you reference a variable; the difference is everything around it.

## Building blocks

An expression can be made up of values, variables, operators, function calls, conditionals and more. Each is described briefly below, with full reference pages for [operators](operators.md) and [functions](functions.md).

### Values

Numbers can be integers or floating point: `1`, `1234`, `1234.5678`. You can also write numbers in hexadecimal or binary and they will be converted: `0x10` is 16, `0b11` is 3.

Strings are written in single or double quotes: `'on air'`, `"standby"`.

Booleans are written as `true` and `false`.

### Variables

Any variable can be referenced with the usual syntax, including custom variables and local variables:

```
$(internal:time_s)
$(custom:my_variable)
```

Inside an expression, variables keep their type. A custom variable holding the number `5` behaves as a number, and one holding an array can be indexed with `$(custom:my_array)[0]`. A variable that doesn't exist evaluates to `undefined`.

:::note

Nested variable references such as `$(custom:$(custom:b))` are not supported inside expressions. If you need this, use the [`parseVariables` function](functions.md#variable-operations).

:::

### Operators

The usual arithmetic, comparison and logical operators are available:

```
$(custom:a) + $(custom:b)
($(custom:a) > $(custom:b)) && !$(custom:c)
```

See the [operators reference](operators.md) for the full list.

:::warning

Unlike many languages, the `+` operator **always does numeric addition** — it never joins strings. `'show ' + 'time'` gives `NaN`. To join text, use a [template string](#template-strings) or the [`concat` function](functions.md#string-operations).

:::

### Functions

A library of functions is available for string manipulation, formatting, time handling and more:

```
round($(custom:a))
secondsToTimestamp($(custom:total_seconds), 'mm:ss')
```

See the [functions reference](functions.md) for the full list.

### Conditionals (ternary)

The ternary operator `condition ? valueIfTrue : valueIfFalse` lets an expression choose between two values:

```
bool($(obs:recording)) ? 'REC ●' : 'REC'
```

:::tip

If a variable holds the text `"false"` or `"0"` rather than a real boolean, it counts as _true_ in a condition, because it is a non-empty string. Wrapping it in the [`bool` function](functions.md#bool-operations) handles these cases sensibly.

:::

These can be chained for multiple cases:

```
$(custom:level) > 90 ? 'HIGH' : $(custom:level) > 50 ? 'MEDIUM' : 'LOW'
```

### Template strings

Template strings are the easiest way to build text out of multiple values. They are written with backticks, and each `${...}` section can contain any valid expression:

```
`${$(custom:a)} dB`
`Clip ${$(custom:current)} of ${$(custom:total)}`
```

### Multiple lines and temporary variables

Longer expressions can be split across multiple statements, separated by a newline or a semicolon (`;`), assigning intermediate results to temporary variables. The value of the last statement is the result of the expression:

```
myval = $(custom:a) + $(custom:b)
myval / 2
```

If you prefer, you can write `return` to make the result explicit, and to stop early — `return myval / 2` ends the expression with that value. Note that `return` and its value must be on the same line.

Temporary variables only exist while the expression is being evaluated — they are not visible anywhere else, and are not related to custom variables.

:::tip

If a statement ends with a value and the next line begins with `` ` ``, `(` or `[`, the two lines can be read as a single statement (for example a template string on its own line after a calculation becomes part of the line above). When in doubt, end statements with a semicolon (`;`) — it removes the ambiguity.

:::

You can also declare variables explicitly with `let` and `const`, which matters once you start using blocks and functions. How variables are created, updated and scoped is covered in [Advanced expressions](scripting.md#variables-and-scope).

### Comments

Both block and end-of-line comments are supported, which can help keep longer expressions understandable:

```
// end of line comment
/* block comment */
```

### Objects and arrays

Expressions can create and work with objects and arrays:

```
[1, 2, 3]
{ label: 'Cam 1', input: 1 }
```

Properties and elements are accessed with the usual bracket or dot notation. This is particularly useful with custom variables that hold objects or arrays, or module variables that expose structured data:

```
$(custom:names)[1]
$(custom:settings)['some-prop']
$(custom:settings).timeout
```

For querying deeper structures, see the [`jsonpath` function](functions.md#objectarray-operations).

You can also use optional chaining (`?.`) to safely read from a value that might be missing, and the spread operator (`...`) to combine arrays or objects:

```
$(custom:settings)?.timeout ?? 1000
[...$(custom:list_a), ...$(custom:list_b)]
{ ...$(custom:defaults), label: 'override' }
```

## Going further

Beyond the building blocks above, expressions can do real scripting — declaring variables, control flow (`if`, loops), defining your own functions, and processing arrays. If you need more than a single formula, see **[Advanced expressions](scripting.md)**.

## Worked examples

Some complete examples of the kinds of problems expressions can solve. The connection labels (`obs`, `atem`, etc.) are placeholders — substitute the variables from your own connections.

### Countdown to a fixed time

As button text (expression mode enabled), counts down to 19:30 and holds at zero afterwards:

```
secondsToTimestamp(max(0, timeDiff($(internal:time_hms), '19:30:00')), 'HH:mm:ss')
```

Or with a multi-line expression, switch the label entirely once the time has passed:

```
remaining = timeDiff($(internal:time_hms), '19:30:00')
remaining > 0 ? secondsToTimestamp(remaining, 'mm:ss') : 'ON AIR'
```

### Flashing a button while live

Using the **Variable: Check boolean expression** feedback with a style change to a red background:

```
bool($(obs:streaming)) && blink(500)
```

While streaming, the feedback alternates between true and false every 500ms, making the button flash. When not streaming, it stays off.

### Cycling through a set of values

An action **Custom Variable: Set value**, with the expression toggle enabled on the value field:

```
($(custom:camera) % 4) + 1
```

Each press moves the variable through 1 → 2 → 3 → 4 and back to 1 — useful for stepping through cameras, presets or pages with a single button.

### Formatting numbers for display

Show a fader level with one decimal place and a unit, as button text:

```
`${toFixed($(mixer:ch1_level), 1)} dB`
```

Pad a clip number with leading zeros to a fixed width:

```
substr(concat('000', $(custom:clip)), -3)
```

### Showing progress as a percentage

Combining several variables into a readable status:

```
pct = round($(player:position) / $(player:duration) * 100)
`${pct}%`
```

### Falling back when a variable is unset

The `??` operator substitutes a fallback only when the value is undefined:

```
$(custom:operator_name) ?? 'No operator'
```

## When an expression is invalid

If an expression contains a syntax error it is considered invalid: the result will not be produced and an error will be logged describing the problem.

Missing variables or unsuitable values do not make an expression invalid — they produce a predictable but unhelpful result instead, often `NaN` or `undefined`. If you see `NaN` where you expected text, check whether you are using `+` to join strings (use a template string or `concat` instead).

If you find a case where an expression fails to evaluate because of one of the values or functions you have used, please report it as a bug.

## Notes

- The expression language is a subset of JavaScript. Most JavaScript you write will work, but features such as classes, regular-expression literals and `try`/`catch` are not available, and only arrow functions (`x => ...`) are supported, not the `function` keyword.
- Multiple statements must be separated by a newline or a semicolon (`;`).
- These features can be combined into long and complex expressions. More functionality will be added over time — let us know if something you need is missing.

:::note Changes in Companion 5.0

The expression engine was rebuilt on a standard JavaScript parser in 5.0, adding control flow, functions and collection helpers (see [Advanced expressions](scripting.md)). A few previously-accepted quirks changed as a result:

- Statements must now be separated by a newline or `;` — two statements with no separator (e.g. `10 + 10 20 30`) are no longer accepted.
- `return` must be on the same line as its value; a line break directly after `return` now ends the expression with no value.
- Object property access with a dot (`$(custom:obj).name`) now works the same as bracket access (`$(custom:obj)['name']`); previously only bracket access returned a value.

:::
