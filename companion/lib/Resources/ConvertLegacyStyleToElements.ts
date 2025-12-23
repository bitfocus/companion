import { ParseAlignment } from '@companion-app/shared/Graphics/Util.js'
import type { LayeredButtonModel } from '@companion-app/shared/Model/ButtonModel.js'
import {
	EntityModelType,
	type FeedbackEntityStyleOverride,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	type ButtonGraphicsBoxElement,
	type ButtonGraphicsCanvasElement,
	type ButtonGraphicsImageElement,
	type ButtonGraphicsTextElement,
	type SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ExpressionOrValue } from '@companion-app/shared/Model/Expression.js'
import {
	ButtonGraphicsDecorationType,
	ButtonGraphicsElementUsage,
	type ButtonStyleProperties,
	type DrawImageBuffer,
	type HorizontalAlignment,
	type VerticalAlignment,
} from '@companion-app/shared/Model/StyleModel.js'
import { nanoid } from 'nanoid'

interface ParsedLegacyStyle {
	text: {
		text: ExpressionOrValue<string> | undefined
		size: 'auto' | number | undefined
		color: number | undefined
		halign: HorizontalAlignment | undefined
		valign: VerticalAlignment | undefined
	}
	image: {
		halign: HorizontalAlignment | undefined
		valign: VerticalAlignment | undefined
		image: string | undefined
	}
	imageBuffers: DrawImageBuffer[] | undefined
	background: {
		color: number | undefined
	}
	canvas: {
		decoration: ButtonGraphicsDecorationType | undefined
	}
}

// const TEXT_SIZE_SCALE = 1 / 0.6 // TODO - when no topbar
const TEXT_SIZE_SCALE = 2.1 // When with topbar

export function ParseLegacyStyle(style: Partial<ButtonStyleProperties>): ParsedLegacyStyle {
	let textSize: 'auto' | number | undefined = undefined
	if (style.size !== undefined) {
		if (style.size === 'auto') textSize = 'auto'
		else {
			const n = Number(style.size)
			// Ensure is a number, and round to 1dp
			if (!isNaN(n)) textSize = Number((n * TEXT_SIZE_SCALE).toFixed(1))
		}
	}

	const textAlign = style.alignment !== undefined ? ParseAlignment(style.alignment, false) : undefined
	const imageAlign = style.pngalignment !== undefined ? ParseAlignment(style.pngalignment, false) : undefined

	const styleHack = style as any

	return {
		text: {
			text: style.text !== undefined ? { isExpression: !!style.textExpression, value: style.text } : undefined,
			size: textSize,
			color: style.color,
			halign: textAlign ? textAlign[0] : undefined,
			valign: textAlign ? textAlign[1] : undefined,
		},
		image: {
			halign: imageAlign ? imageAlign[0] : undefined,
			valign: imageAlign ? imageAlign[1] : undefined,
			image: style.png64 ? ensurePng64IsDataUrl(style.png64) : undefined,
		},
		imageBuffers: styleHack.imageBuffer
			? [
					{
						...styleHack.imageBufferPosition,
						...styleHack.imageBufferEncoding,
						buffer: styleHack.imageBuffer,
					} as DrawImageBuffer,
				]
			: undefined,
		background: {
			color: style.bgcolor,
		},
		canvas: {
			decoration: style.show_topbar !== undefined ? convertLegacyShowTopBarToDecoration(style.show_topbar) : undefined,
		},
	}
}

export function GetLegacyStyleProperty(
	parsedStyle: ParsedLegacyStyle,
	rawStyle: Partial<ButtonStyleProperties>,
	property: string,
	elementProperty: string
): ExpressionOrValue<any> | undefined {
	switch (property) {
		case 'text':
			if (parsedStyle.text.text !== undefined) return parsedStyle.text.text
			break
		case 'size':
			if (parsedStyle.text.size !== undefined)
				return {
					isExpression: false,
					value: parsedStyle.text.size,
				}
			break
		case 'alignment':
			// This is a little brittle, but is hopefully good enough
			if (elementProperty === 'valign' && parsedStyle.text.valign !== undefined) {
				return {
					isExpression: false,
					value: parsedStyle.text.valign,
				}
			} else if (elementProperty === 'halign' && parsedStyle.text.halign !== undefined) {
				return {
					isExpression: false,
					value: parsedStyle.text.halign,
				}
			} else if (rawStyle.alignment) {
				return {
					isExpression: false,
					value: rawStyle.alignment,
				}
			}
			break
		case 'pngalignment':
			// This is a little brittle, but is hopefully good enough
			if (elementProperty === 'valign' && parsedStyle.image.valign !== undefined) {
				return {
					isExpression: false,
					value: parsedStyle.image.valign,
				}
			} else if (elementProperty === 'halign' && parsedStyle.image.halign !== undefined) {
				return {
					isExpression: false,
					value: parsedStyle.image.halign,
				}
			} else if (rawStyle.pngalignment) {
				return {
					isExpression: false,
					value: rawStyle.pngalignment,
				}
			}
			break
		case 'color':
			if (parsedStyle.text.color !== undefined)
				return {
					isExpression: false,
					value: parsedStyle.text.color,
				}
			break
		case 'bgcolor':
			if (parsedStyle.background.color !== undefined)
				return {
					isExpression: false,
					value: parsedStyle.background.color,
				}
			break
		case 'png64':
			if (parsedStyle.image.image) {
				return {
					isExpression: false,
					value: parsedStyle.image.image,
				}
			}
			break
		case 'imageBuffers':
			if (parsedStyle.imageBuffers && parsedStyle.imageBuffers.length > 0) {
				return {
					isExpression: false,
					value: parsedStyle.imageBuffers,
				}
			}
			break
		default:
			// Anything else is not supported
			break
	}

	return undefined
}

export function ConvertLegacyStyleToElements(
	style: ButtonStyleProperties,
	feedbacks: SomeEntityModel[]
): Pick<LayeredButtonModel, 'style' | 'feedbacks'> {
	const canvasElement: ButtonGraphicsCanvasElement = {
		id: 'canvas',
		name: 'Canvas',
		usage: ButtonGraphicsElementUsage.Automatic,
		type: 'canvas',
		decoration: { value: ButtonGraphicsDecorationType.FollowDefault, isExpression: false },
	}
	const backgroundElement: ButtonGraphicsBoxElement = {
		id: 'box0',
		name: 'Background',
		usage: ButtonGraphicsElementUsage.Automatic,
		type: 'box',
		enabled: { value: true, isExpression: false },
		opacity: { value: 100, isExpression: false },
		x: { value: 0, isExpression: false },
		y: { value: 0, isExpression: false },
		width: { value: 100, isExpression: false },
		height: { value: 100, isExpression: false },
		color: { value: 0x000000, isExpression: false },
		borderWidth: { value: 0, isExpression: false },
		borderColor: { value: 0, isExpression: false },
		borderPosition: { value: 'inside', isExpression: false },
	}
	const imageElement: ButtonGraphicsImageElement = {
		id: 'image0',
		name: 'Image',
		usage: ButtonGraphicsElementUsage.Automatic,
		type: 'image',
		enabled: { value: true, isExpression: false },
		opacity: { value: 100, isExpression: false },
		x: { value: 0, isExpression: false },
		y: { value: 0, isExpression: false },
		width: { value: 100, isExpression: false },
		height: { value: 100, isExpression: false },
		base64Image: { value: null, isExpression: false },
		halign: { value: 'center', isExpression: false },
		valign: { value: 'center', isExpression: false },
		fillMode: { value: 'fit_or_shrink', isExpression: false },
	}
	const textElement: ButtonGraphicsTextElement = {
		id: 'text0',
		name: 'Text',
		usage: ButtonGraphicsElementUsage.Automatic,
		type: 'text',
		enabled: { value: true, isExpression: false },
		opacity: { value: 100, isExpression: false },
		x: { value: 0, isExpression: false },
		y: { value: 0, isExpression: false },
		width: { value: 100, isExpression: false },
		height: { value: 100, isExpression: false },
		text: { value: '', isExpression: false },
		color: { value: 0xffffff, isExpression: false },
		halign: { value: 'center', isExpression: false },
		valign: { value: 'center', isExpression: false },
		fontsize: { value: 'auto', isExpression: false },
		outlineColor: { value: 0xff000000, isExpression: false },
	}
	const bufferElement: ButtonGraphicsImageElement = {
		id: 'imageBuffers',
		name: 'Image Buffers',
		usage: ButtonGraphicsElementUsage.Automatic,
		type: 'image',
		enabled: { value: true, isExpression: false },
		opacity: { value: 100, isExpression: false },
		x: { value: 0, isExpression: false },
		y: { value: 0, isExpression: false },
		width: { value: 100, isExpression: false },
		height: { value: 100, isExpression: false },
		base64Image: { value: null, isExpression: false },
		halign: { value: 'center', isExpression: false },
		valign: { value: 'center', isExpression: false },
		fillMode: { value: 'fit_or_shrink', isExpression: false },
	}

	// Apply the old style properties to the new elements
	const parsedStyle = ParseLegacyStyle(style)

	if (parsedStyle.text.text !== undefined) textElement.text = parsedStyle.text.text
	if (parsedStyle.text.size !== undefined) textElement.fontsize.value = String(parsedStyle.text.size)
	if (parsedStyle.text.halign !== undefined) textElement.halign.value = parsedStyle.text.halign
	if (parsedStyle.text.valign !== undefined) textElement.valign.value = parsedStyle.text.valign
	if (parsedStyle.text.color !== undefined) textElement.color.value = parsedStyle.text.color

	if (parsedStyle.image.halign !== undefined) imageElement.halign.value = parsedStyle.image.halign
	if (parsedStyle.image.valign !== undefined) imageElement.valign.value = parsedStyle.image.valign
	if (parsedStyle.image.image !== undefined) imageElement.base64Image.value = parsedStyle.image.image

	if (parsedStyle.background.color !== undefined) backgroundElement.color.value = parsedStyle.background.color
	if (parsedStyle.canvas.decoration !== undefined) canvasElement.decoration.value = parsedStyle.canvas.decoration

	let hasAnyAdvancedFeedbacks = false

	const updatedFeedbacks = feedbacks.map((fb) => {
		if (fb.type !== EntityModelType.Feedback) return fb // Not a feedback
		if (fb.styleOverrides) return fb // Already converted

		const overrides: FeedbackEntityStyleOverride[] = []

		if ('style' in fb && fb.style) {
			// Must be boolean, translate the props as such

			const parsedStyle = ParseLegacyStyle(fb.style)

			if (parsedStyle.text.text !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'text',
					override: parsedStyle.text.text,
				})
			}
			if (parsedStyle.text.size !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'fontsize',
					override: {
						isExpression: false,
						value: parsedStyle.text.size,
					},
				})
			}

			if (parsedStyle.text.halign !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'halign',
					override: { isExpression: false, value: parsedStyle.text.halign },
				})
			}
			if (parsedStyle.text.valign !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'valign',
					override: { isExpression: false, value: parsedStyle.text.valign },
				})
			}
			if (parsedStyle.image.halign !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: imageElement.id,
					elementProperty: 'halign',
					override: { isExpression: false, value: parsedStyle.image.halign },
				})
			}
			if (parsedStyle.image.valign !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: imageElement.id,
					elementProperty: 'valign',
					override: { isExpression: false, value: parsedStyle.image.valign },
				})
			}

			if (parsedStyle.text.color !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'color',
					override: { isExpression: false, value: parsedStyle.text.color },
				})
			}
			if (parsedStyle.background.color !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: backgroundElement.id,
					elementProperty: 'color',
					override: { isExpression: false, value: parsedStyle.background.color },
				})
			}

			if (parsedStyle.canvas.decoration !== undefined) {
				overrides.push({
					overrideId: nanoid(),
					elementId: canvasElement.id,
					elementProperty: 'decoration',
					override: { isExpression: false, value: parsedStyle.canvas.decoration },
				})
			}

			if (parsedStyle.image.image) {
				overrides.push({
					overrideId: nanoid(),
					elementId: imageElement.id,
					elementProperty: 'base64Image',
					override: {
						isExpression: false,
						value: parsedStyle.image.image,
					},
				})
			}
		} else {
			hasAnyAdvancedFeedbacks = true

			// Should be advanced, translate all properties
			overrides.push(
				{
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'text',
					override: { isExpression: false, value: 'text' },
				},
				{
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'fontsize',
					override: { isExpression: false, value: 'size' },
				},
				{
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'halign',
					override: { isExpression: false, value: 'alignment' },
				},
				{
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'valign',
					override: { isExpression: false, value: 'alignment' },
				},
				{
					overrideId: nanoid(),
					elementId: imageElement.id,
					elementProperty: 'halign',
					override: { isExpression: false, value: 'pngalignment' },
				},
				{
					overrideId: nanoid(),
					elementId: imageElement.id,
					elementProperty: 'valign',
					override: { isExpression: false, value: 'pngalignment' },
				},
				{
					overrideId: nanoid(),
					elementId: textElement.id,
					elementProperty: 'color',
					override: { isExpression: false, value: 'color' },
				},
				{
					overrideId: nanoid(),
					elementId: backgroundElement.id,
					elementProperty: 'color',
					override: { isExpression: false, value: 'bgcolor' },
				},
				{
					overrideId: nanoid(),
					elementId: imageElement.id,
					elementProperty: 'base64Image',
					override: { isExpression: false, value: 'png64' },
				},
				{
					overrideId: nanoid(),
					elementId: bufferElement.id,
					elementProperty: 'base64Image',
					override: { isExpression: false, value: 'imageBuffers' },
				}
			)
		}

		return {
			...fb,
			style: undefined,
			styleOverrides: overrides,
		}
	})

	const layers: SomeButtonGraphicsElement[] = [canvasElement, backgroundElement, imageElement, textElement]
	if (hasAnyAdvancedFeedbacks) layers.push(bufferElement)

	return {
		style: {
			layers,
		},
		feedbacks: updatedFeedbacks,
	}
}

function ensurePng64IsDataUrl(png64: string): string {
	if (png64.startsWith('data:')) {
		return png64
	} else {
		return `data:image/png;base64,${png64}`
	}
}

function convertLegacyShowTopBarToDecoration(show_topbar: boolean | 'default'): ButtonGraphicsDecorationType {
	if (show_topbar === 'default') {
		return ButtonGraphicsDecorationType.FollowDefault
	} else if (show_topbar === true) {
		return ButtonGraphicsDecorationType.TopBar
	} else if (show_topbar === false) {
		return ButtonGraphicsDecorationType.Border
	}
	return ButtonGraphicsDecorationType.FollowDefault
}
