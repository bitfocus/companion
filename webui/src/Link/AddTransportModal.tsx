import { faArrowLeft, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, useState } from 'react'
import type { ClientLinkTransportType } from '@companion-app/shared/Model/Link.js'
import { Button } from '~/Components/Button.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './AddTransportModal.css'
import { useLinkStore } from './LinkStoreContext.js'

/** Add a transport: first choose its type, then name it */
export const AddTransportModal = observer(function AddTransportModal({ open }: { open: boolean }): React.JSX.Element {
	const navigate = useNavigate()
	const [selectedType, setSelectedType] = useState<ClientLinkTransportType | null>(null)

	const close = useCallback(() => {
		setSelectedType(null)
		void navigate({ to: '/link/transports' })
	}, [navigate])

	return (
		<Modal.Root
			open={open}
			onOpenChange={(open) => {
				if (!open) close()
			}}
		>
			<Modal.Portal>
				<Modal.Backdrop />
				<Modal.Viewport>
					<Modal.Popup size="lg" scrollable className="add-transport-modal">
						<Modal.Header closeButton>
							<Modal.Title>{selectedType ? `Add ${selectedType.name}` : 'Add Transport'}</Modal.Title>
						</Modal.Header>
						{selectedType ? (
							<NameTransportStep type={selectedType} onBack={() => setSelectedType(null)} onAdded={close} />
						) : (
							<ChooseTypeStep onChoose={setSelectedType} />
						)}
					</Modal.Popup>
				</Modal.Viewport>
			</Modal.Portal>
		</Modal.Root>
	)
})

const ChooseTypeStep = observer(function ChooseTypeStep({
	onChoose,
}: {
	onChoose: (type: ClientLinkTransportType) => void
}) {
	const linkStore = useLinkStore()

	return (
		<Modal.Body>
			<p className="text-sm text-muted">Choose how to reach the other installations.</p>
			{/* In the order the backend offers them, which puts the recommended ones first */}
			<div className="list-card overflow-hidden">
				{Array.from(linkStore.transportTypes.values(), (type) => (
					<Button
						key={type.type}
						variant="ghost"
						className="add-transport-type list-row"
						onClick={() => onChoose(type)}
					>
						<span className="flex flex-col items-start gap-1 min-w-0 grow">
							<span className="flex items-center gap-2 text-base font-semibold text-body-strong">{type.name}</span>
							<span className="text-sm text-muted whitespace-normal">{type.description}</span>
						</span>
						<FontAwesomeIcon icon={faChevronRight} className="shrink-0 text-muted" aria-hidden="true" />
					</Button>
				))}
			</div>
		</Modal.Body>
	)
})

const NameTransportStep = observer(function NameTransportStep({
	type,
	onBack,
	onAdded,
}: {
	type: ClientLinkTransportType
	onBack: () => void
	onAdded: () => void
}) {
	const { notifier } = useContext(RootAppStoreContext)
	const navigate = useNavigate()
	const labelId = useId()
	const [label, setLabel] = useState(type.name)
	const [busy, setBusy] = useState(false)

	const addMutation = useMutationExt(trpc.link.addTransport.mutationOptions())

	const doAdd = useCallback(() => {
		setBusy(true)
		addMutation
			.mutateAsync({ type: type.type, label: label.trim() })
			.then((transportId) => {
				onAdded()
				void navigate({ to: '/link/transports/$transportId', params: { transportId } })
			})
			.catch((e) => {
				notifier.show('Failed to add transport', e?.message ?? String(e))
			})
			.finally(() => setBusy(false))
	}, [addMutation, type, label, onAdded, navigate, notifier])

	return (
		<>
			<Modal.Body>
				<p className="text-sm text-muted">{type.description}</p>
				<Form onSubmit={PreventDefaultHandler}>
					<FormLabel htmlFor={labelId}>Name</FormLabel>
					<TextInputField id={labelId} value={label} setValue={setLabel} immediateValue />
					<div className="form-text">Shown in the list of transports. It can be changed later.</div>
				</Form>
			</Modal.Body>
			<Modal.Footer>
				<Button color="secondary" onClick={onBack} disabled={busy}>
					<FontAwesomeIcon icon={faArrowLeft} className="me-1" /> Back
				</Button>
				<Button color="primary" onClick={doAdd} disabled={busy || !label.trim()}>
					<FontAwesomeIcon icon={faPlus} className="me-1" /> Add Transport
				</Button>
			</Modal.Footer>
		</>
	)
})
