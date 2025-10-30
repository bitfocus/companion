There are various supported functions, and we are willing to add more. Let us know if you think something is missing.

The currently supported functions are:

##### General operations

**length(val)**

Find the length of the item passed in.

- For strings, it will return the number of unicode graphemes
- For arrays, the number of elements
- For JSON or other objects, it will return the number of properties
- For numbers it will return the length of the string representation

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

**randomInt(min, max)**

Generate a random integer in the specified range (inclusive).

**log(v)**

Calculate the natural logarithm of a number.

**log10(v)**

Calculate the base 10 logarithm of a number.

##### String operations

**trim(val)**

Trims any whitespace at the beginning and end of the string.

**strlen(val)**

Find the length of the given string. For Unicode strings this will count the bytes not the graphemes.

**substr(val, indexStart, indexEnd)**

substr() extracts characters from indexStart up to but not including indexEnd. For Unicode strings, this will count based on the bytes not the graphemes.

- If indexStart >= str.length, an empty string is returned.
- If indexStart < 0, the index is counted from the end of the string. More formally, in this case, the substring starts at max(indexStart + str.length, 0).
- If indexStart is omitted, undefined, or cannot be converted to a number, it's treated as 0.
- If indexEnd is omitted, undefined, or cannot be converted to a number, or if indexEnd >= str.length, substr() extracts to the end of the string.
- If indexEnd < 0, the index is counted from the end of the string.
- If indexEnd <= indexStart after normalizing negative values, an empty string is returned.

Tip: If you don't want the behaviour of negative numbers, you can use `max(0, index)` to limit the value to never be below 0.

**split(str, separator)**

Split a string based on a separator

**join(arr, separator)**

Join an array of values into a single string separated by the specified separator

**concat(str1, str2)**

Combine one or more values into a single string

**includes(val, find)**

Check if a string contains a specific value

eg `includes("Companion is great!", "great")` gives `true`

**indexOf(val, find, offset)**

Find the index of the first occurrence of a value within the provided string. For Unicode strings, this will count based on the bytes not the graphemes.

Optionally provide an offset to begin the search from, otherwise it starts from position 0 (the beginning).

If the value isn't found, it will return -1, otherwise the index of the first occurrence.

**lastIndexOf(val, find, offset)**

Find the index of the last occurrence of a value within the provided string, searching from the end. For Unicode strings, this will count based on the bytes not the graphemes.

Optionally provide an offset to begin the search from, searching from the end.

If the value isn't found, it will return -1, otherwise the index of the last occurrence. The beginning is position 0.

**toUpperCase(val)**

Converts all characters in a string to uppercase

**toLowerCase(val)**

Converts all characters in a string to lowercase

**replaceAll(val, find, replace)**

Searches a string for a specific value, and then replaces all instances of that value with a new string

eg `replaceAll("This is great!", "This", "Companion")` gives `Companion is great!`

**encode(str, enc)**

Encode a string to the requested format ('hex','base64'). If `enc` is missing, `latin1` will be used.

eg `encode("Companion","hex")` gives `"436f6d70616e696f6e"`

**decode(str, enc)**

Decode a string from the requested format ('hex','base64'). If `enc` is missing, `latin1` will be used.

eg `decode("436f6d70616e696f6e","hex")` gives `"Companion"`

**parseVariables(string, ?undefinedValue)**

In some cases you may need nested variable evaluation (for example `$(custom:$(custom:b))`). The expression parser does not support that nested variable syntax directly. To evaluate nested variables inside an expression, pass the string to `parseVariables`, which will interpret string-variable and template syntax.

Optionally, you can provide the value to substitute in when a variable is `undefined`. This should be a string.

eg `parseVariables('$(custom:$(custom:b))')`

**getVariable(string) or getVariable(string, string)**

Dynamically fetch a variable value.

Note: when possible, prefer using the `$(internal:time_hms)` syntax, as it allows for Companion to statically detect the usage and auto-rename the reference when needed.

eg `getVariable('internal:time_hms')` or `getVariable('internal', 'time_hms')`

##### Bool operations

**bool(val)**

Convert a value into a boolean.

Any of the following will be interpreted as true:

- any non-zero int
- "true"

Everything else will be false.

##### Object/Array operations

**jsonpath(obj, path)**

Perform a jsonpath lookup on an object or array.

The input can either be an object or an stringified object. The output will match the input format

You can see examples of how to use this at: https://jsonpath.com/

**jsonparse(str)**

Parse a string of json into an object.

If this encounters invalid input, it will return null instead of throwing an error.

eg: `jsonparse('{"a":1}')` will be an object `{ a: 1 }`

**jsonstringify(obj)**

Convert an object into a json string.

If this encounters invalid input, it will return null instead of throwing an error.

eg: `jsonstringify({ a: 1 })` will be a string containing `{"a":1}`

**arrayIncludes(arr, val)**

Check if an array includes a value

If this encounters invalid input, it will return false

**arrayIndexOf(arr, val)**

Find the index of the first occurrence of a value within the provided array.

Optionally provide an offset to begin the search from, otherwise it starts from position 0 (the beginning).

If the value isn't found, it will return -1, otherwise the index of the first occurrence.

**arrayLastIndexOf(val, find, offset)**

Find the index of the last occurrence of a value within the provided array, searching from the end.

Optionally provide an offset to begin the search from, searching from the end.

If the value isn't found, it will return -1, otherwise the index of the last occurrence. The beginning is position 0.

##### Time operations

**unixNow()**

Get the current unix time in milliseconds.

**timestampToSeconds(timestamp)**

Convert a timestamp of format 'HH:MM:SS' into the number of seconds it represents.

eg `00:10:15` gives 615

You can do the reverse of this with `secondsToTimestamp(str)`

**secondsToTimestamp(seconds, format)**

Convert a number of seconds into a timestamp of format 'n:HH:mm:ss'.

By supplying the format parameter, you can choose which components will be included in the output string.

The following components are allowed:

- `n` - minus sign
- `dd` - days
- `HH` / `hh` - 12 hour / 24 hours
- `mm` - minutes
- `ss` - seconds
- `a` - AM/PM decorator

**msToTimestamp(milliseconds, format)**

Convert a number of milliseconds into a timestamp of format 'n:HH:mm:ss.SSS'.

By supplying the format parameter, you can choose which components will be included in the output string.

The following components are allowed:

- `n` - minus sign
- `dd` - days
- `HH` / `hh` - 12 hour / 24 hours
- `mm` - minutes
- `ss` - seconds
- `S` / `SS` / `SSS` - milliseconds, in varying levels of accuracy
- `a` - AM/PM decorator

**timeOffset(timestamp, offset, 12hour)**

Offset a provided timestamp (supporting `hours:minutes` or `hours:minutes:seconds`) by a given number of hours, minutes, or seconds, and optionally return in 12 hour format.

eg `timeOffset($(internal:time_hms), -5)` will return the hours, minutes, and seconds, of 5 hours prior to the current time.

The offset also supports a timestamp, so `timeOffset($(internal:time_hms), "01:30:00", true)` will add 1 hour and 30 minutes to the current time, and return a 12 hour clock adjusted to that time.

**timeDiff(fromTime, toTime)**

Return the number of seconds between 2 timestamps. Timestamps support `hours:minutes`, `hours:minutes:seconds`, and `YYYY-MM-DDTHH:mm:ss.sssZ`.

eg `timeDiff($(internal:time_hms), "18:00:00")` will return the seconds until `18:00:00` on the same day, and after that time will return a negative value.
An example using a Date Time String could be `timeDiff($(internal:time_hms), "2024-07-04T20:00-04:00")` which would return the number of seconds from the current Companion time until 4th July 2024, 8pm, in the UTC-4 Timezone.

The returned seconds can also be used within `secondsToTimestamp` to format the result as needed.
