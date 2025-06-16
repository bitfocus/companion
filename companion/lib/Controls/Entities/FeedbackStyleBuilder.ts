import type { ButtonStyleProperties, UnparsedButtonStyle } from '@companion-app/shared/Model/StyleModel.js'

/**
 * A simple class to help combine multiple styles into one that can be drawn
 */
export class FeedbackStyleBuilder {
	#combinedStyle: UnparsedButtonStyle

	get style(): UnparsedButtonStyle {
		return this.#combinedStyle
	}

	constructor(baseStyle: Partial<ButtonStyleProperties>) {
		this.#combinedStyle = {
			...baseStyle,
			imageBuffers: [],
		}
	}

	/**
	 * Apply a simple layer of style
	 */
	applySimpleStyle(style: Partial<ButtonStyleProperties> | undefined) {
		this.#combinedStyle = {
			...this.#combinedStyle,
			...style,
		}
	}

	applyComplexStyle(rawValue: any) {
		if (typeof rawValue === 'object' && rawValue !== undefined) {
			// Prune off some special properties
			const prunedValue = { ...rawValue }
			delete prunedValue.imageBuffer
			delete prunedValue.imageBufferPosition
			delete prunedValue.imageBuffers

			// Ensure `textExpression` is set at the same times as `text`
			delete prunedValue.textExpression
			if ('text' in prunedValue) {
				prunedValue.textExpression = rawValue.textExpression || false
			}

			this.#combinedStyle = {
				...this.#combinedStyle,
				...prunedValue,
			}

			// Push the imageBuffer into an array
			if (rawValue.imageBuffer) {
				this.#combinedStyle.imageBuffers.push({
					...rawValue.imageBufferPosition,
					...rawValue.imageBufferEncoding,
					buffer: rawValue.imageBuffer,
				})
			}
		}
	}
}
