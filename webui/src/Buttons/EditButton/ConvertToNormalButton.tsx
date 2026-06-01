import { faPencil } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useRef } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { trpc, useMutationExt } from '~/Resources/TRPC'

interface ConvertToNormalButtonProps {
	location: ControlLocation
}

export function ConvertToNormalButton({ location }: ConvertToNormalButtonProps): JSX.Element {
	const convertModalRef = useRef<GenericConfirmModalRef>(null)
	const convertControlMutation = useMutationExt(trpc.controls.convertControl.mutationOptions())

	const doConvertControl = useCallback(() => {
		convertModalRef.current?.show(
			'Convert to Normal Button',
			'This will convert this special button into a normal button with equivalent actions. This cannot be undone.',
			'Convert',
			() => {
				convertControlMutation.mutateAsync({ location }).catch((e) => {
					console.error(`Convert failed: ${e}`)
				})
			}
		)
	}, [convertControlMutation, location])

	return (
		<>
			<GenericConfirmModal ref={convertModalRef} />
			<Button color="secondary" onClick={doConvertControl} title="Convert to Normal Button">
				<FontAwesomeIcon icon={faPencil} className="me-1" />
				Edit
			</Button>
		</>
	)
}
