There are various supported functions, and we are willing to add more. Let us know if you think something is missing.

The currently supported functions are:

##### Numeric operations

**round(val)**

Rounds a number to the nearest whole number.

**floor(val)**

Rounds down a number to a whole number.

**ceil(val)**

Rounds up a number to a whole number.

**abs(val)**

Get the absolute value of a number.
If the value is negative, the positive will be returned.

eg `abs(-4)` and `abs(4)` both give `4`

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

**unixNow()**

Get the current unix time in milliseconds.

**timestampToSeconds(timestamp)**

Convert a timestamp of format 'HH:MM:SS' into the number of seconds it represents.

eg `00:10:15` gives 615

You can do the reverse of this with `secondsToTimestamp(str)`

**randomInt(min, max)**

Generate a random integer in the specified range (inclusive).

##### String operations

**trim(val)**

Trims any whitespace at the beginning and end of the string.

**strlen(val)**

Find the length of the given string.

**substr(val, indexStart, indexEnd)**

substr() extracts characters from indexStart up to but not including indexEnd.

* If indexStart >= str.length, an empty string is returned.
* If indexStart < 0, the index is counted from the end of the string. More formally, in this case, the substring starts at max(indexStart + str.length, 0).
* If indexStart is omitted, undefined, or cannot be converted to a number, it's treated as 0.
* If indexEnd is omitted, undefined, or cannot be converted to a number, or if indexEnd >= str.length, substr() extracts to the end of the string.
* If indexEnd < 0, the index is counted from the end of the string.
* If indexEnd <= indexStart after normalizing negative values, an empty string is returned.

Tip: If you don't want the behaviour of negative numbers, you can use `max(0, index)` to limit the value to never be below 0.

**concat(str1, str2)**

Combine one or more values into a single string

**includes(val, find)**

Check if a string contains a specific value

eg `includes("Companion is great!", "great")` gives `true`

**indexOf(val, find, offset)**

Find the index of the first occurrence of a value within the provided string.

Optionally provide an offset to start the search from.


**lastIndexOf(val, find, offset)**

Find the index of the last occurrence of a value within the provided string.

Optionally provide an offset to start the search from.

**toUpperCase(val)**

Coverts all characters in a string to uppercase

**toLowerCase(val)**

Coverts all characters in a string to lowercase

**replaceAll(val, find, replace)**

Searches a string for a specific value, and then replaces all instances of that value with a new string

eg `replaceAll("This is great!", "This", "Companion")` gives `Companion is great!`

**secondsToTimestamp(seconds, format)**

Convert a number of seconds into a timestamp of format 'HH:mm:ss'.

Note: If the value is less than 0, it will report 0. There is no limit to the number of hours shown, it will display values greater than 24.

By supplying the format parameter, you can choose which components will be included in the output string.

The following components are allowed:
* `HH` / `hh` - hours
* `mm` - minutes
* `ss` - seconds

**msToTimestamp(milliseconds, format)**

Convert a number of milliseconds into a timestamp of format 'HH:mm:ss.SSS'.

Note: If the value is less than 0, it will report 0. There is no limit to the number of hours shown, it will display values greater than 24.

By supplying the format parameter, you can choose which components will be included in the output string.

The following components are allowed:
* `HH` / `hh` - hours
* `mm` - minutes
* `ss` - seconds
* `.S` / `.SS` / `.SSS` - milliseconds, in varying levels of accuracy. Must be at the end of the string

**parseVariables(string)**

In some scenarios it can be beneficial to have nested variables. This is not supported in the expression syntax.

Instead you can use the `parseVariables` function, which will interpret a string using the string variables syntax.

eg `parseVariables('$(internal:custom_$(internal:custom_b))')`

##### Bool operations

**bool(val)**

Convert a value into a boolean.

Any of the following will be interpreted as true:
* any non-zero int
* "true"

Everything else will be false.
