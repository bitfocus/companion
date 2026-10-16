import { faNetworkWired, faTrash } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useRef } from 'react'
import type { LinkTransportConfig } from '@companion-app/shared/Model/Link.js'
import { Button } from '~/Components/Button.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { TransportStatusBadge } from './LinkStatusBadges.js'
import { useLinkStore } from './LinkStoreContext.js'

export const TransportsList = observer(function TransportsList({
	selectedTransportId,
}: {
	selectedTransportId: string | null
}): React.JSX.Element {
	const linkStore = useLinkStore()
	const confirmModalRef = useRef<GenericConfirmModalRef>(null)

	const transports = linkStore.sortedTransports

	return (
		<>
			<GenericConfirmModal ref={confirmModalRef} />

			{transports.length === 0 ? (
				<NonIdealState icon={faNetworkWired}>
					No transports yet. Add one to tell this installation how to reach the others.
				</NonIdealState>
			) : (
				transports.map((transport) => (
					<TransportRow
						key={transport.id}
						transport={transport}
						isSelected={transport.id === selectedTransportId}
						confirmModalRef={confirmModalRef}
					/>
				))
			)}
		</>
	)
})

const TransportRow = observer(function TransportRow({
	transport,
	isSelected,
	confirmModalRef,
}: {
	transport: LinkTransportConfig
	isSelected: boolean
	confirmModalRef: React.RefObject<GenericConfirmModalRef | null>
}) {
	const linkStore = useLinkStore()
	const navigate = useNavigate()

	const removeMutation = useMutationExt(trpc.link.removeTransport.mutationOptions())
	const setEnabledMutation = useMutationExt(trpc.link.setTransportEnabled.mutationOptions())

	const doEdit = useCallback(() => {
		void navigate(
			isSelected
				? { to: '/link/transports' }
				: { to: '/link/transports/$transportId', params: { transportId: transport.id } }
		)
	}, [navigate, isSelected, transport.id])

	const doToggleEnabled = useCallback(
		(enabled: boolean) => {
			setEnabledMutation.mutateAsync({ id: transport.id, enabled }).catch((e) => {
				console.error('Failed to set transport enabled', e)
			})
		},
		[setEnabledMutation, transport.id]
	)

	const doDelete = useCallback(() => {
		confirmModalRef.current?.show(
			'Delete transport',
			[
				`Are you sure you want to delete "${transport.label}"?`,
				'Installations only reachable through it will go offline.',
			],
			'Delete',
			() => {
				removeMutation.mutateAsync({ id: transport.id }).catch((e) => {
					console.error('Failed to delete transport', e)
				})
				if (isSelected) void navigate({ to: '/link/transports' })
			}
		)
	}, [confirmModalRef, removeMutation, transport, isSelected, navigate])

	const typeName = linkStore.transportTypes.get(transport.type)?.name ?? `Unknown type "${transport.type}"`
	const state = linkStore.transportStates.get(transport.id)
	// The label defaults to the type name, so then describe the transport with what it reports about itself instead
	const firstInfo = state?.info[0]
	const subtitle = transport.label === typeName && firstInfo ? `${firstInfo.label}: ${firstInfo.value}` : typeName

	return (
		<div
			className={classNames(
				'list-row flex flex-row items-center gap-2 py-2 pe-3',
				isSelected ? 'list-row-selected' : 'hover:bg-surface-muted/60'
			)}
		>
			<div onClick={doEdit} className={classNames('flex flex-col grow min-w-0', { disabled: !transport.enabled })}>
				<b className="truncate">{transport.label}</b>
				<span className="truncate text-muted text-sm" title={typeName}>
					{subtitle}
				</span>
			</div>

			<TransportStatusBadge state={state} />

			<div className="flex items-center ps-2">
				<SwitchInputField
					id={undefined}
					value={transport.enabled}
					setValue={doToggleEnabled}
					tooltip={transport.enabled ? 'Disable transport' : 'Enable transport'}
				/>
				<Button onClick={doDelete} title="Delete" className="p-1" color="danger" variant="ghost">
					<FontAwesomeIcon icon={faTrash} />
				</Button>
			</div>
		</div>
	)
})
