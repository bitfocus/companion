import type { CanvasRenderingContext2D } from '@napi-rs/canvas'

/**
 * Cached text layout result
 */
export interface TextLayoutResult {
	fontDefinition: string
	lines: { text: string; ascent: number; descent: number }[]
	measuredLineHeight: number
	measuredAscent: number
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

export function resolveFontSizes(w: number, h: number, fontsize: number | 'auto', charCount: number): number[] {
	let fontheight = Number(fontsize)
	if (isNaN(fontheight)) {
		// narrow the sizes to check by guessing how many chars will fit at a size
		const area = (w * h) / 5000
		if (charCount < 7 * area) {
			return [60, 51, 44, 31, 24, 20, 17, 15, 12, 10, 9, 8, 7]
		} else if (charCount < 30 * area) {
			return [31, 24, 20, 17, 15, 12, 10, 9, 8, 7]
		} else if (charCount < 40 * area) {
			return [24, 20, 17, 15, 12, 10, 9, 8, 7]
		} else if (charCount < 50 * area) {
			return [17, 15, 12, 10, 9, 8, 7]
		} else {
			return [15, 12, 10, 9, 8, 7]
		}
	} else {
		if (fontheight < 3) {
			// block out some tiny fontsizes
			fontheight = 3
		} else if (fontheight > 120) {
			// block out some giant fontsizes
			fontheight = 120
		}
		return [fontheight]
	}
}

/**
 * Compute text layout - breaks text into lines and determines if it fits
 */
export function computeTextLayout(
	context2d: CanvasRenderingContext2D,
	w: number,
	h: number,
	displayTextChars: string[],
	fontDefinition: string
): TextLayoutResult {
	// breakup text in pieces
	const lines: { text: string; ascent: number; descent: number }[] = []
	let breakPos: number | null = null

	//if (fontsize < 9) fontfamily = '7x5'
	context2d.font = fontDefinition
	// context2d.textWrap = false

	// Measure the line height with a consistent string, to avoid issues with emoji being too tall
	const lineHeightSample = context2d.measureText('A')
	const measuredLineHeight = lineHeightSample.fontBoundingBoxAscent + lineHeightSample.fontBoundingBoxDescent
	const measuredAscent = lineHeightSample.fontBoundingBoxAscent

	const findLastChar = (textChars: string[]): { ascent: number; descent: number; maxCodepoints: number } => {
		// skia-canvas built-in line break algorithm is poor
		const length = textChars.length
		//console.log('\nstart linecheck for', text, 'in width', w, 'chars', length)

		// let's check how far we off
		const measure = context2d.measureText(textChars.join(''))
		let diff = w - measure.width

		// if all fits we are done
		if (diff >= 0) {
			return { ascent: measure.fontBoundingBoxAscent, descent: measure.fontBoundingBoxDescent, maxCodepoints: length }
		}

		// ok, we are not done. let's start with an assumption of how big one char is in average
		const nWidth = (w - diff) / length
		// how many chars fit probably in one line
		let chars = Math.round(w / nWidth)

		diff = w - context2d.measureText(textChars.slice(0, chars).join('')).width // check our guessed length

		if (Math.abs(diff) > nWidth) {
			// we seem to be off by more than one char
			// what is the needed difference in chars
			let chardiff = Math.round(diff / nWidth)
			let lastCheckedChars = 0

			while (Math.abs(chars - lastCheckedChars) > 1) {
				chars += chardiff // apply assumed difference
				diff = w - context2d.measureText(textChars.slice(0, chars).join('')).width
				lastCheckedChars = chars
				//console.log('while checking', substring(text, 0, chars), chars, 'diff', diff, 'nWidth', nWidth, 'chardiff', chardiff)
				chardiff = Math.round(diff / nWidth)
			}
		}
		// we found possible closest match, check if the assumed nWidth was not too big
		//console.log('possible match', substring(text, 0, chars), 'diff', diff, 'nWidth', nWidth, 'chardiff', Math.round(diff / nWidth))
		for (let i = 0; i <= length; i += 1) {
			if (diff == 0 || (diff < 0 && chars == 1)) {
				// perfect match or one char is too wide meaning we can't try less
				//console.log('line algo says perfect match with '+chars+' chars', substring(text, 0, chars));
				return {
					ascent: measure.fontBoundingBoxAscent,
					descent: measure.fontBoundingBoxDescent,
					maxCodepoints: chars,
				}
			} else if (diff > 0 && w - context2d.measureText(textChars.slice(0, chars + 1).join('')).width < 0) {
				// we are smaller and next char is too big
				//console.log('line algo says '+chars+' chars are smaller', substring(text, 0, chars), context2d.measureText(substring(text, 0, chars)).width);
				return {
					ascent: measure.fontBoundingBoxAscent,
					descent: measure.fontBoundingBoxDescent,
					maxCodepoints: chars,
				}
			} else if (diff < 0 && w - context2d.measureText(textChars.slice(0, chars - 1).join('')).width > 0) {
				// we are bigger and one less char fits
				//console.log('line algo says '+chars+' chars are bigger', substring(text, 0, chars-1), context2d.measureText(substring(text, 0, chars-1)).width);
				return {
					ascent: measure.fontBoundingBoxAscent,
					descent: measure.fontBoundingBoxDescent,
					maxCodepoints: chars - 1,
				}
			} else {
				// our assumed nWidth was too big, let's approach now char by char
				if (diff > 0) {
					//console.log('nope, make it one longer')
					chars += 1
				} else {
					//console.log('nope, make it one shorter')
					chars -= 1
				}
				diff = w - context2d.measureText(textChars.slice(0, chars).join('')).width
			}
		}

		//console.log('line algo failed', chars);
		return { ascent: measure.fontBoundingBoxAscent, descent: measure.fontBoundingBoxDescent, maxCodepoints: length }
	}

	let lastDrawnCharCount = 0
	while (lastDrawnCharCount < displayTextChars.length) {
		if ((lines.length + 1) * measuredLineHeight > h) {
			// Stop chunking once we have filled the full button height
			break
		}

		// get rid of one space at line start, but keep more spaces
		if (displayTextChars[lastDrawnCharCount] == ' ') {
			lastDrawnCharCount += 1
		}

		// check if remaining text fits in line
		const maxCharsPerLine = w // Limit how many characters we attempt to draw per line
		const { maxCodepoints, ascent, descent } = findLastChar(
			displayTextChars.slice(lastDrawnCharCount, lastDrawnCharCount + maxCharsPerLine)
		)

		//console.log(`check text "${textArr.slice(lastDrawnByte).join('')}" arr=${textArr} length=${textArr.length - lastDrawnByte} max=${maxCodepoints}`)
		if (maxCodepoints >= displayTextChars.length - lastDrawnCharCount) {
			let buf: string[] = []
			for (let i = lastDrawnCharCount; i < displayTextChars.length; i += 1) {
				if (displayTextChars[i].codePointAt(0) === 10) {
					lines.push({ text: buf.join(''), ascent, descent })
					buf = []
				} else {
					buf.push(displayTextChars[i])
				}
			}
			lines.push({ text: buf.join(''), ascent, descent })
			lastDrawnCharCount = displayTextChars.length
		} else {
			const line = displayTextChars.slice(lastDrawnCharCount, lastDrawnCharCount + maxCodepoints)
			if (line.length === 0) {
				// line is somehow empty, try skipping a character
				lastDrawnCharCount += 1
				continue
			}

			//lets look for a newline
			const newlinePos = line.indexOf(String.fromCharCode(10))
			if (newlinePos >= 0) {
				lines.push({ text: line.slice(0, newlinePos).join(''), ascent, descent })
				lastDrawnCharCount += newlinePos + 1
				continue
			}

			// lets look for a good break point
			breakPos = line.length - 1 // breakPos is the 0-indexed position of the char where a break can be done
			for (let i = line.length - 1; i > 0; i -= 1) {
				if (
					line[i] === ' ' || // space
					line[i] === '-' || // -
					line[i] === '_' || // _
					line[i] === ':' || // :
					line[i] === '~' // ~
				) {
					breakPos = i
					break
				}
			}

			// get rid of a breaking space at end
			const lineText = line.slice(0, breakPos + (line[breakPos] === ' ' ? 0 : 1))
			lines.push({ text: lineText.join(''), ascent, descent })

			lastDrawnCharCount += breakPos + 1
		}
	}
	//console.log('we got the break', text, lines.map(line => byteToString(line.text)))

	// Check if text fits: all text was consumed AND it fits vertically
	const allTextConsumed = lastDrawnCharCount >= displayTextChars.length
	const fitsVertically = lines.length >= 1 && lines.length * measuredLineHeight <= h
	const fits = allTextConsumed && fitsVertically

	// If the text is too tall, we need to drop the last line
	if (lines.length * measuredLineHeight > h) {
		lines.splice(lines.length - 1, 1)
	}

	return {
		fontDefinition,
		lines,
		measuredLineHeight,
		measuredAscent,
		fits,
	}
}
