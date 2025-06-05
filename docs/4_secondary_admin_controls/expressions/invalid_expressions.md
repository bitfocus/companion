If the expression contains an error it will be considered invalid, the variable will not be set and an error message will be logged indicating the problem found.

This should only occur if there is a syntax error in the expression. Missing variables or invalid values should produce a predictable but bad result, often `NaN`.

If you find a case where it is failing to process the expression because of one of the values/functions you have used, please report this as a bug.
