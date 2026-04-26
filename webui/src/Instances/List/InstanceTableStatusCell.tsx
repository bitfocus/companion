import { CSpinner } from '@coreui/react'
import { faCheckCircle, faPowerOff, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import type { InstanceStatusEntry } from '@companion-app/shared/Model/InstanceStatus.js'
import { InlineHelpCustom } from '~/Components/InlineHelp.js'

interface InstanceTableStatusCellProps {
	isEnabled: boolean
	status: InstanceStatusEntry | undefined
}
export const InstanceTableStatusCell = observer(function InstanceTableStatusCell({
	isEnabled,
	status,
}: InstanceTableStatusCellProps) {
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
					<InlineHelpCustom help={`${status.level ?? 'Warning'}${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#fab92c'} size="2xl" />
					</InlineHelpCustom>
				)
			case 'error':
				switch (status.level) {
					case 'system':
						return (
							<InlineHelpCustom help={messageStr || 'Unknown error'}>
								<FontAwesomeIcon icon={faTriangleExclamation} color={'#d50215'} size="2xl" />
							</InlineHelpCustom>
						)
					case 'Connecting':
						return (
							<InlineHelpCustom help={`${status.level ?? 'Error'}${messageStr ? ': ' + messageStr : ''}`}>
								<div style={{ padding: '0 3.5px' }}>
									<CSpinner color="warning" style={{ width: '29px', height: '29px' }} />
								</div>
							</InlineHelpCustom>
						)
					default:
						return (
							<InlineHelpCustom help={`${status.level ?? 'Error'}${messageStr ? ': ' + messageStr : ''}`}>
								<FontAwesomeIcon icon={faTriangleExclamation} color={'#d50215'} size="2xl" />
							</InlineHelpCustom>
						)
				}

			default:
				return (
					<InlineHelpCustom help={`Unknown${messageStr ? ': ' + messageStr : ''}`}>
						<FontAwesomeIcon icon={faTriangleExclamation} color={'#fab92c'} size="2xl" />
					</InlineHelpCustom>
				)
		}
	} else {
		return <FontAwesomeIcon icon={faPowerOff} color={'gray'} size="2xl" />
	}
})
