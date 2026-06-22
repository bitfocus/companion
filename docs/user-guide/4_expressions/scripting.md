---
title: Advanced expressions
sidebar_position: 3
description: Variables and scope, control flow, functions and collections in Companion expressions.
---

The [basics](index.md) cover values, operators, functions and templates — enough for most button text and feedbacks. For more involved logic, expressions also support variables you can update, control-flow statements (`if`, loops) and your own functions. These are most useful in longer multi-line expressions, such as when computing a custom or expression variable.

Everything here builds on the basics, so make sure you are comfortable with [operators](operators.md), [functions](functions.md) and [template strings](index.md#template-strings) first.

## Variables and scope

In a longer expression you often need to store and update intermediate values. There are two ways to introduce a variable:

- A **bare assignment**, `total = 0`, sets a variable (creating it if needed).
- A **declaration**, `let total = 0` or `const total = 0`, explicitly creates a new variable. A `const` cannot be reassigned afterwards.

```
let count = 0
count = count + 1
count           // 1
```

Reading a variable that was never set gives `undefined` (the same as a missing `$()` variable).

### Scopes

A **scope** is the region a variable lives in. Every block — the `{ ... }` body of an `if`, `for` or `while`, and the body of a function — creates a new scope. Variables declared inside a block exist only within it.

When you read or assign a variable, Companion looks in the current scope first, then the scope around it, and so on outward. This has three practical consequences:

**1. A bare assignment updates the nearest existing variable.** This is what makes accumulating in a loop work — the assignment inside the loop reaches out to the `total` declared before it:

```
let total = 0
for (const x of [1, 2, 3]) {
	total = total + x   // updates the outer `total`
}
total                  // 6
```

**2. `let` / `const` always create a _new_ variable in the current scope**, even if one with the same name exists outside. This is called shadowing — the inner one hides the outer one, but only within its block:

```
let name = 'outer'
if (true) {
	let name = 'inner'   // a separate variable
	name                 // 'inner' here
}
name                     // still 'outer'
```

**3. A bare assignment to a name that does not exist anywhere creates it in the _current_ scope.** So a variable first set inside a block does not survive once the block ends:

```
if (true) {
	temp = 5   // created inside the block
}
temp           // gone here -> undefined
```

If you want a value to outlive a loop or `if`, declare it _before_ the block and assign to it inside (as in the loop example above).

:::tip

The rule of thumb: use `let`/`const` when you want a fresh variable (especially to avoid clashing with an outer one); use a plain `name = ...` when you want to update a variable that already exists in an outer scope, such as a running total.

:::

A `const` cannot be reassigned, which is a good way to protect a value you don't intend to change:

```
const limit = 10
limit = 20   // error - the expression is invalid
```

## Control flow

### if / else

`if` runs a block when a condition is true, with optional `else if` and `else` branches:

```
let label = ''
if ($(custom:level) > 90) {
	label = 'HIGH'
} else if ($(custom:level) > 50) {
	label = 'MEDIUM'
} else {
	label = 'LOW'
}
label
```

A condition counts as true unless it is `0`, an empty string, `null`, `undefined` or `NaN` — the same rule as the ternary `?:` operator. (For the common case of a variable holding the text `"false"` or `"0"`, wrap it in [`bool`](functions.md#bool-operations).)

### Loops

`for...of` iterates the items of an array, `for` counts, and `while` repeats while a condition holds:

```
let total = 0
for (const item of $(custom:cart)) {
	total = total + item.price * item.qty
}
total
```

```
let sum = 0
for (let i = 1; i <= 10; i++) {
	sum = sum + i
}
sum   // 55
```

`break` exits a loop early, and `continue` skips to the next iteration:

```
let firstBig = -1
for (const x of $(custom:values)) {
	if (x > 100) {
		firstBig = x
		break
	}
}
firstBig
```

### Producing a result

A statement like `if` or `for` does not by itself produce a value. When you want the expression to return something, end it with an expression — usually the variable you accumulated into — or use `return`:

```
let total = 0
for (const x of [1, 2, 3]) { total = total + x }
total   // <- the result
```

## Functions

You can define your own functions with arrow syntax, `(parameters) => result`, and call them by name:

```
const double = x => x * 2
double(21)   // 42
```

A function can use variables from the scope where it was defined, and call itself recursively:

```
const factor = 3
const scale = x => x * factor   // remembers `factor`
scale(10)                       // 30
```

```
let fib = n => n < 2 ? n : fib(n - 1) + fib(n - 2)
fib(10)   // 55
```

For more than one statement, give the function a block body and use `return`:

```
let clamp = (value, lowest, highest) => {
	if (value < lowest) { return lowest }
	if (value > highest) { return highest }
	return value
}
clamp($(custom:level), 0, 100)
```

## Collection functions

Functions become especially powerful with the collection helpers, which run a function over each element of an array — see [the array iteration functions](functions.md#array-iteration-operations) for the full list (`arrayMap`, `arrayFilter`, `arrayReduce`, `arrayFind`, and so on):

```
// total price of everything in the cart
arrayReduce($(custom:cart), (sum, item) => sum + item.price * item.qty, 0)
```

```
// names of the items that are in stock
arrayMap(arrayFilter($(custom:cart), item => item.inStock), item => item.name)
```

These read well chained together — filter, then transform, then combine:

```
let scores = $(custom:scores)
let passing = arrayFilter(scores, s => s >= 50)
let sorted = arraySort(passing, (a, b) => b - a)
`Top score: ${sorted[0]}`
```

## Execution limits

To protect Companion from a mistake such as an accidental infinite loop, every expression runs under a budget on the number of operations (loop iterations and function calls) and the depth of nested function calls. An expression that exceeds the budget is aborted and treated as invalid, the same as a syntax error.

The budget is generous — ordinary expressions never come close — but it does mean a `while (true)` with no exit, or a function that recurses forever, will fail rather than hang. Some places that evaluate expressions very frequently (such as field visibility checks) use a tighter budget, so keep those expressions simple.

## Worked examples

### Total of a list of items

A custom variable holding an array of `{ price, qty }` objects, summed:

```
arrayReduce($(custom:cart), (sum, item) => sum + item.price * item.qty, 0)
```

### Counting into categories

```
let counts = { high: 0, low: 0 }
for (const score of $(custom:scores)) {
	if (score >= 50) {
		counts.high = counts.high + 1
	} else {
		counts.low = counts.low + 1
	}
}
`${counts.high} high / ${counts.low} low`
```

### Safely reading nested data

Optional chaining (`?.`) reads through values that might be missing, and `??` supplies a fallback:

```
$(custom:state)?.scenes?.[0]?.name ?? 'No scene'
```

### Building a summary string

Remember to separate the statements — the `;` here stops the template line being read as part of the line above:

```
let items = $(custom:cart);
let total = arrayReduce(items, (sum, item) => sum + item.price * item.qty, 0);
`${length(items)} items, total ${total}`
```
