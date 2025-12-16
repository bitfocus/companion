import { formatLocation } from '../ControlId.js'
import type { ControlLocation } from '../Model/Common.js'
import type { DrawStyleButtonStateProps } from '../Model/StyleModel.js'
import type { ImageBase } from './ImageBase.js'
import type { DrawBounds } from './Util.js'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorBlack = 'black'

const internalIcons = {
	// 15x8 argb
	cloud:
		'AAAAAAAAAAAAAAAAAAAAAAAAAAAD////D////4L////7//////////D+/v51+/v7A////wAAAAAAAAAAAAAAAAAAA' +
		'AAAAAAAAAAAAAAAAABN////kf///////////v7+//z8/P/5+fn/9vb2RfDw8AAAAAAAAAAAAAAAAAAAAAB7///////////////0/////' +
		'P7+/v/9/f3/+vr6//b29v/y8vL/7e3tf+np6QAAAAAAAAAAAv///xz///+k/////////////////f39//r6+v/39/f/8/Pz/+7u7v/p6' +
		'en/5OTkquDg4DDV1dUC////N////6v////s/v7+//39/f/7+/v/+Pj4//T09P/v7+//6urq/+Xl5f/g4OD/3Nzc8dfX18DS0tJKz8/Pt' +
		'P/////+/v7/+/v7//n5+f/09PT/8PDw/+vr6//m5ub/4eHh/9zc3P/Y2Nj/1NTU/9HR0f/Ozs7HzMzM2Pv7+//5+fn/9fX1//Hx8f/s7' +
		'Oz/5+fn/+Li4v/d3d3/2dnZ/9TU1P/R0dH/z8/P/83Nzf/MzMzGy8vLVvb29u7y8vL/7e3t/+jo6P/j4+P/3t7e/9nZ2f/V1dX/0dHR/' +
		'87Ozv/Nzc3/zMzM/8zMzOHMzMwwysrK',
	// 15x8 argb
	cloudError:
		'AAAAAAAAAAAAAAAAAAAAABj/AACj/wIC7P8BAfX/Cwv+/0xM///m5vD+/v51+/v7A////wAAAAAAAAAAAAAAAAAAA' +
		'AAAAAAAGf8AAMz/AACk/z09kf///////////n5+//8ZGf/54eH/9vb2RfDw8AAAAAAAAAAAAAAAAAAAAAB7//////9bW///g4P0/////' +
		'P7+/v/90tL//i0t//4UFP/6XFz/7e3tf+np6QAAAAAAAAAAAv///xz///+k//////8XF////////f39//ygoP//CAj/+mVl/+/n5//9F' +
		'RX/5OTkquDg4DDV1dUC////N////6v////s/v7+//8XF//77+///FlZ//4QEP/0pKT/6urq/+Xl5f/8FBT/3Nzc8dfX18DS0tJKz8/Pt' +
		'P/////+/v7/+/v7//1OTv/+ERH//DY2/+3Q0P/m5ub/4eHh/+5qav/vWlr/1NTU/9HR0f/Ozs7HzMzM2Pv7+//5+fn/9fX1//PNzf/9G' +
		'Rn/83Z2/+Li4v/d3d3/7G9v//cqKv/Uw8P/z8/P/83Nzf/MzMzGy8vLVvb29u7y8vL/7e3t/+jo6P/mzc3/81NT//wREf/8ERH/8T4+/' +
		'9O7u//Nzc3/zMzM/8zMzOHMzMwwysrK',
}

export class ButtonDecorationRenderer {
	static readonly DEFAULT_HEIGHT = 14

	/**
	 * Draw the topbar onto an image for a button
	 */
	static drawLegacy(
		img: ImageBase<any>,
		drawStyle: DrawStyleButtonStateProps,
		location: ControlLocation | undefined,
		topBarBounds: DrawBounds,
		outerBounds: DrawBounds
	): void {
		const showTopBar = !!topBarBounds && topBarBounds.isValid()
		if (!showTopBar) {
			ButtonDecorationRenderer.drawBorderWhenPushed(img, drawStyle, outerBounds)
		} else {
			ButtonDecorationRenderer.drawStatusBar(img, drawStyle, location, topBarBounds)
		}

		// Draw status icons from right to left

		ButtonDecorationRenderer.drawIcons(img, drawStyle, location, topBarBounds, showTopBar)
	}

	static drawStatusBar(
		img: ImageBase<any>,
		drawStyle: DrawStyleButtonStateProps,
		location: ControlLocation | undefined,
		topBarBounds: DrawBounds
	): void {
		let step = ''
		img.box(topBarBounds.x, topBarBounds.y, topBarBounds.maxX, topBarBounds.maxY - 0.5, colorBlack)
		img.line(topBarBounds.x, topBarBounds.maxY - 0.5, topBarBounds.maxX, topBarBounds.maxY - 0.5, {
			color: colorButtonYellow,
			width: 1,
		})

		if (drawStyle.stepCount > 1 && location) {
			step = `.${drawStyle.stepCurrent}`
		}

		const locationDrawX = Math.round(topBarBounds.width * 0.05) + topBarBounds.x
		const locationDrawY = Math.round(topBarBounds.height * 0.15) + topBarBounds.y
		const locationDrawSize = Math.round(topBarBounds.height * 0.65)

		if (location === undefined) {
			// Preview (no location)
			img.drawTextLine(locationDrawX, locationDrawY, `x/x/x${step}`, colorButtonYellow, locationDrawSize)
		} else if (drawStyle.pushed) {
			img.box(topBarBounds.x, topBarBounds.y, topBarBounds.maxX, topBarBounds.maxY, colorButtonYellow)
			img.drawTextLine(locationDrawX, locationDrawY, `${formatLocation(location)}${step}`, colorBlack, locationDrawSize)
		} else {
			img.drawTextLine(
				locationDrawX,
				locationDrawY,
				`${formatLocation(location)}${step}`,
				colorButtonYellow,
				locationDrawSize
			)
		}
	}

	static drawBorderWhenPushed(
		img: ImageBase<any>,
		drawStyle: DrawStyleButtonStateProps,
		outerBounds: DrawBounds
	): void {
		if (drawStyle.pushed) {
			img.boxLine(
				outerBounds.x,
				outerBounds.y,
				outerBounds.maxX,
				outerBounds.maxY,
				{ color: colorButtonYellow, width: 3 },
				'inside'
			)
		}
	}

	static drawIcons(
		img: ImageBase<any>,
		drawStyle: DrawStyleButtonStateProps,
		location: ControlLocation | undefined,
		topBarBounds: DrawBounds,
		showCloudIcons: boolean
	): void {
		// const iconHeight
		let rightMax = topBarBounds.x + topBarBounds.width

		// first the cloud icon if present
		// TODO-layered fix this
		if (drawStyle.cloud_error && showCloudIcons) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloudError)
			rightMax -= 17
		} else if (drawStyle.cloud && showCloudIcons) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloud)
			rightMax -= 17
		}

		// next error or warning icon
		const iconSize = Math.floor(topBarBounds.height * 0.65)
		const iconPadding = Math.floor(topBarBounds.height * 0.175)
		if (location) {
			let statusColor: string | undefined
			switch (drawStyle.button_status) {
				case 'error':
					statusColor = 'red'
					break
				case 'warning':
					statusColor = 'rgb(255, 127, 0)'
					break
			}

			if (statusColor) {
				img.drawFilledPath(
					[
						[rightMax - 11, 11],
						[rightMax - 2, 11],
						[rightMax - 6.5, 2],
					],
					statusColor
				)
				img.drawTextLineAligned(rightMax - 6.5, 11, '!', colorBlack, 7, 'center', 'bottom', 'bold')
				rightMax -= 11
			}

			// last running icon
			if (drawStyle.action_running) {
				//img.drawTextLine(55, 3, '►', 'rgb(0, 255, 0)', 8) // not as nice
				let iconcolor = 'rgb(0, 255, 0)'
				if (drawStyle.pushed) iconcolor = colorBlack
				img.drawFilledPath(
					[
						[rightMax - iconSize, topBarBounds.y + iconPadding],
						[rightMax - iconPadding, topBarBounds.y + iconPadding + iconSize / 2],
						[rightMax - iconSize, topBarBounds.y + iconPadding + iconSize],
					],
					iconcolor
				)
				rightMax -= iconSize
			}
		}
	}
}
