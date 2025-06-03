import { formatLocation } from '@companion-app/shared/ControlId.js'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CButton } from '@coreui/react'
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useCallback } from 'react'
import { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

export function ControlClearButton({
	location,
	resetModalRef,
}: {
	location: ControlLocation
	resetModalRef: React.MutableRefObject<GenericConfirmModalRef | null>
}) {
	const { socket } = useContext(RootAppStoreContext)

	const clearButton = useCallback(() => {
		resetModalRef.current?.show(
			`Clear button ${formatLocation(location)}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				socket.emitPromise('controls:reset', [location]).catch((e) => {
					console.error(`Reset failed: ${e}`)
				})
			}
		)
	}, [socket, location])

	return (
		<CButton color="danger" onClick={clearButton} title="Clear Button">
			<FontAwesomeIcon icon={faTrashAlt} />
		</CButton>
	)
}
