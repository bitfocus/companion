import { formatLocation } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CButton } from '@coreui/react'
import { faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback } from 'react'
import type { GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export function ControlClearButton({
	location,
	resetModalRef,
}: {
	location: ControlLocation
	resetModalRef: React.MutableRefObject<GenericConfirmModalRef | null>
}): React.JSX.Element {
	const resetControlMutation = useMutationExt(trpc.controls.resetControl.mutationOptions())

	const clearButton = useCallback(() => {
		resetModalRef.current?.show(
			`Clear button ${formatLocation(location)}`,
			`This will clear the style, feedbacks and all actions`,
			'Clear',
			() => {
				resetControlMutation.mutateAsync({ location }).catch((e) => {
					console.error(`Reset failed: ${e}`)
				})
			}
		)
	}, [resetControlMutation, location, resetModalRef])

	return (
		<CButton color="danger" onClick={clearButton} title="Clear Button">
			<FontAwesomeIcon icon={faTrashAlt} />
		</CButton>
	)
}
