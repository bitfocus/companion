import {
	ClientDiscoveredSurfaceInfoSatellite,
	CompanionExternalAddresses,
} from '@companion-app/shared/Model/Surfaces.js'
import React, { forwardRef, useCallback, useContext, useImperativeHandle, useRef, useState } from 'react'
import { SocketContext, LoadingBar } from '~/util.js'
import { CButton, CForm, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { CModalExt } from '~/Components/CModalExt.js'
import { DropdownInputField, MenuPortalContext } from '~/Components/DropdownInputField.js'

export interface SetupSatelliteModalRef {
	show(surfaceInfo: ClientDiscoveredSurfaceInfoSatellite): void
}
export const SetupSatelliteModal = forwardRef<SetupSatelliteModalRef>(function SetupSatelliteModal(_props, ref) {
	const socket = useContext(SocketContext)

	const [show, setShow] = useState(false)
	const [data, setData] = useState<ClientDiscoveredSurfaceInfoSatellite | null>(null)

	const [externalAddresses, setExternalAddresses] = useState<CompanionExternalAddresses | null>(null)
	const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
	const [isExecuting, setIsExecuting] = useState(false)

	const buttonRef = useRef<HTMLButtonElement>(null)

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setData(null)
		setExternalAddresses(null)
		setIsExecuting(false)
	}, [])
	const doAction = useCallback(() => {
		if (!data || !selectedAddress) return

		// setData(null)
		// setShow(false)
		setIsExecuting(true)

		socket
			.emitPromise('surfaces:discovery:setup-satellite', [data, selectedAddress], 10000)
			.then((_failureReason) => {
				// TODO

				setShow(false)
			})
			.catch((e) => {
				console.error('Failed to setup satellite: ', e)
				setIsExecuting(false)
			})
	}, [socket, data, selectedAddress])

	useImperativeHandle(
		ref,
		() => ({
			show(surfaceInfo) {
				setData(surfaceInfo)
				setShow(true)
				setExternalAddresses(null)
				setIsExecuting(false)

				socket
					.emitPromise('surfaces:discovery:get-external:addresses', [])
					.then((externalAddresses) => {
						setExternalAddresses(externalAddresses)
						setSelectedAddress((address) => (address || externalAddresses.addresses[0]?.id?.toString()) ?? null)
					})
					.catch((e) => {
						console.error('Failed to list possible addresses: ', e)
					})

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[socket]
	)

	const [modalRef, setModalRef] = useState<HTMLElement | null>(null)

	return (
		<CModalExt ref={setModalRef} visible={show} onClose={doClose} onClosed={onClosed} onOpened={buttonFocus}>
			<MenuPortalContext.Provider value={modalRef}>
				<CModalHeader closeButton>
					<h5>Setup Companion Satellite</h5>
				</CModalHeader>
				<CModalBody>
					<CForm onSubmit={doAction}>
						<p>This will configure the selected Companion Satellite installation to connect to Companion</p>

						{!externalAddresses ? (
							<LoadingBar />
						) : (
							<>
								<DropdownInputField
									label="Companion Address"
									choices={externalAddresses.addresses}
									value={selectedAddress ?? ''}
									setValue={(selected) => setSelectedAddress(selected?.toString() ?? '')}
									allowCustom={true}
									disabled={isExecuting}
								/>
								<p>Select the address of Companion that satellite should connect to</p>
							</>
						)}
					</CForm>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton
						ref={buttonRef}
						color="primary"
						onClick={doAction}
						disabled={!externalAddresses || !selectedAddress || isExecuting}
					>
						Setup
					</CButton>
				</CModalFooter>
			</MenuPortalContext.Provider>
		</CModalExt>
	)
})
