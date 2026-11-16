import { faLink } from '@fortawesome/free-solid-svg-icons'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import type { CustomElementControlId } from '@companion-app/shared/ControlId.js'
import type { CustomElementUse } from '@companion-app/shared/Model/CustomElementModel.js'
import { ListHeading } from '~/Components/ListHeading.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { BuildingBlockUseName } from '~/Controls/BuildingBlockUseName.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC.js'
import '~/Controls/BuildingBlockUses.css'

interface CustomElementUsesEditorProps {
	controlId: CustomElementControlId
}

/**
 * The elements which use a custom element, and where each of them is
 */
export function CustomElementUsesEditor({ controlId }: CustomElementUsesEditorProps): React.JSX.Element {
	const [uses, setUses] = useState<CustomElementUse[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.controls.customElements.watchUses.subscriptionOptions(
			{ controlId },
			{
				onStarted: () => {
					setError(null)
					setUses(null)
				},
				onData: (data) => {
					setError(null)
					setUses(data)
				},
				onError: (e) => setError(`Failed to load the uses: ${e.message}`),
			}
		)
	)

	return (
		<div className="building-block-uses">
			<ListHeading
				heading="Uses"
				subheading={<p className="text-sm text-muted">The elements which use this custom element.</p>}
				actions={null}
				collapse={null}
			/>

			<LoadingRetryOrError dataReady={!!uses} error={error} doRetry={sub.reset} design="pulse" />

			{uses &&
				(uses.length === 0 ? (
					<NonIdealState icon={faLink} text="Nothing uses this custom element yet" />
				) : (
					<ul className="building-block-uses-list">
						{uses.map((use) => (
							<UseRow key={`${use.controlId}:${use.elementId}`} use={use} />
						))}
					</ul>
				))}
		</div>
	)
}

function UseRow({ use }: { use: CustomElementUse }) {
	return (
		<li className="building-block-use">
			<BuildingBlockUseName controlId={use.controlId} />
			{use.disabled && <div className="building-block-use-status">Disabled</div>}
		</li>
	)
}
