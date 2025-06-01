import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { CButtonGroup, CButton } from '@coreui/react'
import { faPlay, faUndo, faRedo } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useContext, useCallback } from 'react'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { MyErrorBoundary } from '~/util.js'

export function ControlHotPressButtons({
	location,
	showRotaries,
}: {
	location: ControlLocation
	showRotaries: boolean
}) {
	const { socket } = useContext(RootAppStoreContext)

	const hotPressDown = useCallback(() => {
		socket
			.emitPromise('controls:hot-press', [location, true, 'edit'])
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [socket, location])
	const hotPressUp = useCallback(() => {
		socket
			.emitPromise('controls:hot-press', [location, false, 'edit'])
			.catch((e) => console.error(`Hot press failed: ${e}`))
	}, [socket, location])
	const hotRotateLeft = useCallback(() => {
		socket
			.emitPromise('controls:hot-rotate', [location, false, 'edit'])
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [socket, location])
	const hotRotateRight = useCallback(() => {
		socket
			.emitPromise('controls:hot-rotate', [location, true, 'edit'])
			.catch((e) => console.error(`Hot rotate failed: ${e}`))
	}, [socket, location])

	return (
		<>
			<CButtonGroup>
				<CButton
					className="ms-1"
					color="warning"
					onMouseDown={hotPressDown}
					onMouseUp={hotPressUp}
					style={{ color: 'white' }}
					title="Test press button"
				>
					<FontAwesomeIcon icon={faPlay} />
					&nbsp;Test
				</CButton>
			</CButtonGroup>
			{showRotaries && (
				<MyErrorBoundary>
					<CButton
						className="ms-1"
						color="warning"
						onMouseDown={hotRotateLeft}
						style={{ color: 'white' }}
						title="Test rotate left"
					>
						<FontAwesomeIcon icon={faUndo} />
					</CButton>

					<CButton
						className="ms-1"
						color="warning"
						onMouseDown={hotRotateRight}
						style={{ color: 'white' }}
						title="Test rotate right"
					>
						<FontAwesomeIcon icon={faRedo} />
					</CButton>
				</MyErrorBoundary>
			)}
		</>
	)
}
