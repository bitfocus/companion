import { faLink } from '@fortawesome/free-solid-svg-icons'
import { useSubscription } from '@trpc/tanstack-react-query'
import { useState } from 'react'
import type { CustomPresetControlId } from '@companion-app/shared/ControlId.js'
import type { CustomPresetUse } from '@companion-app/shared/Model/CustomPresetModel.js'
import { ListHeading } from '~/Components/ListHeading.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { BuildingBlockUseName } from '~/Controls/BuildingBlockUseName.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC.js'
import '~/Controls/BuildingBlockUses.css'

interface CustomPresetUsesEditorProps {
	controlId: CustomPresetControlId
}

/**
 * The buttons which are linked to a custom preset, and where each of them is
 */
export function CustomPresetUsesEditor({ controlId }: CustomPresetUsesEditorProps): React.JSX.Element {
	const [uses, setUses] = useState<CustomPresetUse[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.controls.customPresets.watchUses.subscriptionOptions(
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
				subheading={
					<p className="text-sm text-muted">
						The buttons which are linked to this custom preset. A copy of it is a button of its own, so is not listed.
					</p>
				}
				actions={null}
				collapse={null}
			/>

			<LoadingRetryOrError dataReady={!!uses} error={error} doRetry={sub.reset} design="pulse" />

			{uses &&
				(uses.length === 0 ? (
					<NonIdealState icon={faLink} text="No buttons are linked to this custom preset yet" />
				) : (
					<ul className="building-block-uses-list">
						{uses.map((use) => (
							<UseRow key={use.controlId} use={use} />
						))}
					</ul>
				))}
		</div>
	)
}

function UseRow({ use }: { use: CustomPresetUse }) {
	return (
		<li className="building-block-use">
			<BuildingBlockUseName controlId={use.controlId} />
		</li>
	)
}
