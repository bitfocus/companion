import React, { useCallback } from 'react'
import type { CompanionColorPresetValue } from '@companion-app/shared/Model/Options.js'
import cssStyles from './SketchPresetColors.module.css'
import classNames from 'classnames'
import { colord } from 'colord'
import type { OnChangeFn } from '../context/useColor.js'

interface SketchPresetColorsProps {
	colors: CompanionColorPresetValue[]
	currentColorHex: string
	onClick: OnChangeFn<string>
}

export function SketchPresetColors({
	colors,
	currentColorHex,
	onClick,
}: SketchPresetColorsProps): React.JSX.Element | null {
	if (!colors || !colors.length) return null

	return (
		<div className={classNames('flexbox-fix', cssStyles.swatchRoot)}>
			{colors.map((colorObjOrString, i) => {
				const c: CompanionColorPresetValue =
					typeof colorObjOrString === 'string' ? { color: colorObjOrString, title: '' } : colorObjOrString
				const key = `${i}-${c.color}${c.title || ''}`

				const isCurrent = currentColorHex === c.color

				return (
					<div key={key} className={cssStyles.swatchWrap}>
						<Swatch color={c.color} title={c.title} onClick={onClick}>
							{isCurrent && <>&#x2713;</>}
						</Swatch>
					</div>
				)
			})}
		</div>
	)
}

interface SwatchProps {
	color: string
	title: string
	onClick: (hex: string, e: React.MouseEvent | React.KeyboardEvent) => void
}

function Swatch({ color, onClick, title, children }: React.PropsWithChildren<SwatchProps>): React.JSX.Element {
	// const transparent = color === 'transparent'

	const parsedColor = colord(color)

	let textColor = '#000000'
	if (parsedColor.isValid()) {
		const { r, g, b } = parsedColor.toRgb()
		textColor = r * 0.299 + g * 0.587 + b * 0.114 > 186 ? '#000000' : '#ffffff'
	}

	const handleClick = useCallback((e: React.MouseEvent) => onClick(color, e), [color, onClick])
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => e.key === 'Enter' && onClick(color, e),
		[color, onClick]
	)

	return (
		<div
			className={cssStyles.swatchTile}
			style={{
				background: color,
				color: textColor,
			}}
			onClick={handleClick}
			title={title || undefined}
			tabIndex={0}
			onKeyDown={handleKeyDown}
		>
			{children}
			{/* {transparent && <Checkboard borderRadius={'3px'} boxShadow="inset 0 0 0 1px rgba(0,0,0,0.1)" />} */}
		</div>
	)
}
