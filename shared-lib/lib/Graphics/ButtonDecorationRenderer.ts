import { formatLocation } from '../ControlId.js'
import type { RendererButtonStyle } from '../Model/Render.js'
import { ButtonGraphicsDecorationType, type DrawStyleButtonStateProps } from '../Model/StyleModel.js'
import type { ImageBase } from './ImageBase.js'
import type { DrawBounds } from './Util.js'

const colorButtonYellow = 'rgb(255, 198, 0)'
const colorEmptyGrey = 'rgb(50, 50, 50)'
const colorBlack = 'black'

export class ButtonDecorationRenderer {
	static readonly DEFAULT_HEIGHT = 14

	static drawStatusBar(
		img: ImageBase<any>,
		drawStyle: Omit<
			RendererButtonStyle,
			'style' | 'drawType' | 'decoration' | 'show_status_icons' | 'elements' | 'decodedImages'
		>,
		topBarBounds: DrawBounds,
		emptyButton: boolean
	): void {
		const drawColor = emptyButton ? colorEmptyGrey : colorButtonYellow

		let step = ''

		// The separator line is drawn in logical pixels. On small hardware buttons the high
		// oversampling factor makes a 1px line render as several physical pixels, but on large
		// previews (which use little/no oversampling) a 1px line renders as a single physical
		// pixel and visually disappears. Scale the width up with the bar height, but sub-linearly
		// (sqrt) and capped so it stays crisp on previews without becoming a heavy line on big bitmaps.
		const lineWidth = Math.min(
			4,
			Math.max(1, Math.round(Math.sqrt(topBarBounds.height / ButtonDecorationRenderer.DEFAULT_HEIGHT)))
		)
		// Sit the line flush against the bottom edge of the bar; for lineWidth 1 this reduces to the
		// original `maxY - 0.5` half-pixel placement.
		const lineY = topBarBounds.maxY - lineWidth / 2

		img.box(topBarBounds.x, topBarBounds.y, topBarBounds.maxX, lineY, colorBlack)
		img.line(topBarBounds.x, lineY, topBarBounds.maxX, lineY, {
			color: drawColor,
			width: lineWidth,
		})

		if (!emptyButton && drawStyle.stepCount > 1) {
			step = `.${drawStyle.stepCurrent}`
		}

		const locationDrawX = Math.round(topBarBounds.width * 0.05) + topBarBounds.x
		const locationDrawY = Math.round(topBarBounds.height * 0.15) + topBarBounds.y
		const locationDrawSize = Math.round(topBarBounds.height * 0.65)

		// Without a location (e.g. a preview render) show a placeholder instead of a real page/row/column.
		const label = drawStyle.location === undefined ? `x/x/x${step}` : `${formatLocation(drawStyle.location)}${step}`

		if (drawStyle.pushed) {
			// Pushed: invert the bar (solid fill, dark text).
			img.box(topBarBounds.x, topBarBounds.y, topBarBounds.maxX, topBarBounds.maxY, drawColor)
			img.drawTextLine(locationDrawX, locationDrawY, label, colorBlack, locationDrawSize)
		} else {
			img.drawTextLine(locationDrawX, locationDrawY, label, drawColor, locationDrawSize)
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

	static drawIcons(img: ImageBase<any>, drawStyle: RendererButtonStyle, topBarBounds: DrawBounds): void {
		// const iconHeight
		let rightMax = topBarBounds.x + topBarBounds.width

		// next error or warning icon
		const iconSize = Math.floor(topBarBounds.height * 0.65)
		const iconPadding = Math.floor(topBarBounds.height * 0.175)

		// first a cloud for a remote button, as it has a top bar to put it in
		if (drawStyle.link_status && drawStyle.decoration === ButtonGraphicsDecorationType.TopBar) {
			const cloudWidth = Math.round(iconSize * 1.5)
			ButtonDecorationRenderer.#drawCloud(
				img,
				rightMax - (cloudWidth + iconPadding),
				topBarBounds.y + iconPadding,
				cloudWidth,
				iconSize,
				drawStyle.link_status === 'unreachable' ? 'red' : 'rgb(200, 200, 200)'
			)
			rightMax -= cloudWidth + iconPadding
		}

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

	/** A cloud, filling a box: a large puff over two small ones, on a flat base */
	static #drawCloud(img: ImageBase<any>, x: number, y: number, width: number, height: number, color: string): void {
		const small = height * 0.32
		const baseY = y + height - small
		img.circle(x + small, baseY, small, small, 0, Math.PI * 2, false, color)
		img.circle(x + width - small, baseY, small, small, 0, Math.PI * 2, false, color)
		img.circle(x + width * 0.5, y + height * 0.42, height * 0.42, height * 0.42, 0, Math.PI * 2, false, color)
		img.drawFilledPath(
			[
				[x + small, baseY],
				[x + width - small, baseY],
				[x + width - small, y + height],
				[x + small, y + height],
			],
			color
		)
	}
}
