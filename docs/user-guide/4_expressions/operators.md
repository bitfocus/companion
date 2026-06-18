---
title: Operators
sidebar_position: 1
description: Reference guide for operators in Companion expressions.
---

:::tip
In the examples `a`, `b` and `c` can be replaced with custom variables, module variables, number literals or any other expression. They are only used here for brevity.
:::

### Arithmetic operators

| Operator       | Syntax   | Example                    |
| -------------- | -------- | -------------------------- |
| Addition       | `a + b`  | `2 + 3` is `5`             |
| Subtraction    | `a - b`  | `5 - 2` is `3`             |
| Multiplication | `a * b`  | `4 * 3` is `12`            |
| Division       | `a / b`  | `10 / 4` is `2.5`          |
| Exponentiation | `a ** b` | `2 ** 3` is `8`            |
| Modulus        | `a % b`  | `7 % 3` is `1` (remainder) |

:::warning
The arithmetic operators always treat both sides as numbers. In particular, `+` **cannot be used to join strings** — `'a' + 'b'` gives `NaN`. Use a [template string](index.md#template-strings) or the [`concat` function](functions.md#string-operations) to join text.
:::

### Comparison operators

| Operator              | Syntax    | Example                |
| --------------------- | --------- | ---------------------- |
| Equality (loose)      | `a == b`  | `5 == '5'` is `true`   |
| Equality (strict)     | `a === b` | `5 === '5'` is `false` |
| Inequality (loose)    | `a != b`  | `5 != '5'` is `false`  |
| Inequality (strict)   | `a !== b` | `5 !== '5'` is `true`  |
| Greater than          | `a > b`   | `5 > 3` is `true`      |
| Greater than or equal | `a >= b`  | `5 >= 5` is `true`     |
| Less than             | `a < b`   | `3 < 5` is `true`      |
| Less than or equal    | `a <= b`  | `5 <= 3` is `false`    |

Loose equality (`==`) considers values equal if they match after type conversion, so a variable holding the text `'5'` equals the number `5`. Strict equality (`===`) requires the types to match too. When comparing a variable against a value, loose equality is usually what you want, as variables from some connections are provided as text.

The ordering operators (`>`, `>=`, `<`, `<=`) convert both sides to numbers before comparing — they cannot be used to compare text alphabetically.

### Logical operators

| Operator           | Syntax     | Example                                   |
| ------------------ | ---------- | ----------------------------------------- |
| Logical AND        | `a && b`   | `true && false` is `false`                |
| Logical OR         | `a \|\| b` | `0 \|\| 'fallback'` is `'fallback'`       |
| Nullish coalescing | `a ?? b`   | `undefined ?? 'fallback'` is `'fallback'` |
| Logical NOT        | `!a`       | `!true` is `false`                        |

`||` falls back to the right side whenever the left side is falsy (including `0` and empty strings), while `??` only falls back when the left side is `undefined` or `null`. Use `??` to provide a default for a variable that may not be set:

```
$(custom:operator_name) ?? 'No operator'
```

### Ternary operator

The conditional (ternary) operator picks between two values:

| Operator    | Syntax      | Example                               |
| ----------- | ----------- | ------------------------------------- |
| Conditional | `a ? b : c` | `$(custom:on_air) ? 'LIVE' : 'READY'` |

### Unary operators

| Operator          | Syntax | Example                  |
| ----------------- | ------ | ------------------------ |
| Negation          | `-a`   | `-(2 + 3)` is `-5`       |
| Convert to number | `+a`   | `+'5'` is the number `5` |
| Logical NOT       | `!a`   | `!0` is `true`           |
| Bitwise NOT       | `~a`   | `~5` is `-6`             |

### Bitwise operators

| Operator    | Syntax   | Example         |
| ----------- | -------- | --------------- |
| Bitwise AND | `a & b`  | `6 & 3` is `2`  |
| Bitwise OR  | `a \| b` | `6 \| 3` is `7` |
| Bitwise XOR | `a ^ b`  | `6 ^ 3` is `5`  |
| Right shift | `a >> b` | `8 >> 2` is `2` |
| Left shift  | `a << b` | `2 << 2` is `8` |

### Expression grouping

Parentheses group sub-expressions to control the order of evaluation:

```
(a + b) * c
```

Operator precedence follows the usual JavaScript rules, but when combining several operators it is clearer to add parentheses than to rely on precedence.

### Objects and arrays

| Operation             | Syntax                                     |
| --------------------- | ------------------------------------------ |
| Define an object      | `{ a: 1 }`                                 |
| Define an array       | `[1, 2]`                                   |
| Object/array lookup   | `$(my:var)['some-prop']` or `$(my:var)[0]` |
| Property access (dot) | `$(my:var).some_prop`                      |

### Assignment of temporary variables

Within [multi-line expressions](index.md#multiple-lines-and-temporary-variables), intermediate results can be stored in temporary variables:

| Operator                      | Syntax         |
| ----------------------------- | -------------- |
| Assignment                    | `a = 1`        |
| Addition assignment           | `a += 1`       |
| Subtraction assignment        | `a -= 1`       |
| Multiplication assignment     | `a *= 2`       |
| Division assignment           | `a /= 2`       |
| Modulus assignment            | `a %= 2`       |
| Exponent assignment           | `a **= 2`      |
| Increment                     | `a++` or `++a` |
| Decrement                     | `a--` or `--a` |
| Logical OR assignment         | `a \|\|= 1`    |
| Logical AND assignment        | `a &&= 1`      |
| Nullish coalescing assignment | `a ??= 1`      |
| Left shift assignment         | `a <<= 1`      |
| Right shift assignment        | `a >>= 1`      |
| Bitwise XOR assignment        | `a ^= 1`       |
| Bitwise AND assignment        | `a &= 1`       |
| Bitwise OR assignment         | `a \|= 1`      |

For example, this accumulates a value across a few lines and returns the result:

```
total = $(custom:a)
total += $(custom:b)
total /= 2
total
```
