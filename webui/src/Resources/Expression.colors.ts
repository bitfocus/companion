import { colord } from 'colord'
import type { editor, languages } from 'monaco-editor'

/**
 * Monaco ships a built-in colour detector which runs over the raw document text. In an expression
 * that is actively harmful: it decorates things which are not colours (any `rgb(...)`/`hsl(...)`
 * shaped call, a `#abcdef` in a comment) and its colour picker rewrites the matched text in place,
 * happily turning a valid expression into a syntax error - or rewriting `'#ff0000'` into a format
 * Companion doesn't expect.
 *
 * So we register our own colour provider which only reports colours found inside string literals,
 * where a rewrite can never change the meaning of the surrounding code. With
 * `defaultColorDecorators: 'auto'` (the default), Monaco skips its built-in detector as soon as a
 * registered provider returns an array - including an empty one - so the hazard is gone even for
 * expressions which contain no strings at all.
 */

/** A range of characters within a single line. 0-based offsets, `end` is exclusive. */
export interface TextSpan {
	start: number
	end: number
}

export interface LineColorMatch extends TextSpan {
	color: languages.IColor
}

/** Minimal shape of Monaco's internal `LineTokens`, so the span extraction can be tested */
export interface LineTokensLike {
	getCount(): number
	getStandardTokenType(tokenIndex: number): number
	getStartOffset(tokenIndex: number): number
	getEndOffset(tokenIndex: number): number
}

// https://github.com/microsoft/vscode/blob/main/src/vs/editor/common/encodedTokenAttributes.ts
const STANDARD_TOKEN_TYPE_STRING = 2

// Hex is listed longest-first so `#rrggbbaa` isn't matched as `#rrggbb` with two characters left
// over, and is followed by a check that no further hex digit follows. Everything matched here is
// validated by colord before being reported, so the functional notations can stay loose.
const COLOR_CANDIDATE_REGEX =
	/#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{4}|[0-9a-fA-F]{3})(?![0-9a-fA-F])|\b(?:rgba?|hsla?)\([^()]*\)/g

/**
 * Collect the spans of a line which are part of a string literal.
 * Touching spans are merged, so a string which is split into multiple tokens (eg around an escape
 * sequence) still reads as one region.
 */
export function stringSpansFromLineTokens(tokens: LineTokensLike): TextSpan[] {
	const spans: TextSpan[] = []

	const count = tokens.getCount()
	for (let i = 0; i < count; i++) {
		if (tokens.getStandardTokenType(i) !== STANDARD_TOKEN_TYPE_STRING) continue

		const start = tokens.getStartOffset(i)
		const end = tokens.getEndOffset(i)

		const previous = spans[spans.length - 1]
		if (previous && previous.end === start) {
			previous.end = end
		} else {
			spans.push({ start, end })
		}
	}

	return spans
}

/**
 * Find the colours within a line, ignoring anything which isn't wholly inside one of the given
 * string spans. The quote characters themselves are part of the string tokens, but can never be part
 * of a match, so they are never included in the returned range.
 */
export function findColorsInLine(line: string, stringSpans: readonly TextSpan[]): LineColorMatch[] {
	if (stringSpans.length === 0) return []

	const matches: LineColorMatch[] = []

	COLOR_CANDIDATE_REGEX.lastIndex = 0
	let match: RegExpExecArray | null
	while ((match = COLOR_CANDIDATE_REGEX.exec(line)) !== null) {
		const start = match.index
		const end = start + match[0].length

		// The whole colour has to sit inside one string, otherwise editing it would rewrite code
		if (!stringSpans.some((span) => span.start <= start && span.end >= end)) continue

		const parsed = colord(match[0])
		if (!parsed.isValid()) continue

		const { r, g, b, a } = parsed.toRgb()
		matches.push({
			start,
			end,
			color: { red: r / 255, green: g / 255, blue: b / 255, alpha: a },
		})
	}

	return matches
}

/**
 * The formats offered when a colour is picked. Hex comes first as that is both the shortest form and
 * how colours are usually written in Companion, so it is what the picker writes back by default.
 */
export function formatColorPresentations(color: languages.IColor): string[] {
	const parsed = colord({
		r: Math.round(color.red * 255),
		g: Math.round(color.green * 255),
		b: Math.round(color.blue * 255),
		a: color.alpha,
	})

	return [parsed.toHex(), parsed.toRgbString(), parsed.toHslString()]
}

let loggedTokenizationFailure = false

export const companionExpressionColorProvider: languages.DocumentColorProvider = {
	provideDocumentColors: (model) => {
		const colors: languages.IColorInformation[] = []

		try {
			// Monaco's tokenization API is not public, but it is the only way to know which parts of the
			// document are strings without reimplementing the tokenizer. The completion provider in
			// Expression.monarch.ts relies on the same thing.
			const tokenization = (model as any).tokenization

			for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
				// The colour detector runs on a debounce, so a line may not have been tokenized yet
				tokenization.forceTokenization(lineNumber)

				const stringSpans = stringSpansFromLineTokens(tokenization.getLineTokens(lineNumber))
				if (stringSpans.length === 0) continue

				for (const colorMatch of findColorsInLine(model.getLineContent(lineNumber), stringSpans)) {
					colors.push({
						color: colorMatch.color,
						range: {
							startLineNumber: lineNumber,
							endLineNumber: lineNumber,
							startColumn: colorMatch.start + 1,
							endColumn: colorMatch.end + 1,
						},
					})
				}
			}
		} catch (e) {
			// Returning an array - even an empty one - is what stops Monaco falling back to its built-in
			// detector, so swallow the error rather than letting the unsafe decorators come back.
			if (!loggedTokenizationFailure) {
				loggedTokenizationFailure = true
				console.error('Failed to find colors in expression:', e)
			}
			return []
		}

		return colors
	},

	provideColorPresentations: (_model: editor.ITextModel, colorInfo: languages.IColorInformation) =>
		formatColorPresentations(colorInfo.color).map((label) => ({
			label,
			textEdit: { range: colorInfo.range, text: label },
		})),
}
