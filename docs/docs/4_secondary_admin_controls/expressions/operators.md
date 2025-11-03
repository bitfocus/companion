---
title: Operators
sidebar_position: 1
description: Reference guide for operators in Companion expressions.
---

Supported operators include:

- Ternary operator:
  - Conditional ternary: `a ? b : c`
- Binary operators:
  - Addition: `a + b`
  - Subtraction: `a - b`
  - Multiplication: `a * b`
  - Division: `a / b`
  - Exponentiation ("Raise to a Power"): `a ** b`
  - Modulus: `a % b`
  - Equality (loose): `a == b`
  - Equality (strict): `a === b`
  - Inequality (loose): `a != b`
  - Inequality (strict): `a !== b`
  - Greater than: `a > b`
  - Greater than or equal: `a >= b`
  - Less than: `a < b`
  - Less than or equal: `a <= b`
  - Logical OR: `a || b`
  - Logical AND: `a && b`
  - Right shift: `a >> b`
  - Left shift: `a << b`
  - Bitwise XOR: `a ^ b`
  - Bitwise AND: `a & b`
  - Bitwise OR: `a | b`
- Unary operators:
  - Unary Negation: `-a`
  - Convert to number: `+a`
  - Logical NOT: `!a`
  - Bitwise NOT: `~a`
- Expression grouping:
  - Parenthesis: `(a + b) * c`
- Objects:
  - Define an object: `{ a: 1 }`
  - Define an array: `[1, 2]`
  - Object/array lookup: `$(my:var)['some-prop']`
- Assignment of temporary variables:
  - Assignment: `a = 1`
  - Addition assignment: `a += 1`
  - Subtraction assignment: `a -= 1`
  - Multiplication assignment: `a *= 1`
  - Division assignment: `a /= 1`
  - Modulus assignment: `a %= 1`
  - Increment: `a++` or `++a`
  - Decrement: `a--` or `--a`
  - Logical OR assignment: `a ||= 1`
  - Logical AND assignment: `a &&= 1`
  - Left shift assignment: `a <<= 1`
  - Right shift assignment: `a >>= 1`
  - Bitwise XOR assignment: `a ^= 1`
  - Bitwise AND assignment: `a &= 1`
  - Bitwise OR assignment: `a |= 1`
  - Exponent assignment: `a **= 2`

> **Note:** In the examples `a` and `b` should be replaced with custom variables, module variables or number literals. They are only used here for brevity.
