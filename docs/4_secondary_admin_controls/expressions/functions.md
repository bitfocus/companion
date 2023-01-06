There are various supported functions, and we are willing to add more. Let us know if you think something is missing.

The currently supported functions are:

##### Numeric operations

**round(val)**

Rounds a number to the nearest whole number.

**floor(val)**

Rounds down a number to a whole number.

**ceil(val)**

Rounds up a number to a whole number.

**fromRadix(val)**

Converts a string from the specified radix to an int.

eg `fromRadix("f", 16)` gives `15`

**toRadix(val)**

Converts an int to a string in the specified radix.

eg `toRadix(15, 16)` gives `"f"`

**toFixed(val, dp)**

Convert a number to a fixed precision string, with the specified number of digits after the decimal place.

**isNumber(val)**

Check if the value is a number.

**max(val, val2, [val3, ...])**

Finds the largest of the provided values.

**min(val, val2, [val3, ...])**

Finds the smallest of the provided values.

##### String operations

**trim(val)**

Trims any whitespace at the beginning and end of the string.

##### Bool operations

**bool(val)**

Convert a value into a boolean.

Any of the following will be interpreted as true:
* any non-zero int
* "true"

Everything else will be false.
