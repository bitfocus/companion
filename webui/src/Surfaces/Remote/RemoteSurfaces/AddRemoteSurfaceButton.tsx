import { CButton, CButtonGroup, CPopover } from '@coreui/react'
import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import React, { useCallback, useContext } from 'react'
import type { DropdownChoiceInt } from '~/DropDownInputFancy'
import { useMutationExt, trpc } from '~/Resources/TRPC'
import { useComputed } from '~/Resources/util'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

export const AddRemoteSurfaceButton = observer(function AddRemoteSurfaceButton(): React.JSX.Element {
	const { surfaceInstances } = useContext(RootAppStoreContext)

	const sortedInstances = useComputed(() => {
		const result: DropdownChoiceInt[] = []
		for (const [instanceId, instanceInfo] of surfaceInstances.instances) {
			if (!instanceInfo.remoteConfigFields) continue

			result.push({
				value: instanceId,
				label: instanceInfo.label,
			})
		}

		result.sort((a, b) => a.label.localeCompare(b.label))

		return result
	}, [surfaceInstances])

	return (
		<CPopover
			content={<AddRemoteSurfacePopoverContent sortedInstances={sortedInstances} />}
			trigger="focus"
			animation={false}
			placement="bottom"
			style={{ backgroundColor: 'white' }}
		>
			<CButton color="primary" size="sm" title="Add Remote Surface Connection" disabled={sortedInstances.length === 0}>
				<FontAwesomeIcon icon={faPlus} /> Add Remote Surface Connection (v2)
			</CButton>
		</CPopover>
	)
})

function AddRemoteSurfacePopoverButton({ instanceId, label }: { instanceId: string; label: string }) {
	const { notifier } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const addOutboundMutation = useMutationExt(trpc.surfaces.outbound.add2.mutationOptions())

	const addCallback = useCallback(() => {
		addOutboundMutation
			.mutateAsync({
				instanceId: instanceId,
			})
			.then((res) => {
				console.log('Created new outbound connection:', res)

				if (!res.ok) {
					notifier.show('Failed to setup connection', res.error ?? 'Unknown error')
				} else {
					void navigate({ to: '/surfaces/remote/$connectionId', params: { connectionId: res.id } })
				}
			})
			.catch((e) => {
				console.error('Failed to create outbound connection:', e)
			})
	}, [addOutboundMutation, instanceId, navigate, notifier])

	return (
		<CButton onMouseDown={addCallback} color="secondary" title={`Add ${label}`} style={{ textAlign: 'left' }}>
			{label}
		</CButton>
	)
}

const AddRemoteSurfacePopoverContent = observer(function AddRemoteSurfacePopoverContent({
	sortedInstances,
}: {
	sortedInstances: DropdownChoiceInt[]
}) {
	return (
		<>
			{/* Note: the popover closing due to focus loss stops mouseup/click events propagating */}
			<CButtonGroup vertical>
				{sortedInstances.map((instance) => (
					<AddRemoteSurfacePopoverButton
						key={instance.value}
						instanceId={String(instance.value)}
						label={instance.label}
					/>
				))}
			</CButtonGroup>
		</>
	)
})
