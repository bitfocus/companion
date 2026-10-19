import { faCircleExclamation, faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useCallback, useId, useState } from 'react'
import type { LinkTransportEntry, LinkTransportSection } from '@companion-app/shared/Model/Link.js'
import { Button } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { FormLabel } from '~/Components/Form.js'
import { Note } from '~/Components/Note.js'
import { StatusBadge } from '~/Components/StatusBadge.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useLinkStore } from './LinkStoreContext.js'
import { PeerLink } from './PeerLink.js'

/** A section a transport reports about itself (eg pairing requests), with the actions it offers on its entries */
export const TransportSection = observer(function TransportSection({
	transportId,
	section,
}: {
	transportId: string
	section: LinkTransportSection
}): React.JSX.Element {
	return (
		<EditSectionCard
			title={section.title}
			summary={section.attention ? <StatusBadge tone="warning">Needs attention</StatusBadge> : undefined}
		>
			{section.description && <p className="text-sm text-muted mb-0">{section.description}</p>}
			<div className="flex flex-col divide-y divide-border/70">
				{section.entries.map((entry) => (
					<TransportEntry key={entry.id} transportId={transportId} entry={entry} />
				))}
			</div>
		</EditSectionCard>
	)
})

/**
 * The entries of every transport's sections that need the user's attention, eg pairing requests, so that they are
 * seen and dealt with without opening the transport
 */
export const AttentionSections = observer(function AttentionSections(): React.JSX.Element | null {
	const linkStore = useLinkStore()

	const sections = linkStore.attentionSections
	if (sections.length === 0) return null

	return (
		<div className="flex flex-col gap-2 shrink-0 max-h-1/2 overflow-y-auto">
			{sections.flatMap(({ transportId, section }) =>
				section.entries.map((entry) => (
					<AttentionEntry
						key={`${transportId}:${entry.id}`}
						transportId={transportId}
						section={section}
						entry={entry}
					/>
				))
			)}
		</div>
	)
})

const AttentionEntry = observer(function AttentionEntry({
	transportId,
	section,
	entry,
}: {
	transportId: string
	section: LinkTransportSection
	entry: LinkTransportEntry
}) {
	const state = useEntryActions(transportId, entry)

	return (
		<Note tone="warning" icon={faTriangleExclamation} actions={<EntryActions entry={entry} state={state} />}>
			<div>
				<span className="font-semibold text-body-strong">
					<PeerLink peerId={entry.peerId}>{entry.title}</PeerLink>
				</span>
				<span className="text-xs"> · {section.title}</span>
			</div>
			{entry.description && <div className="text-xs">{entry.description}</div>}
			{state.error && <div className="text-xs text-danger">{state.error}</div>}
		</Note>
	)
})

const TransportEntry = observer(function TransportEntry({
	transportId,
	entry,
}: {
	transportId: string
	entry: LinkTransportEntry
}) {
	const state = useEntryActions(transportId, entry)

	return (
		<div className="flex flex-col gap-2 py-2 first:pt-0 last:pb-0">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
				<div className="grow basis-48 min-w-0">
					<div className="font-semibold truncate">
						<PeerLink peerId={entry.peerId}>{entry.title}</PeerLink>
					</div>
					{entry.description && <div className="text-xs text-muted">{entry.description}</div>}
				</div>
				<EntryActions entry={entry} state={state} />
			</div>

			{state.error && (
				<Note tone="danger" icon={faCircleExclamation} actions={null}>
					{state.error}
				</Note>
			)}
		</div>
	)
})

interface EntryActionsState {
	input: string
	setInput: (value: string) => void
	error: string | null
	busy: boolean
	doAction: (actionId: string) => void
}

/** Run the actions of an entry, with the value the user entered when it asks for one */
function useEntryActions(transportId: string, entry: LinkTransportEntry): EntryActionsState {
	const [input, setInput] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)

	const actionMutation = useMutationExt(trpc.link.transportSectionAction.mutationOptions())
	const doAction = useCallback(
		(actionId: string) => {
			setError(null)
			setBusy(true)
			actionMutation
				.mutateAsync({ transportId, entryId: entry.id, actionId, input: entry.inputLabel ? input : null })
				.then((result) => setError(result))
				.catch((e) => setError(e?.message ?? String(e)))
				.finally(() => setBusy(false))
		},
		[actionMutation, transportId, entry, input]
	)

	return { input, setInput, error, busy, doAction }
}

/** The value an entry asks for (eg a pairing code), and its action buttons, on one line */
function EntryActions({ entry, state }: { entry: LinkTransportEntry; state: EntryActionsState }): React.JSX.Element {
	const inputId = useId()
	const submitAction = entry.actions.find((action) => action.requiresInput)

	return (
		<div className="flex shrink-0 items-center gap-2">
			{entry.inputLabel && (
				<div className="w-32">
					<FormLabel htmlFor={inputId} className="sr-only">
						{entry.inputLabel}
					</FormLabel>
					<TextInputFieldSimple
						id={inputId}
						value={state.input}
						setValue={state.setInput}
						placeholder={entry.inputLabel}
						immediateValue
						onKeyDown={(e) => {
							if (e.key !== 'Enter' || !submitAction || state.busy || !state.input) return
							e.preventDefault()
							state.doAction(submitAction.id)
						}}
					/>
				</div>
			)}
			{entry.actions.map((action) => (
				<Button
					key={action.id}
					color={action.color}
					// Beside an input, match its height
					size={entry.inputLabel ? undefined : 'sm'}
					variant={action.color === 'danger' ? 'outline' : undefined}
					disabled={state.busy || (!!action.requiresInput && !state.input)}
					onClick={() => state.doAction(action.id)}
				>
					{action.label}
				</Button>
			))}
		</div>
	)
}
