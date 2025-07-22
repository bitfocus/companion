import { ClientDiscoveredSurfaceInfoSatellite } from '@companion-app/shared/Model/Surfaces.js'
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { LoadingBar } from '~/Resources/Loading.js'
import { CButton, CForm, CFormLabel, CModalBody, CModalFooter, CModalHeader } from '@coreui/react'
import { CModalExt } from '~/Components/CModalExt.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { MenuPortalContext } from '~/Components/MenuPortalContext'
import { useMutation, useQuery } from '@tanstack/react-query'
import { trpc } from '~/Resources/TRPC'

export interface SetupSatelliteModalRef {
	show(surfaceInfo: ClientDiscoveredSurfaceInfoSatellite): void
}
export const SetupSatelliteModal = forwardRef<SetupSatelliteModalRef>(function SetupSatelliteModal(_props, ref) {
	const [show, setShow] = useState(false)
	const [data, setData] = useState<ClientDiscoveredSurfaceInfoSatellite | null>(null)

	const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

	const buttonRef = useRef<HTMLButtonElement>(null)

	const buttonFocus = () => {
		if (buttonRef.current) {
			buttonRef.current.focus()
		}
	}

	const saveMutation = useMutation(trpc.surfaceDiscovery.setupSatellite.mutationOptions())
	const saveMutationAsync = saveMutation.mutateAsync

	const doClose = useCallback(() => setShow(false), [])
	const onClosed = useCallback(() => {
		setData(null)
	}, [])
	const doAction = useCallback(() => {
		if (!data || !selectedAddress) return

		// setData(null)
		// setShow(false)

		saveMutationAsync({
			satelliteInfo: data,
			companionAddress: selectedAddress,
		}).then(
			() => {
				setShow(false)
			},
			(e) => {
				console.error('Failed to setup satellite: ', e)
			}
		)
	}, [saveMutationAsync, data, selectedAddress])

	const externalAddressesQuery = useQuery(
		trpc.surfaceDiscovery.externalAddresses.queryOptions(undefined, {
			enabled: show,
		})
	)
	useEffect(() => {
		setSelectedAddress((address) => (address || externalAddressesQuery.data?.addresses[0]?.id?.toString()) ?? null)
	}, [externalAddressesQuery.data])
	const refetchExternalAddresses = externalAddressesQuery.refetch

	useImperativeHandle(
		ref,
		() => ({
			show(surfaceInfo) {
				setData(surfaceInfo)
				setShow(true)
				refetchExternalAddresses().catch((e) => {
					console.error('Failed to refetch external addresses: ', e)
				})

				// Focus the button asap. It also gets focused once the open is complete
				setTimeout(buttonFocus, 50)
			},
		}),
		[refetchExternalAddresses]
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

						{!externalAddressesQuery.data ? (
							// TODO - show error?
							<LoadingBar />
						) : (
							<>
								<CFormLabel>Companion Address</CFormLabel>
								<DropdownInputField
									choices={externalAddressesQuery.data?.addresses}
									value={selectedAddress ?? ''}
									setValue={(selected) => setSelectedAddress(selected?.toString() ?? '')}
									allowCustom={true}
									disabled={saveMutation.isPending}
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
						disabled={!externalAddressesQuery.data || !selectedAddress || saveMutation.isPending}
					>
						Setup
					</CButton>
				</CModalFooter>
			</MenuPortalContext.Provider>
		</CModalExt>
	)
})
