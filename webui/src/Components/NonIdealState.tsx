import { IconProp } from '@fortawesome/fontawesome-svg-core'
import { faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'

export const NonIdealState = ({
	text,
	icon = faTrash,
	children = <></>,
}: {
	text?: string
	icon: IconProp
	children?: React.ReactNode
}) => {
	return (
		<>
			<div style={{ padding: '5vh', color: '#000', textAlign: 'center' }}>
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
