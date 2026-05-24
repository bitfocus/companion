import { useMutation, useQuery } from '@tanstack/react-query'
import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useRef, useState } from 'react'
import type { ClientDiscoveredSurfaceInfoSatellite } from '@companion-app/shared/Model/Surfaces.js'
import { Button } from '~/Components/Button.js'
import { DropdownInputField } from '~/Components/DropdownInputField.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal'
import { LoadingBar } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC'

export interface SetupSatelliteModalRef {
	show(surfaceInfo: ClientDiscoveredSurfaceInfoSatellite): void
}
export const SetupSatelliteModal = forwardRef<SetupSatelliteModalRef>(function SetupSatelliteModal(_props, ref) {
	const [show, setShow] = useState(false)
	const [data, setData] = useState<ClientDiscoveredSurfaceInfoSatellite | null>(null)

	const [selectedAddress, setSelectedAddress] = useState<string | null>(null)

	const buttonRef = useRef<HTMLButtonElement>(null)

	const saveMutation = useMutation(trpc.surfaces.outbound.discovery.setupSatellite.mutationOptions())
	const saveMutationAsync = saveMutation.mutateAsync

	const doAction = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault()
			e.stopPropagation()

			if (!data || !selectedAddress) return

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
		},
		[saveMutationAsync, data, selectedAddress]
	)

	const externalAddressesQuery = useQuery(
		trpc.surfaces.outbound.discovery.externalAddresses.queryOptions(undefined, {
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
			},
		}),
		[refetchExternalAddresses]
	)

	const onOpenChangeComplete = useCallback((open: boolean) => {
		if (!open) setData(null)
	}, [])

	const companionAddressFieldId = useId()

	return (
		<Modal.Root open={show} onOpenChange={setShow} onOpenChangeComplete={onOpenChangeComplete}>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup initialFocus={buttonRef}>
						<Modal.Header closeButton>
							<Modal.Title>Setup Companion Satellite</Modal.Title>
						</Modal.Header>
						<Modal.Body>
							<Form onSubmit={doAction}>
								<p>This will configure the selected Companion Satellite installation to connect to Companion</p>

								{!externalAddressesQuery.data ? (
									// TODO - show error?
									<LoadingBar />
								) : (
									<>
										<FormLabel htmlFor={companionAddressFieldId}>Companion Address</FormLabel>
										<DropdownInputField
											htmlName={companionAddressFieldId}
											choices={externalAddressesQuery.data?.addresses}
											value={selectedAddress ?? ''}
											setValue={(selected) => setSelectedAddress(selected?.toString() ?? '')}
											allowCustom={true}
											disabled={saveMutation.isPending}
										/>
										<p>Select the address of Companion that satellite should connect to</p>
									</>
								)}
							</Form>
						</Modal.Body>
						<Modal.Footer>
							<Modal.Close>Cancel</Modal.Close>
							<Button
								ref={buttonRef}
								color="primary"
								onClick={doAction}
								disabled={!externalAddressesQuery.data || !selectedAddress || saveMutation.isPending}
							>
								Setup
							</Button>
						</Modal.Footer>
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})
