import { faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { ClientLinkTransportType } from '@companion-app/shared/Model/Link.js'
import { Popover } from '~/Components/Popover.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { useLinkStore } from './LinkStoreContext.js'

/** Offers the transport types reported by the backend */
export const AddTransportButton = observer(function AddTransportButton(): React.JSX.Element {
	const linkStore = useLinkStore()
	const types = Array.from(linkStore.transportTypes.values())

	return (
		<Popover.Root>
			<Popover.Trigger color="primary" size="sm" caret title="Add a transport" disabled={types.length === 0}>
				<FontAwesomeIcon icon={faPlus} className="me-1.5" /> Add Transport
			</Popover.Trigger>
			<Popover.Popup arrow align="start">
				{types.map((type) => (
					<AddTransportItem key={type.type} type={type} />
				))}
			</Popover.Popup>
		</Popover.Root>
	)
})

function AddTransportItem({ type }: { type: ClientLinkTransportType }) {
	const { notifier } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const addMutation = useMutationExt(trpc.link.addTransport.mutationOptions())

	const doAdd = useCallback(() => {
		addMutation
			.mutateAsync({ type: type.type, label: type.name })
			.then((transportId) => {
				void navigate({ to: '/link/$transportId', params: { transportId } })
			})
			.catch((e) => {
				notifier.show('Failed to add transport', e?.message ?? String(e))
			})
	}, [addMutation, navigate, notifier, type])

	return (
		<Popover.Item onClick={doAdd} title={type.description}>
			<div className="flex flex-col items-start text-start max-w-80">
				<span className="font-semibold">{type.name}</span>
				<span className="text-xs text-muted whitespace-normal">{type.description}</span>
			</div>
		</Popover.Item>
	)
}
