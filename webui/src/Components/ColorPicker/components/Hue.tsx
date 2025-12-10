import React, { useCallback } from 'react'
import { calculateXyPercent } from '../helpers/change.js'
import { useColor } from '../context/useColor.js'
import { ClickAndDragDiv } from './ClickAndDragDiv.js'
import cssStyles from './Hue.module.css'

export function Hue(): React.JSX.Element {
	const { changeHsvColor } = useColor()

	const handleChange = useCallback(
		(e: React.MouseEvent | React.TouchEvent | MouseEvent, container: HTMLDivElement) => {
			const { x } = calculateXyPercent(e, container)

			changeHsvColor({ h: 360 * x }, e)
		},
		[changeHsvColor]
	)

	return (
		<div className={cssStyles.hueRoot}>
			<ClickAndDragDiv className={cssStyles.hueContainer} onChange={handleChange} dragXy>
				<div className={cssStyles.huePointer}>
					<div className={cssStyles.hueSliderHandle} />
				</div>
			</ClickAndDragDiv>
		</div>
	)
}
