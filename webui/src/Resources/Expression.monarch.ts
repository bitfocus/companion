import type { languages, IRange } from 'monaco-editor'
import type { DropdownChoiceInt } from '~/DropDownInputFancy.js'
import type * as Monaco from 'monaco-editor/esm/vs/editor/editor.api.d.ts' // In theory importable with import type { Monaco } from '@monaco-editor/react'

export const COMPANION_EXPRESSION_LANGUAGE_ID = 'companionExpression'

export function registerCompanionExpressionLanguage(monaco: typeof Monaco): void {
	if (!monaco.languages.getLanguages().some((l) => l.id === COMPANION_EXPRESSION_LANGUAGE_ID)) {
		monaco.languages.register({ id: COMPANION_EXPRESSION_LANGUAGE_ID })
	}
	monaco.languages.setLanguageConfiguration(COMPANION_EXPRESSION_LANGUAGE_ID, companionExpressionLanguageConfiguration)
	monaco.languages.setMonarchTokensProvider(COMPANION_EXPRESSION_LANGUAGE_ID, companionExpressionTokensProvider)
	monaco.languages.registerCompletionItemProvider(
		COMPANION_EXPRESSION_LANGUAGE_ID,
		companionExpressionCompletionItemProvider
	)

	// Define custom theme for Companion Expression language (based on JavaScript colors)
	monaco.editor.defineTheme('companion-expression-light', {
		base: 'vs',
		inherit: true,
		rules: [
			{ token: 'variable.companion', foreground: '001080', fontStyle: 'bold' }, // Companion variables - same color as identifiers, but bold
			{ token: 'predefined', foreground: '795E26' }, // Built-in functions - brownish (like JS functions)
			{ token: 'keyword', foreground: '0000FF' }, // Keywords - blue (classic JS keywords)
			{ token: 'string', foreground: 'A31515' }, // Strings - red (JS string color)
			{ token: 'string.escape', foreground: 'EE0000' }, // String escapes - bright red
			{ token: 'number', foreground: '098658' }, // Numbers - green (JS number color)
			{ token: 'number.hex', foreground: '098658' },
			{ token: 'number.octal', foreground: '098658' },
			{ token: 'number.binary', foreground: '098658' },
			{ token: 'number.float', foreground: '098658' },
			{ token: 'operator', foreground: '000000' }, // Operators - black (default)
			{ token: 'delimiter', foreground: '000000' }, // Delimiters - black
			{ token: 'delimiter.bracket', foreground: '000000' }, // Brackets - black
			{ token: 'comment', foreground: '008000', fontStyle: 'italic' }, // Comments - green (JS comment color)
			{ token: 'identifier', foreground: '001080' }, // Identifiers - dark blue (JS identifiers)
		],
		colors: {},
	})
}

export const builtinFunctionCompletions: Array<{
	name: string
	detail: string
	documentation?: string
}> = [
	// General operations
	{ name: 'length', detail: 'length(value)', documentation: 'Returns the length of a string, array, or object' },

	// Number operations
	{ name: 'round', detail: 'round(number)', documentation: 'Rounds a number to the nearest integer' },
	{ name: 'floor', detail: 'floor(number)', documentation: 'Rounds a number down to the nearest integer' },
	{ name: 'ceil', detail: 'ceil(number)', documentation: 'Rounds a number up to the nearest integer' },
	{ name: 'abs', detail: 'abs(number)', documentation: 'Returns the absolute value of a number' },
	{
		name: 'fromRadix',
		detail: 'fromRadix(string, radix)',
		documentation: 'Parses a string as an integer in the specified radix',
	},
	{
		name: 'toRadix',
		detail: 'toRadix(number, radix)',
		documentation: 'Converts a number to a string in the specified radix',
	},
	{
		name: 'toFixed',
		detail: 'toFixed(number, decimals)',
		documentation: 'Formats a number with a fixed number of decimal places',
	},
	{ name: 'isNumber', detail: 'isNumber(value)', documentation: 'Returns true if the value is a valid number' },
	{ name: 'max', detail: 'max(...numbers)', documentation: 'Returns the maximum value' },
	{ name: 'min', detail: 'min(...numbers)', documentation: 'Returns the minimum value' },
	{
		name: 'randomInt',
		detail: 'randomInt(min, max)',
		documentation: 'Returns a random integer between min and max',
	},
	{ name: 'log', detail: 'log(number)', documentation: 'Returns the natural logarithm of a number' },
	{ name: 'log10', detail: 'log10(number)', documentation: 'Returns the base-10 logarithm of a number' },

	// String operations
	{ name: 'trim', detail: 'trim(string)', documentation: 'Removes whitespace from both ends of a string' },
	{ name: 'strlen', detail: 'strlen(string)', documentation: 'Returns the byte length of a string' },
	{
		name: 'substr',
		detail: 'substr(string, start, end)',
		documentation: 'Extracts a substring from a string',
	},
	{
		name: 'split',
		detail: 'split(string, separator)',
		documentation: 'Splits a string into an array by a separator',
	},
	{
		name: 'join',
		detail: 'join(array, separator)',
		documentation: 'Joins array elements into a string with a separator',
	},
	{ name: 'concat', detail: 'concat(...strings)', documentation: 'Concatenates multiple strings' },
	{
		name: 'includes',
		detail: 'includes(string, substring)',
		documentation: 'Returns true if string contains substring',
	},
	{
		name: 'indexOf',
		detail: 'indexOf(string, substring, offset)',
		documentation: 'Returns the index of the first occurrence of substring',
	},
	{
		name: 'lastIndexOf',
		detail: 'lastIndexOf(string, substring, offset)',
		documentation: 'Returns the index of the last occurrence of substring',
	},
	{ name: 'toUpperCase', detail: 'toUpperCase(string)', documentation: 'Converts string to uppercase' },
	{ name: 'toLowerCase', detail: 'toLowerCase(string)', documentation: 'Converts string to lowercase' },
	{
		name: 'replaceAll',
		detail: 'replaceAll(string, find, replace)',
		documentation: 'Replaces all occurrences of find with replace',
	},
	{
		name: 'decode',
		detail: 'decode(string, encoding)',
		documentation: 'Decodes a string from specified encoding',
	},
	{
		name: 'encode',
		detail: 'encode(string, encoding)',
		documentation: 'Encodes a string to specified encoding',
	},
	{
		name: 'encodeURI',
		detail: 'encodeURI(string)',
		documentation: 'Encodes a string as a valid Uniform Resource Identifier (URI)',
	},
	{
		name: 'decodeURI',
		detail: 'decodeURI(string)',
		documentation: 'Gets the unencoded version of an encoded Uniform Resource Identifier (URI)',
	},
	{
		name: 'encodeURIComponent',
		detail: 'encodeURIComponent(string)',
		documentation: 'Encodes a string as a valid component of a Uniform Resource Identifier (URI)',
	},
	{
		name: 'decodeURIComponent',
		detail: 'decodeURIComponent(string)',
		documentation: 'Gets the unencoded version of an encoded component of a Uniform Resource Identifier (URI)',
	},

	// Bool operations
	{ name: 'bool', detail: 'bool(value)', documentation: 'Converts a value to boolean' },

	// Variable operations
	{
		name: 'parseVariables',
		detail: 'parseVariables(string, ?undefinedValue)',
		documentation: 'Parses and resolves Companion variables in a string',
	},
	{
		name: 'getVariable',
		detail: 'getVariable(variableId)',
		documentation: 'Fetches the value of a Companion variable',
	},
	{
		name: 'getVariable',
		detail: 'getVariable(label, name)',
		documentation: 'Fetches the value of a Companion variable',
	},

	// Object/array operations
	{
		name: 'jsonpath',
		detail: 'jsonpath(object, path)',
		documentation: 'Queries an object using JSONPath syntax',
	},
	{ name: 'jsonparse', detail: 'jsonparse(string)', documentation: 'Parses a JSON string' },
	{ name: 'jsonstringify', detail: 'jsonstringify(object)', documentation: 'Converts an object to JSON string' },
	{
		name: 'arrayIncludes',
		detail: 'arrayIncludes(array, value)',
		documentation: 'Returns true if array contains value',
	},
	{
		name: 'arrayIndexOf',
		detail: 'arrayIndexOf(array, value, offset)',
		documentation: 'Returns the index of value in array',
	},
	{
		name: 'arrayLastIndexOf',
		detail: 'arrayLastIndexOf(array, value, offset)',
		documentation: 'Returns the last index of value in array',
	},

	// Time operations
	{ name: 'unixNow', detail: 'unixNow()', documentation: 'Returns the current Unix timestamp in milliseconds' },
	{
		name: 'timestampToSeconds',
		detail: 'timestampToSeconds(string)',
		documentation: 'Converts a HH:MM:SS timestamp to seconds',
	},
	{
		name: 'secondsToTimestamp',
		detail: 'secondsToTimestamp(seconds, format)',
		documentation: 'Converts seconds to a timestamp string',
	},
	{
		name: 'msToTimestamp',
		detail: 'msToTimestamp(milliseconds, format)',
		documentation: 'Converts milliseconds to a timestamp string',
	},
	{
		name: 'timeOffset',
		detail: 'timeOffset(time, offset, hr12)',
		documentation: 'Adds an offset to a time string',
	},
	{
		name: 'timeDiff',
		detail: 'timeDiff(from, to)',
		documentation: 'Calculates the difference between two times in seconds',
	},
]

const keywords = ['return', 'undefined']
const typeKeywords = ['true', 'false', 'null']

const companionExpressionLanguageConfiguration: languages.LanguageConfiguration = {
	comments: {
		lineComment: '//',
		blockComment: ['/*', '*/'],
	},
	// Treat Companion variables like $(foo:bar) as a single word for navigation/selection
	wordPattern: /\$\([a-zA-Z0-9_\-:]+\)|[a-zA-Z_$][\w$]*/,
	brackets: [
		['{', '}'],
		['[', ']'],
		['(', ')'],
	],
	autoClosingPairs: [
		{ open: '{', close: '}' },
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
		{ open: '"', close: '"' },
		{ open: "'", close: "'" },
		{ open: '`', close: '`' },
	],
	surroundingPairs: [
		{ open: '{', close: '}' },
		{ open: '[', close: ']' },
		{ open: '(', close: ')' },
		{ open: '"', close: '"' },
		{ open: "'", close: "'" },
		{ open: '`', close: '`' },
	],
}

const companionExpressionTokensProvider: languages.IMonarchLanguage = {
	defaultToken: 'invalid',
	tokenPostfix: '.expr',

	keywords: keywords,

	builtinFunctions: builtinFunctionCompletions.map((fn) => fn.name),

	typeKeywords: typeKeywords,

	operators: [
		'<=',
		'>=',
		'==',
		'!=',
		'===',
		'!==',
		'=>',
		'++',
		'--',
		'<<',
		'>>',
		'&&',
		'||',
		'??',
		'+=',
		'-=',
		'*=',
		'**=',
		'/=',
		'%=',
		'<<=',
		'>>=',
		'&=',
		'|=',
		'^=',
		'||=',
		'&&=',
		'??=',
		'**',
		'+',
		'-',
		'*',
		'/',
		'%',
		'&',
		'|',
		'^',
		'~',
		'!',
		'=',
		'<',
		'>',
		'?',
		':',
	],

	// Common regular expressions
	symbols: /[=><!~?:&|+\-*/^%]+/,
	escapes: /\\(?:[abfnrtv\\"']|x[0-9A-Fa-f]{1,4}|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/,
	digits: /\d+(_+\d+)*/,
	octaldigits: /[0-7]+(_+[0-7]+)*/,
	binarydigits: /[0-1]+(_+[0-1]+)*/,
	hexdigits: /[[0-9a-fA-F]+(_+[0-9a-fA-F]+)*/,

	// The main tokenizer
	tokenizer: {
		root: [
			// Companion variables: $(variable:name)
			[/\$\([a-zA-Z0-9_\-:]+\)/, 'variable.companion'],

			// Identifiers and keywords
			[
				/[a-zA-Z_$][\w$]*/,
				{
					cases: {
						'@typeKeywords': 'keyword',
						'@keywords': 'keyword',
						'@builtinFunctions': 'predefined',
						'@default': 'identifier',
					},
				},
			],

			// Whitespace
			{ include: '@whitespace' },

			// Delimiters and operators
			[/[{}()[\]]/, '@brackets'],
			[/[<>](?!@symbols)/, '@brackets'],
			[
				/@symbols/,
				{
					cases: {
						'@operators': 'operator',
						'@default': '',
					},
				},
			],

			// Numbers
			[/(@digits)[eE]([-+]?(@digits))?/, 'number.float'],
			[/(@digits)\.(@digits)([eE][-+]?(@digits))?/, 'number.float'],
			[/0[xX](@hexdigits)/, 'number.hex'],
			[/0[oO]?(@octaldigits)/, 'number.octal'],
			[/0[bB](@binarydigits)/, 'number.binary'],
			[/(@digits)/, 'number'],

			// Delimiter: after number because of .\d floats
			[/[;,.]/, 'delimiter'],

			// Strings
			[/"([^"\\]|\\.)*$/, 'string.invalid'], // non-terminated string
			[/'([^'\\]|\\.)*$/, 'string.invalid'], // non-terminated string
			[/"/, 'string', '@string_double'],
			[/'/, 'string', '@string_single'],
			[/`/, 'string', '@string_backtick'],
		],

		whitespace: [
			[/[ \t\r\n]+/, ''],
			[/\/\*/, 'comment', '@comment'],
			[/\/\/.*$/, 'comment'],
		],

		comment: [
			[/[^/*]+/, 'comment'],
			[/\*\//, 'comment', '@pop'],
			[/[/*]/, 'comment'],
		],

		string_double: [
			[/[^\\"]+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./, 'string.escape.invalid'],
			[/"/, 'string', '@pop'],
		],

		string_single: [
			[/[^\\']+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./, 'string.escape.invalid'],
			[/'/, 'string', '@pop'],
		],

		string_backtick: [
			[/\$\{/, { token: 'delimiter.bracket', next: '@bracketCounting' }],
			[/[^\\`$]+/, 'string'],
			[/@escapes/, 'string.escape'],
			[/\\./, 'string.escape.invalid'],
			[/`/, 'string', '@pop'],
		],

		bracketCounting: [
			[/\{/, 'delimiter.bracket', '@bracketCounting'],
			[/\}/, 'delimiter.bracket', '@pop'],
			{ include: 'root' },
		],
	},
}

const companionExpressionCompletionItemProvider: languages.CompletionItemProvider = {
	triggerCharacters: ['('],
	provideCompletionItems: (model, position) => {
		const suggestions: languages.CompletionItem[] = []

		// Get companion variables from model metadata (typed via augmentation)
		const companionVariables: DropdownChoiceInt[] = model._companionVariables ?? []

		// Get the word being typed
		const word = model.getWordUntilPosition(position)
		const range: IRange = {
			startLineNumber: position.lineNumber,
			endLineNumber: position.lineNumber,
			startColumn: word.startColumn,
			endColumn: word.endColumn,
		}

		// Check if we're typing a companion variable
		const lineContent = model.getLineContent(position.lineNumber)
		const textBeforeCursor = lineContent.substring(0, position.column - 1)
		const textAfterCursor = lineContent.substring(position.column - 1)

		// Check if we're inside a string or comment using Monaco's internal tokenization API.
		// Note: This is not a public API, but it's the only way to reliably detect multiline
		// string/comment contexts without reimplementing a full parser. If Monaco changes this
		// API, this will throw and we'll know immediately rather than silently breaking.
		const tokens = (model as any).tokenization.getLineTokens(position.lineNumber)
		const tokenIndex: number = tokens.findTokenIndexAtOffset(position.column - 1)
		const tokenType: number = tokens.getStandardTokenType(tokenIndex)

		// Don't provide suggestions inside comments or strings (1=Comment, 2=String)
		// https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/encodedTokenAttributes.ts
		if (tokenType === 1 || tokenType === 2) {
			return { suggestions: [] }
		}

		const companionVarMatch = textBeforeCursor.match(/\$\([a-zA-Z0-9_\-:]*$/)

		if (companionVarMatch) {
			// We're inside a companion variable, suggest companion variables
			// Extract the text after $( that we're matching
			const afterDollarParen = companionVarMatch[0].substring(2) // Remove the $(
			const matchStart = position.column - afterDollarParen.length

			// Check if there's already a closing parenthesis after the cursor
			const hasClosingParen = textAfterCursor.startsWith(')')

			const companionRange: IRange = {
				startLineNumber: position.lineNumber,
				endLineNumber: position.lineNumber,
				startColumn: matchStart,
				endColumn: position.column,
			}

			for (const variable of companionVariables) {
				const variableId = String(variable.value)
				suggestions.push({
					label: variableId,
					kind: 4 satisfies languages.CompletionItemKind.Variable,
					detail: variable.label,
					insertText: hasClosingParen ? variableId : variableId + ')',
					range: companionRange,
				})
			}

			return { suggestions }
		}

		// Add built-in function completions
		for (const fn of builtinFunctionCompletions) {
			suggestions.push({
				label: fn.name,
				kind: 1 satisfies languages.CompletionItemKind.Function,
				detail: fn.detail,
				documentation: fn.documentation,
				insertText: fn.name,
				range: range,
			})
		}

		// Add keyword completions
		for (const keyword of [...keywords, ...typeKeywords]) {
			suggestions.push({
				label: keyword,
				kind: 17 satisfies languages.CompletionItemKind.Keyword,
				insertText: keyword,
				range: range,
			})
		}

		// Extract user-defined variables from the code
		const userDefinedVars = new Set<string>()
		const fullText = model.getValue()
		// Match variable assignments: identifier = value
		// This regex looks for identifiers followed by = (with optional whitespace)
		const varAssignmentRegex = /\b([a-zA-Z_$][\w$]*)\s*=/g
		let match
		while ((match = varAssignmentRegex.exec(fullText)) !== null) {
			const varName = match[1]
			// Exclude keywords and built-in functions
			if (
				!keywords.includes(varName) &&
				!typeKeywords.includes(varName) &&
				!builtinFunctionCompletions.some((fn) => fn.name === varName)
			) {
				userDefinedVars.add(varName)
			}
		}

		// Add user-defined variable completions
		for (const varName of userDefinedVars) {
			suggestions.push({
				label: varName,
				kind: 4 satisfies languages.CompletionItemKind.Variable,
				detail: 'User-defined variable',
				insertText: varName,
				range: range,
			})
		}

		// Note: intentionally not showing variable suggestions when not inside $(...), to avoid clutter

		return { suggestions }
	},
}
