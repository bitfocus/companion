import type { ConnectionStatusEntry } from '@companion-app/shared/Model/Common.js'
import { CSpinner } from '@coreui/react'
import { faCheckCircle, faTriangleExclamation, faPowerOff } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React from 'react'
import { InlineHelp } from '../../Components/InlineHelp.js'
import { observer } from 'mobx-react-lite'

interface ConnectionStatusCellProps {
	isEnabled: boolean
	status: ConnectionStatusEntry | undefined
}
export const ConnectionStatusCell = observer(function ConnectionStatusCell({
	isEnabled,
	status,
}: ConnectionStatusCellProps) {
	if (isEnabled) {
		const messageStr =
			!!status &&
			(typeof status.message === 'string' || typeof status.message === 'number' || !status.message
				? status.message || ''
				: JSON.stringify(status.message))

		switch (status?.category) {
			case 'good':
				return <FontAwesomeIcon icon={faCheckCircle} color={'#33aa33'} size="2xl" />
			case 'warning':
				return (
					<InlineHelp help={`${status.level ?? 'Warning'}${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#fab92c'} size="2xl" />
					</InlineHelp>
				)
			case 'error':
				switch (status.level) {
					case 'system':
						return (
							<InlineHelp help={messageStr || 'Unknown error'}>
								<FontAwesomeIcon icon={faTriangleExclamation} color={'#d50215'} size="2xl" />
							</InlineHelp>
						)
					case 'Connecting':
						return (
							<InlineHelp help={`${status.level ?? 'Error'}${messageStr ? ': ' + messageStr : ''}`}>
								<CSpinner color="warning"></CSpinner>
							</InlineHelp>
						)
					default:
						return (
							<InlineHelp help={`${status.level ?? 'Error'}${messageStr ? ': ' + messageStr : ''}`}>
								<FontAwesomeIcon icon={faTriangleExclamation} color={'#d50215'} size="2xl" />
							</InlineHelp>
						)
				}

			default:
				return (
					<InlineHelp help={`Unknown${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#fab92c'} size="2xl" />
					</InlineHelp>
				)
		}
	} else {
		return <FontAwesomeIcon icon={faPowerOff} color={'gray'} size="2xl" />
	}
})
