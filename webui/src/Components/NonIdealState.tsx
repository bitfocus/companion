import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'

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
			<div className={className} style={{ padding: '5vh', color: '#000', textAlign: 'center', ...style }}>
				<div style={{ opacity: 0.6 }}>
					<FontAwesomeIcon icon={icon} size="3x" />
				</div>
				<div style={{ padding: 10, fontWeight: 400 }}>
					{text && text}
					{children && children}
				</div>
			</div>
		</>
	)
}
