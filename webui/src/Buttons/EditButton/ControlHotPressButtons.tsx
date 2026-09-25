import { faPlay, faRedo, faStop, faUndo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback } from 'react'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { Button } from '~/Components/Button'
import { MyErrorBoundary } from '~/Resources/Error'
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
		<div className="control-hotpress-actions" role="group" aria-label="Test button actions">
			<Button
				className="edit-button-toolbar-action"
				color="primary"
				size="sm"
				onMouseDown={hotPressDown}
				onMouseUp={hotPressUp}
				title="Test press button"
			>
				<FontAwesomeIcon icon={faPlay} />
				Test
			</Button>

			{showRotaries && (
				<MyErrorBoundary>
					<Button
						className="edit-button-toolbar-action"
						color="secondary"
						size="sm"
						onMouseDown={hotRotateLeft}
						title="Test rotate left"
					>
						<FontAwesomeIcon icon={faUndo} />
					</Button>

					<Button
						className="edit-button-toolbar-action"
						color="secondary"
						size="sm"
						onMouseDown={hotRotateRight}
						title="Test rotate right"
					>
						<FontAwesomeIcon icon={faRedo} />
					</Button>
				</MyErrorBoundary>
			)}

			<Button
				className="edit-button-toolbar-action"
				color="danger"
				size="sm"
				onMouseDown={hotAbortActions}
				title="Abort running actions"
			>
				<FontAwesomeIcon icon={faStop} />
				Stop
			</Button>
		</div>
	)
}
