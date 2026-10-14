import { faPlay, faRedo, faStop, faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { trpc, useMutationExt } from '~/Resources/TRPC'

export function ControlHotPressButtons({
	location,
	showRotaries,
}: {
	location: ControlLocation
	showRotaries: boolean
}): React.JSX.Element {
	const hotPressMutation = useMutationExt(trpc.controls.hotPressControl.mutationOptions())
	const hotRotateMutation = useMutationExt(trpc.controls.hotRotateControl.mutationOptions())
	const hotAbortMutation = useMutationExt(trpc.controls.hotAbortControl.mutationOptions())

	const hotPressDown = useCallback(() => {
		hotPressMutation
			.mutateAsync({ location, direction: true, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [hotPressMutation, location])
	const hotPressUp = useCallback(() => {
		hotPressMutation
			.mutateAsync({ location, direction: false, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [hotPressMutation, location])
	const hotRotateLeft = useCallback(() => {
		hotRotateMutation
			.mutateAsync({ location, direction: false, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [hotRotateMutation, location])
	const hotRotateRight = useCallback(() => {
		hotRotateMutation
			.mutateAsync({ location, direction: true, surfaceId: 'edit' })
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [hotRotateMutation, location])
	const hotAbortActions = useCallback(() => {
		hotAbortMutation.mutateAsync({ location }).catch((e) => console.error(`Hot abort failed: ${e}`))
	}, [hotAbortMutation, location])

	return (
		<ButtonGroup className="control-hotpress-actions">
			<Button color="secondary" size="sm" onMouseDown={hotPressDown} onMouseUp={hotPressUp} title="Test press button">
				<FontAwesomeIcon icon={faPlay} className="me-1.5" />
				Test
			</Button>

			{showRotaries && (
				<>
					<Button color="secondary" size="sm" onMouseDown={hotRotateLeft} title="Test rotate left">
						<FontAwesomeIcon icon={faUndo} />
					</Button>
					<Button color="secondary" size="sm" onMouseDown={hotRotateRight} title="Test rotate right">
						<FontAwesomeIcon icon={faRedo} />
					</Button>
				</>
			)}

			<Button
				color="secondary"
				size="sm"
				className="control-hotpress-stop"
				onMouseDown={hotAbortActions}
				title="Abort running actions"
				aria-label="Abort running actions"
			>
				<FontAwesomeIcon icon={faStop} />
			</Button>
		</ButtonGroup>
	)
}
