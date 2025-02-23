import { formatLocation } from '../ControlId.js'
import type { ControlLocation } from '../Model/Common.js'
import type { DrawStyleButtonStateProps } from '../Model/StyleModel.js'
import type { ImageBase } from './ImageBase.js'
import { DrawBounds } from './Util.js'

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

export class TopbarRenderer {
	static readonly DEFAULT_HEIGHT = 14

	/**
	 * Draw the topbar onto an image for a button
	 */
	static draw(
		img: ImageBase<any>,
		drawStyle: DrawStyleButtonStateProps,
		location: ControlLocation | undefined,
		drawBounds: DrawBounds | null
	) {
		const showTopBar = !!drawBounds && drawBounds.isValid()
		if (!showTopBar) {
			if (drawStyle.pushed) {
				img.drawBorder(3, colorButtonYellow)
			}
		} else {
			let step = ''
			img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY - 0.5, colorBlack)
			img.line(drawBounds.x, drawBounds.maxY - 0.5, drawBounds.maxX, drawBounds.maxY - 0.5, {
				color: colorButtonYellow,
			})

			if (typeof drawStyle.step_cycle === 'number' && location) {
				step = `.${drawStyle.step_cycle}`
			}

			const locationDrawX = Math.round(drawBounds.width * 0.05) + drawBounds.x
			const locationDrawY = Math.round(drawBounds.height * 0.15) + drawBounds.y
			const locationDrawSize = Math.round(drawBounds.height * 0.65)

			if (location === undefined) {
				// Preview (no location)
				img.drawTextLine(locationDrawX, locationDrawY, `x/x/x${step}`, colorButtonYellow, locationDrawSize)
			} else if (drawStyle.pushed) {
				img.box(drawBounds.x, drawBounds.y, drawBounds.maxX, drawBounds.maxY, colorButtonYellow)
				img.drawTextLine(
					locationDrawX,
					locationDrawY,
					`${formatLocation(location)}${step}`,
					colorBlack,
					locationDrawSize
				)
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

		// Draw status icons from right to left
		let rightMax = 72

		// first the cloud icon if present
		if (drawStyle.cloud_error && showTopBar) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloudError)
			rightMax -= 17
		} else if (drawStyle.cloud && showTopBar) {
			img.drawPixelBuffer(rightMax - 17, 3, 15, 8, internalIcons.cloud)
			rightMax -= 17
		}

		// next error or warning icon
		if (location) {
			switch (drawStyle.button_status) {
				case 'error':
					img.box(rightMax - 10, 3, rightMax - 2, 11, 'red')
					rightMax -= 10
					break
				case 'warning':
					img.drawFilledPath(
						[
							[rightMax - 10, 11],
							[rightMax - 2, 11],
							[rightMax - 6, 3],
						],
						'rgb(255, 127, 0)'
					)
					img.drawTextLineAligned(rightMax - 6, 11, '!', colorBlack, 7, 'center', 'bottom')
					rightMax -= 10
					break
			}

			// last running icon
			if (drawStyle.action_running) {
				//img.drawTextLine(55, 3, '►', 'rgb(0, 255, 0)', 8) // not as nice
				let iconcolor = 'rgb(0, 255, 0)'
				if (drawStyle.pushed) iconcolor = colorBlack
				img.drawFilledPath(
					[
						[rightMax - 8, 3],
						[rightMax - 2, 7],
						[rightMax - 8, 11],
					],
					iconcolor
				)
				rightMax -= 8
			}
		}
	}
}
