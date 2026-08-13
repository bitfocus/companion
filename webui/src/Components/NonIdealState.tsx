import type { IconProp } from '@fortawesome/fontawesome-svg-core'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import './NonIdealState.css'

export const NonIdealState = ({
	text,
	icon = faTrash,
	children = <></>,
	style = {},
	className = '',
}: {
	text?: string
	icon: IconProp
	children?: React.ReactNode
	style?: React.CSSProperties
	className?: string
}): React.JSX.Element => {
	return (
		<>
			<div className={`non-ideal-state ${className}`} style={style}>
				<div className="non-ideal-state-icon">
					<FontAwesomeIcon icon={icon} size="3x" className="non-ideal-svg" />
				</div>
				<div className="non-ideal-state-text">
					{text && text}
					{children && children}
				</div>
			</div>
		</>
	)
}
