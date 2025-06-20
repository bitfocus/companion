import type { UnparsedButtonStyle } from '../Model/StyleModel.js'
import { ButtonGraphicsDecorationType, type SomeButtonGraphicsDrawElement } from '../Model/StyleLayersModel.js'
import { GraphicsLayeredElementUsageMatcher } from './LayeredElementUsageMatcher.js'
import { ParseAlignment } from './Util.js'

export function overlayAdvancedFeedbackValues(
	elements: SomeButtonGraphicsDrawElement[],
	feedbackStyle: UnparsedButtonStyle
): void {
	const selectedElements = GraphicsLayeredElementUsageMatcher.SelectBasicLayers(elements)

	if (selectedElements.canvas) {
		if (feedbackStyle.show_topbar === true) {
			selectedElements.canvas.decoration = ButtonGraphicsDecorationType.TopBar
		} else if (feedbackStyle.show_topbar === false) {
			selectedElements.canvas.decoration = ButtonGraphicsDecorationType.Border
		} else if (feedbackStyle.show_topbar === 'default') {
			selectedElements.canvas.decoration = ButtonGraphicsDecorationType.FollowDefault
		}
	}
	if (selectedElements.text) {
		if (feedbackStyle.text !== undefined) {
			selectedElements.text.text = feedbackStyle.text
		}
		if (feedbackStyle.color !== undefined) {
			selectedElements.text.color = feedbackStyle.color
		}
		if (feedbackStyle.size !== undefined) {
			selectedElements.text.fontsize = Number(feedbackStyle.size) || 'auto'
		}
		if (feedbackStyle.alignment !== undefined) {
			const alignment = ParseAlignment(feedbackStyle.alignment)
			selectedElements.text.halign = alignment[0]
			selectedElements.text.valign = alignment[1]
		}
	}
	if (selectedElements.box) {
		if (feedbackStyle.bgcolor !== undefined) {
			selectedElements.box.color = feedbackStyle.bgcolor
		}
	}

	if (selectedElements.image) {
		if (feedbackStyle.png64 !== undefined) {
			selectedElements.image.base64Image = feedbackStyle.png64 ?? null
		}
		if (feedbackStyle.pngalignment !== undefined) {
			const alignment = ParseAlignment(feedbackStyle.pngalignment)
			selectedElements.image.halign = alignment[0]
			selectedElements.image.valign = alignment[1]
		}
	}

	// TODO-layered - handle imageBuffers?
	// imageBuffers: DrawImageBuffer[]
}
