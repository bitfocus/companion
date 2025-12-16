import React, { useCallback } from 'react'
import { calculateXyPercent } from '../helpers/change.js'
import { useColor } from '../context/useColor.js'
import { Checkboard } from './Checkboard.js'
import { ClickAndDragDiv } from './ClickAndDragDiv.js'
import cssStyles from './Alpha.module.css'

export function Alpha(): React.JSX.Element {
	const { changeRgbColor } = useColor()

	const handleChange = useCallback(
		(e: React.MouseEvent | React.TouchEvent | MouseEvent, container: HTMLDivElement) => {
			const { x } = calculateXyPercent(e, container)
			changeRgbColor({ a: Math.round(x * 100) / 100 }, e)
		},
		[changeRgbColor]
	)

	return (
		<div className={cssStyles.alphaRoot}>
			<div className={cssStyles.alphaCheckboard}>
				<Checkboard />
			</div>
			<div className={cssStyles.alphaGradient} />
			<ClickAndDragDiv className={cssStyles.alphaContainer} onChange={handleChange} dragXy>
				<div className={cssStyles.alphaPointer}>
					<div className={cssStyles.alphaSliderHandle} />
				</div>
			</ClickAndDragDiv>
		</div>
	)
}
