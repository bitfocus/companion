import { FONT_COMPATIBILITY_FACTOR, type CompanionImageContext2D } from './ImageBase.js'

/**
 * Cached text layout result
 */
export interface TextLayoutResult {
	fontDefinition: string
	lines: { text: string; chars?: string[]; ascent: number; descent: number; fitsH?: boolean }[]
	measuredLineHeight: number
	measuredAscent: number
	totalHeight: number
	fits: boolean
}

/**
 * Split the input into an array of unicode characters, efficiently iterating only up to the limit
 * @param text Input text
 * @param maxAllowedChars Maximum number of characters
 */
export function segmentTextToUnicodeChars(
	text: string,
	maxAllowedChars: number
): { displayTextChars: string[]; displayTextCharsStr: string; wasTruncated: boolean } {
	const segmenter = new Intl.Segmenter()
	const segments = segmenter.segment(text)
	const displayTextChars: string[] = new Array(Math.min(text.length, maxAllowedChars))

	let charCount = 0
	let wasTruncated = false
	for (const { segment } of segments) {
		if (charCount >= maxAllowedChars) {
			wasTruncated = true
			break
		}
		displayTextChars[charCount++] = segment
	}

	// Trim array to actual size
	displayTextChars.length = charCount

	return {
		displayTextChars,
		displayTextCharsStr: wasTruncated ? displayTextChars.join('') : text,
		wasTruncated,
	}
}

/** Minimum auto font size as a fraction of canvas height (10%) */
export const MIN_FONT_SIZE_FRACTION = 0.1

/**
 * returns a list of font sizes to try when shrinking the text to fit or the configured size without shrink to fit
 */
export function resolveFontSizes(
	w: number,
	h: number,
	fontsize: number,
	allowShrink: boolean,
	charCount: number
): number[] {
	// Clamp the configured size to a sane pixel range (minimum is calibrated to 72px reference height)
	const clamped = Math.min(Math.max(fontsize, Math.round(h / 24)), h)

	if (!allowShrink) {
		return [clamped]
	}

	// Estimate how many characters fit per font-height-squared of available area.
	// Capacity at fraction s ≈ (w/h) / (s² × char_aspect), so threshold comparisons
	// should use w/h — purely relative, resolution-independent.
	const relativeWidth = w / h

	// Sizes expressed as fractions of canvas height
	let baseSizes: number[]
	if (charCount < 7 * relativeWidth) {
		baseSizes = [0.83, 0.71, 0.61, 0.43, 0.33, 0.28, 0.24, 0.21, 0.17, 0.14, 0.13, 0.11, MIN_FONT_SIZE_FRACTION]
	} else if (charCount < 30 * relativeWidth) {
		baseSizes = [0.43, 0.33, 0.28, 0.24, 0.21, 0.17, 0.14, 0.13, 0.11, MIN_FONT_SIZE_FRACTION]
	} else if (charCount < 40 * relativeWidth) {
		baseSizes = [0.33, 0.28, 0.24, 0.21, 0.17, 0.14, 0.13, 0.11, MIN_FONT_SIZE_FRACTION]
	} else if (charCount < 50 * relativeWidth) {
		baseSizes = [0.24, 0.21, 0.17, 0.14, 0.13, 0.11, MIN_FONT_SIZE_FRACTION]
	} else {
		baseSizes = [0.21, 0.17, 0.14, 0.13, 0.11, MIN_FONT_SIZE_FRACTION]
	}

	// When fontsize equals h the caller is signalling "use heuristics only" (no user-chosen cap),
	// so we skip prepending the configured size and just return the heuristic list.
	const prependConfigured = fontsize !== h

	// Start with the configured size (if appropriate), then add heuristic candidates smaller than it
	const seen = new Set<number>()
	const candidates: number[] = []

	if (prependConfigured) {
		seen.add(clamped)
		candidates.push(clamped)
	}

	// Multiply fraction by h to get pixel size; only include sizes strictly below the cap,
	// and deduplicate while preserving order
	for (const s of baseSizes) {
		const v = Math.max(s * h, 1)
		if (!seen.has(v) && v < clamped) {
			seen.add(v)
			candidates.push(v)
		}
	}

	return candidates
}

/**
 * Compute text layout  
 * breaks text into lines and determines if it fits. Line breaking will be done from start to end, if showing lines bottom aligned it may be suboptimal.
 * @param context2d - the canvas context used to do test renderings
 * @param w - the width in pixels of that context you want to fit in
 * @param h - the height in pixels of that context you want to fit in
 * @param displayTextChars - an array holding the text that should be drawn, intentionally an array to keep the bytes of an unicode character together
 * @param fontDefinition - definition of the font to use for the check
 * @param exitEarly - if set the layouting process will be abortet as soon as it is clear that the text will not fit with the given parameters, if unset the complete layout will be generated even if it overflows. Defaults to `false`
 */
export function computeTextLayout(
	context2d: CompanionImageContext2D,
	w: number,
	h: number,
	displayTextChars: string[],
	fontDefinition: string,
	exitEarly = false
): TextLayoutResult {
	const layout = {
		fontDefinition,
		lines: [] as any[],
		measuredLineHeight: 0,
		measuredAscent: 0,
		totalHeight: 0,
		fits: false,
	}

	context2d.font = fontDefinition
	// context2d.textWrap = false

	/** Maximum height of the text block.
	 * A tiny tolerance absorbs floating-point rounding so a line box sized to exactly
	 * fill the box (100%) is not spuriously rejected and shrunk to the next candidate.
	 */
	const verticalFitLimit = h + h * 1e-4

	// Measure the line height with a consistent string, to avoid issues with emoji being too tall
	const lineHeightSample = context2d.measureText('A')
	const measuredLineHeight =
		lineHeightSample.fontBoundingBoxAscent * FONT_COMPATIBILITY_FACTOR +
		lineHeightSample.fontBoundingBoxDescent * FONT_COMPATIBILITY_FACTOR
	const measuredAscent = lineHeightSample.fontBoundingBoxAscent * FONT_COMPATIBILITY_FACTOR

	layout.measuredLineHeight = measuredLineHeight
	layout.measuredAscent = measuredAscent

	// do first and cheap height check
	if (measuredLineHeight > verticalFitLimit && exitEarly) return layout

	/** accumulated height of the lines, used check height constrained on the way */
	let totalHeight = 0

	/**
	 * Finds the position of the last char of a line that still fits in the width
	 * @param textChars array with all the chars
	 * @returns an object with the ascend and the descent of the measured test and the number of fitting chars in maxCodepoints
	 */
	const findLastChar = (textChars: string[]): { ascent: number; descent: number; maxCodepoints: number } => {
		// skia-canvas built-in line break algorithm is poor
		// const substring = (arr: any[], start: number, end: number) => {
		// 	return arr.slice(start, end).join('')
		// }
		const length = textChars.length
		// console.log('\nstart linecheck for', textChars.join(''), 'in width', w, 'chars', length)

		// let's check how far we're off
		const measure = context2d.measureText(textChars.join(''))
		/** The measured ascent of the bounding box of the current line */
		const ascent = measure.fontBoundingBoxAscent * FONT_COMPATIBILITY_FACTOR
		/** The measured descent of the bounding box of the current line */
		const descent = measure.fontBoundingBoxDescent * FONT_COMPATIBILITY_FACTOR
		let diff = w - measure.width
		// console.log('measured width', measure.width, 'diff', diff)

		// if all fits we are done
		if (diff >= 0) {
			return {
				ascent,
				descent,
				maxCodepoints: length,
			}
		}

		// ok, we are not done. let's start with an assumption of how big one char is in average
		const nWidth = measure.width / length
		// how many chars fit probably in one line
		let chars = Math.round(w / nWidth)

		diff = w - context2d.measureText(textChars.slice(0, chars).join('')).width // check our guessed length
		// console.log(
		// 	'average char width',
		// 	nWidth,
		// 	'estimated chars per line',
		// 	chars,
		// 	'difference of estimated substring to line length',
		// 	diff
		// )

		if (Math.abs(diff) > nWidth) {
			// we seem to be off by more than one char
			// what is the needed difference in chars
			let chardiff = Math.round(diff / nWidth)
			let lastCheckedChars = 0

			while (Math.abs(chars - lastCheckedChars) > 1) {
				chars += chardiff // apply assumed difference
				diff = w - context2d.measureText(textChars.slice(0, chars).join('')).width
				lastCheckedChars = chars
				// console.log(
				// 	'while checking',
				// 	textChars.slice(0, chars).join(''),
				// 	chars,
				// 	'diff',
				// 	diff,
				// 	'nWidth',
				// 	nWidth,
				// 	'chardiff',
				// 	chardiff
				// )
				chardiff = Math.round(diff / nWidth)
			}
		}
		// we found possible closest match, check if the assumed nWidth was not too big
		// console.log(
		// 	'possible match',
		// 	substring(textChars, 0, chars),
		// 	'diff',
		// 	diff,
		// 	'nWidth',
		// 	nWidth,
		// 	'chardiff',
		// 	Math.round(diff / nWidth)
		// )
		for (let i = 0; i <= length; i += 1) {
			if (diff == 0 || (diff < 0 && chars == 1)) {
				// perfect match or one char is too wide meaning we can't try less
				// console.log('line algo says perfect match with ' + chars + ' chars', substring(textChars, 0, chars))
				return {
					ascent,
					descent,
					maxCodepoints: chars,
				}
			} else if (diff > 0 && w - context2d.measureText(textChars.slice(0, chars + 1).join('')).width < 0) {
				// we are smaller and next char is too big
				// console.log(
				// 	'line algo says ' + chars + ' chars are smaller',
				// 	substring(textChars, 0, chars),
				// 	context2d.measureText(substring(textChars, 0, chars)).width
				// )
				return {
					ascent,
					descent,
					maxCodepoints: chars,
				}
			} else if (diff < 0 && w - context2d.measureText(textChars.slice(0, chars - 1).join('')).width > 0) {
				// we are bigger and one less char fits
				// console.log(
				// 	'line algo says ' + chars + ' chars are bigger',
				// 	substring(textChars, 0, chars - 1),
				// 	context2d.measureText(substring(textChars, 0, chars - 1)).width
				// )
				return {
					ascent,
					descent,
					maxCodepoints: chars - 1,
				}
			} else {
				// our assumed nWidth was too big, let's approach now char by char
				if (diff > 0) {
					// console.log('nope, make it one longer')
					chars += 1
				} else {
					// console.log('nope, make it one shorter')
					chars -= 1
				}
				diff = w - context2d.measureText(textChars.slice(0, chars).join('')).width
			}
		}

		// console.log('line algo failed', chars)
		return { ascent, descent, maxCodepoints: length }
	}

	// console.log('processing layout for', displayTextChars.join(''), fontDefinition.substring(0, 20))
	// first split the text into lines by existing line breaks

	const splitToLines = (chars: string[]): string[][] => {
		const result: string[][] = []
		let chunk: string[] = []

		for (const char of chars) {
			if (char === '\n') {
				result.push(chunk)
				chunk = []
			} else {
				chunk.push(char)
			}
		}

		result.push(chunk)
		return result
	}
	const lines: { chars: string[]; text: string; ascent: number; descent: number; fitsH?: boolean }[] = splitToLines(
		displayTextChars
	).map((chars) => {
		return { chars, text: '', ascent: 0, descent: 0 }
	})

	// console.log('lines are', JSON.stringify(lines, null, 2))

	const makeLayout = () => {
		const strippedLines = lines.map((line) => {
			return { text: line.text, ascent: line.ascent, descent: line.descent }
		})

		layout.lines = strippedLines
		layout.totalHeight = totalHeight

		// Check if text fits
		const fitsVertically = totalHeight <= verticalFitLimit
		const fitsHorizontally = !lines.some((line) => line.fitsH === false)
		layout.fits = fitsHorizontally && fitsVertically

		return layout
	}

	// now check if each line fits or if we have to split it again

	let currentLine = 0
	while (currentLine < lines.length) {
		// console.log('length check for line', currentLine, lines[currentLine].text)
		let lastDrawnCharIndex = 0
		const lineChars: string[] = lines[currentLine].chars

		// get rid of one space at line start, but keep more spaces
		if (lineChars[0] === ' ') lineChars.shift()

		// if line is (now) empty there is no need for expensive measurement
		if (lineChars.length === 0) {
			lines[currentLine] = {
				chars: [],
				text: '',
				ascent: lineHeightSample.fontBoundingBoxAscent * FONT_COMPATIBILITY_FACTOR,
				descent: lineHeightSample.fontBoundingBoxDescent * FONT_COMPATIBILITY_FACTOR,
				fitsH: true,
			}
			totalHeight += measuredLineHeight
			if (totalHeight > verticalFitLimit && exitEarly) return makeLayout()

			currentLine++

			continue
		}

		// check if remaining text of line fits in width
		const maxCharsPerLine = w // Limit how many characters we attempt to draw per line, no need to draw more chars than we have pixels (beware this pixels are not necessaryily the numbers of pixels of the real canvas)
		const { maxCodepoints, ascent, descent } = findLastChar(lineChars.slice(0, maxCharsPerLine))

		// console.log(
		// 	`check text "${lineChars.join('')}" arr=${lineChars.slice(0, maxCharsPerLine)} lastDrawnCharIndex=${lastDrawnCharIndex} length=${lineChars.length - lastDrawnCharIndex} max=${maxCodepoints}`
		// )
		if (maxCodepoints >= lineChars.length) {
			// console.log(`line ${currentLine} width fits`)
			lines[currentLine] = {
				chars: lineChars,
				text: lineChars.join('').trimEnd(),
				ascent,
				descent,
				fitsH: true,
			}
			totalHeight += ascent + descent
			// console.log(
			// 	'lines are now',
			// 	lines.map((line) => line.text)
			// )
			lastDrawnCharIndex = lineChars.length
		} else {
			// console.log(`line ${currentLine} is too long by ${lineChars.length - maxCodepoints} chars`)
			// no early exit possible here

			const possibleLine = lineChars.slice(lastDrawnCharIndex, lastDrawnCharIndex + maxCodepoints)

			// lets look for a good break point
			let breakPos = possibleLine.length - 1 // breakPos is the 0-indexed position of the char where a break can be done
			let breakFound = false
			for (let i = breakPos; i > 0; i -= 1) {
				if (
					possibleLine[i] === ' ' || // space
					possibleLine[i] === '-' || // -
					possibleLine[i] === '_' || // _
					possibleLine[i] === ':' || // :
					possibleLine[i] === '~' // ~
				) {
					breakPos = i
					breakFound = true
					break
				}
			}

			if (breakFound) {
				// we found a good breaking position in the line, update the current line with the part before the break
				const partialLine = possibleLine.slice(0, breakPos + 1)
				lines[currentLine] = {
					chars: partialLine,
					text: partialLine.join('').trimEnd(),
					ascent,
					descent,
					fitsH: true,
				}
				totalHeight += ascent + descent

				// insert a new line with the remaining part
				const remainingLine = lineChars.slice(breakPos + 1)
				lines.splice(currentLine + 1, 0, {
					chars: remainingLine,
					text: remainingLine.join(''),
					ascent,
					descent,
				})
				// console.log(
				// 	'broke one line at good pos, lines are now',
				// 	lines.map((line) => line.text)
				// )
			} else {
				// we did not find a good breaking position, push the maximum chars to the line (breaking inside a word) and mark it
				if (exitEarly) return makeLayout()
				if (possibleLine.length >= 1) {
					lines[currentLine] = {
						chars: possibleLine,
						text: possibleLine.join('').trimEnd(),
						ascent,
						descent,
						fitsH: false,
					}
					totalHeight += ascent + descent
					// insert a new line with the remaining part
					const remainingLine = lineChars.slice(possibleLine.length)
					lines.splice(currentLine + 1, 0, {
						chars: remainingLine,
						text: remainingLine.join(''),
						ascent,
						descent,
					})
					// console.log(
					// 	'broke one line at bad pos, lines are now',
					// 	lines.map((line) => line.text)
					// )
				} else {
					// the text is so big that not even a single char fits, but we have to place at least one char in a line anyhow to get finished eventually
					lines[currentLine] = {
						chars: [lineChars[0]],
						text: lineChars[0],
						ascent,
						descent,
						fitsH: false,
					}
					totalHeight += ascent + descent
					// insert a new line with the remaining part
					lines.splice(currentLine + 1, 0, {
						chars: lineChars.slice(1),
						text: lineChars.slice(1).join(''),
						ascent,
						descent,
					})
					// console.log(
					// 	'broke one line desperately at first pos, lines are now',
					// 	lines.map((line) => line.text)
					// )
				}
			}
		}
		if (totalHeight > verticalFitLimit && exitEarly) return makeLayout()

		currentLine++
	}
	// console.log(
	// 	'line breaking finished',
	// 	lines.map((line) => `${line.text} asc${line.ascent.toFixed(2)} des${line.descent.toFixed(2)} fitsH:${line.fitsH}`)
	// )

	return makeLayout()
}
