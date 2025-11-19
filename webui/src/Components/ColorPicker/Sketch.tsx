// Based on https://www.npmjs.com/package/react-color & https://github.com/hello-pangea/color-picker
// MIT Copyright (c) 2022 Reece Carolan Copyright (c) 2015 Case Sandberg

import React from 'react'
import { useColor, ColorProvider, type ColorProviderProps } from './context/useColor'
import { SketchFields } from './components/SketchFields'
import { SketchPresetColors } from './components/SketchPresetColors.js'
import { Saturation } from './components/Saturation'
import { Checkboard } from './components/Checkboard'
import { Alpha } from './components/Alpha'
import { Hue } from './components/Hue'
import type { CompanionColorPresetValue } from '@companion-module/base'
import cssStyles from './Sketch.module.css'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'

export interface SketchPickerProps {
	disableAlpha?: boolean
	width?: string | number
	presetColors?: CompanionColorPresetValue[]
}

const Sketch = observer(function Sketch({
	width = 200,
	disableAlpha = false,
	presetColors = [
		'#D0021B',
		'#F5A623',
		'#F8E71C',
		'#8B572A',
		'#7ED321',
		'#417505',
		'#BD10E0',
		'#9013FE',
		'#4A90E2',
		'#50E3C2',
		'#B8E986',
		'#000000',
		'#4A4A4A',
		'#9B9B9B',
		'#FFFFFF',
	],
}: SketchPickerProps): React.JSX.Element {
	const { colors, changeHexColor } = useColor()

	return (
		<SketchRoot width={width}>
			<div className={cssStyles.sketchSaturation}>
				<Saturation />
			</div>
			<div className={classNames(cssStyles.sketchControls, 'flexbox-fix')}>
				<div className={cssStyles.sketchSliders}>
					<div className={cssStyles.sketchHue}>
						<Hue />
					</div>
					{!disableAlpha && (
						<div className={cssStyles.sketchAlpha}>
							<Alpha />
						</div>
					)}
				</div>
				<div className={classNames(cssStyles.sketchColor, !disableAlpha ? cssStyles.sketchColorWithAlpha : '')}>
					<Checkboard />
					<div className={cssStyles.sketchActiveColor} />
				</div>
			</div>

			<SketchFields disableAlpha={disableAlpha} />
			<SketchPresetColors colors={presetColors} currentColorHex={colors.hex.toUpperCase()} onClick={changeHexColor} />
		</SketchRoot>
	)
})

const SketchRoot = observer(function SketchRoot({
	width,
	children,
}: React.PropsWithChildren<{ width: string | number }>): React.JSX.Element {
	const { colors } = useColor()

	return (
		<div
			className={cssStyles.sketchPicker}
			style={{
				width,

				// @ts-expect-error css variables
				'--color-rgb-r': colors.rgb.r,
				'--color-rgb-g': colors.rgb.g,
				'--color-rgb-b': colors.rgb.b,
				'--color-rgb-a': colors.rgb.a ?? 1,

				'--color-hsv-h': colors.hsv.h,
				'--color-hsv-v': colors.hsv.v,
				'--color-hsv-s': colors.hsv.s,
			}}
		>
			{children}
		</div>
	)
})

export function SketchPicker(props: SketchPickerProps & ColorProviderProps): React.JSX.Element {
	return (
		<ColorProvider {...props}>
			<Sketch {...props} />
		</ColorProvider>
	)
}
