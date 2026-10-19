import { faArrowLeft, faChevronRight, faPlus } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, useState } from 'react'
import { getDefaultLinkTransportConfig } from '@companion-app/shared/LinkTransportConfig.js'
import type { ClientLinkTransportType } from '@companion-app/shared/Model/Link.js'
import { validateInputValue } from '@companion-app/shared/ValidateInputValue.js'
import { Button } from '~/Components/Button.js'
import { Form, FormLabel } from '~/Components/Form.js'
import { Modal } from '~/Components/Modal.js'
import { TextInputField } from '~/Components/TextInputField.js'
import { OptionsVisibility } from '~/Hooks/OptionsVisibility.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './AddTransportModal.css'
import { useLinkStore } from './LinkStoreContext.js'
import { TransportConfigField } from './TransportConfigField.js'

/** Add a transport: first choose its type, then name and configure it */
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
							<ConfigureTransportStep type={selectedType} onBack={() => setSelectedType(null)} onAdded={close} />
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
				{linkStore.addableTransportTypes.map((type) => (
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
			<p className="text-sm text-muted mt-3 mb-0">
				More ways to reach other installations are planned. If you need one that isn't here, let us know on{' '}
				<a href="https://github.com/bitfocus/companion/issues" target="_blank" rel="noreferrer">
					GitHub
				</a>
				.
			</p>
		</Modal.Body>
	)
})

/** Name the new transport, and fill in its config, so that it can start straight away */
const ConfigureTransportStep = observer(function ConfigureTransportStep({
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
	const [config, setConfig] = useState(() => getDefaultLinkTransportConfig(type.configFields))
	const [busy, setBusy] = useState(false)

	const addMutation = useMutationExt(trpc.link.addTransport.mutationOptions())

	const fieldErrors = new Map(
		type.configFields.map((field) => [field.id, validateInputValue(field, config[field.id]).validationError ?? null])
	)
	const isValid = !!label.trim() && Array.from(fieldErrors.values()).every((error) => error === null)

	const doAdd = useCallback(() => {
		setBusy(true)
		addMutation
			.mutateAsync({ type: type.type, label: label.trim(), config })
			.then((result) => {
				if (!result.ok) {
					notifier.show(
						'Failed to add transport',
						`Some fields are invalid: ${Object.values(result.errors).join(', ')}`
					)
					return
				}
				onAdded()
				void navigate({ to: '/link/transports/$transportId', params: { transportId: result.id } })
			})
			.catch((e) => {
				notifier.show('Failed to add transport', e?.message ?? String(e))
			})
			.finally(() => setBusy(false))
	}, [addMutation, type, label, config, onAdded, navigate, notifier])

	return (
		<>
			<Modal.Body>
				<p className="text-sm text-muted mb-4">{type.description}</p>
				{/* Laid out like the transport editor, a label beside each field */}
				<Form
					onSubmit={(e) => {
						e.preventDefault()
						// Enter adds it, as the button does
						if (!busy && isValid) doAdd()
					}}
					className="edit-panel flex flex-col gap-3"
				>
					<div className="edit-field-row">
						<FormLabel htmlFor={labelId}>Name</FormLabel>
						<TextInputField id={labelId} value={label} setValue={setLabel} immediateValue />
					</div>
					<OptionsVisibility options={type.configFields} values={config}>
						{(visibility) =>
							type.configFields.map((field) => (
								<TransportConfigField
									transportType={type.type}
									key={field.id}
									definition={field}
									value={config[field.id]}
									setValue={(value) => setConfig((prev) => ({ ...prev, [field.id]: value }))}
									isVisible={visibility.get(field.id) ?? true}
									// Only once there is something to complain about, rather than on an empty form
									errors={config[field.id] ? (fieldErrors.get(field.id) ?? null) : null}
								/>
							))
						}
					</OptionsVisibility>
				</Form>
			</Modal.Body>
			<Modal.Footer>
				<Button color="secondary" onClick={onBack} disabled={busy}>
					<FontAwesomeIcon icon={faArrowLeft} className="me-1" /> Back
				</Button>
				<Button color="primary" onClick={doAdd} disabled={busy || !isValid}>
					<FontAwesomeIcon icon={faPlus} className="me-1" /> Add Transport
				</Button>
			</Modal.Footer>
		</>
	)
})
