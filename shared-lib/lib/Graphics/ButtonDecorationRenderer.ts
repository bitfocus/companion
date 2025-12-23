import { formatLocation } from '../ControlId.js'
import type { ControlLocation } from '../Model/Common.js'
import type { DrawStyleButtonStateProps } from '../Model/StyleModel.js'
import type { ImageBase } from './ImageBase.js'
import type { DrawBounds } from './Util.js'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorBlack = 'black'

export class ButtonDecorationRenderer {
	static readonly DEFAULT_HEIGHT = 14

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
		topBarBounds: DrawBounds
	): void {
		// const iconHeight
		let rightMax = topBarBounds.x + topBarBounds.width

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
						[rightMax - (iconSize + iconPadding), topBarBounds.y + iconSize + iconPadding],
						[rightMax - iconPadding, topBarBounds.y + iconSize + iconPadding],
						[rightMax - (iconSize / 2 + iconPadding), topBarBounds.y + iconPadding],
					],
					statusColor
				)
				img.drawTextLineAligned(
					rightMax - (iconSize / 2 + iconPadding),
					topBarBounds.y + iconSize + iconPadding,
					'!',
					colorBlack,
					Math.floor(iconSize * 0.7),
					'center',
					'bottom',
					'bold'
				)
				rightMax -= iconSize + iconPadding
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
