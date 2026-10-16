import { faCircleExclamation } from '@fortawesome/free-solid-svg-icons'
import { observer } from 'mobx-react-lite'
import { useCallback, useId, useState } from 'react'
import type { LinkTransportEntry, LinkTransportSection } from '@companion-app/shared/Model/Link.js'
import { Button } from '~/Components/Button.js'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { FormLabel } from '~/Components/Form.js'
import { Note } from '~/Components/Note.js'
import { SwitchInputFieldWithLabel } from '~/Components/SwitchInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'

/** The sections a transport reports about itself (eg pairing requests), with the actions it offers on them */
export const TransportSections = observer(function TransportSections({
	transportId,
	sections,
}: {
	transportId: string
	sections: LinkTransportSection[]
}): React.JSX.Element {
	return (
		<>
			{sections.map((section) => (
				<div key={section.id} className="mb-3">
					<EditSectionCard title={section.title} summary={section.attention ? 'Needs attention' : undefined}>
						{section.description && <p className="text-sm text-muted mb-2">{section.description}</p>}
						<div className="flex flex-col gap-3">
							{section.entries.map((entry) => (
								<TransportEntry key={entry.id} transportId={transportId} entry={entry} />
							))}
						</div>
					</EditSectionCard>
				</div>
			))}
		</>
	)
})

const TransportEntry = observer(function TransportEntry({
	transportId,
	entry,
}: {
	transportId: string
	entry: LinkTransportEntry
}) {
	const [input, setInput] = useState('')
	const [error, setError] = useState<string | null>(null)
	const [busy, setBusy] = useState(false)
	const inputId = useId()

	const actionMutation = useMutationExt(trpc.link.transportAction.mutationOptions())
	const doAction = useCallback(
		(actionId: string, actionInput: string | null) => {
			setError(null)
			setBusy(true)
			actionMutation
				.mutateAsync({ transportId, entryId: entry.id, actionId, input: actionInput })
				.then((result) => setError(result))
				.catch((e) => setError(e?.message ?? String(e)))
				.finally(() => setBusy(false))
		},
		[actionMutation, transportId, entry]
	)

	return (
		<div className="flex flex-col gap-2">
			<div className="min-w-0">
				<div className="font-semibold truncate">{entry.title}</div>
				{entry.description && <div className="text-sm text-muted">{entry.description}</div>}
			</div>

			{entry.toggles.map((toggle) => (
				<SwitchInputFieldWithLabel
					key={toggle.id}
					label={toggle.label}
					value={toggle.value}
					disabled={busy}
					setValue={(value) => doAction(toggle.id, value ? 'true' : 'false')}
				/>
			))}

			<div className="flex flex-wrap items-center gap-2">
				{entry.inputLabel && (
					<div className="grow min-w-0">
						<FormLabel htmlFor={inputId} className="sr-only">
							{entry.inputLabel}
						</FormLabel>
						<TextInputFieldSimple
							id={inputId}
							value={input}
							setValue={setInput}
							placeholder={entry.inputLabel}
							immediateValue
						/>
					</div>
				)}
				{entry.actions.map((action) => (
					<Button
						key={action.id}
						color={action.color}
						size="sm"
						variant={action.color === 'danger' ? 'outline' : undefined}
						disabled={busy || (action.color === 'primary' && !!entry.inputLabel && !input)}
						onClick={() => doAction(action.id, entry.inputLabel ? input : null)}
					>
						{action.label}
					</Button>
				))}
			</div>

			{error && (
				<Note tone="danger" icon={faCircleExclamation} actions={null}>
					{error}
				</Note>
			)}
		</div>
	)
})
