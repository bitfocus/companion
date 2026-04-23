import { observer } from 'mobx-react-lite'
import { useCallback } from 'react'
import { useColor } from '../context/useColor.js'
import { calculateXyPercent } from '../helpers/change.js'
import { ClickAndDragDiv } from './ClickAndDragDiv.js'
import cssStyles from './Saturation.module.css'

export const Saturation = observer(function Saturation(): React.JSX.Element {
	const { changeHsvColor } = useColor()

	const handleChange = useCallback(
		(event: React.MouseEvent | React.TouchEvent | MouseEvent, container: HTMLDivElement) => {
			const { x, y } = calculateXyPercent(event, container)
			changeHsvColor({ s: x * 100, v: (1 - y) * 100 }, event)
		},
		[changeHsvColor]
	)

	return (
		<ClickAndDragDiv className={cssStyles.saturationRoot} onChange={handleChange}>
			<div className={cssStyles.saturationWhiteOverlay}>
				<div className={cssStyles.saturationBlackOverlay} />
				<div className={cssStyles.saturationPointer}>
					<div className={cssStyles.saturationPointerCircle} />
				</div>
			</div>
		</ClickAndDragDiv>
	)
})
