import { faLink } from '@fortawesome/free-solid-svg-icons'
import { useSubscription } from '@trpc/tanstack-react-query'
import { observer } from 'mobx-react-lite'
import { useContext, useState } from 'react'
import type { CustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import type { CustomFeedbackUse } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { ListHeading } from '~/Components/ListHeading.js'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { describeUseControl } from '~/CustomActions/UsesDescription.js'
import { UseControlName } from '~/CustomActions/UsesEditor.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import './UsesEditor.css'

interface CustomFeedbackUsesEditorProps {
	controlId: CustomFeedbackControlId
}

/**
 * The feedbacks which use a custom feedback, and where each of them is
 */
export function CustomFeedbackUsesEditor({ controlId }: CustomFeedbackUsesEditorProps): React.JSX.Element {
	const [uses, setUses] = useState<CustomFeedbackUse[] | null>(null)
	const [error, setError] = useState<string | null>(null)

	const sub = useSubscription(
		trpc.controls.customFeedbacks.watchUses.subscriptionOptions(
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
		<div className="custom-feedback-uses">
			<ListHeading
				heading="Uses"
				subheading={<p className="text-sm text-muted">The feedbacks which use this custom feedback.</p>}
				actions={null}
				collapse={null}
			/>

			<LoadingRetryOrError dataReady={!!uses} error={error} doRetry={sub.reset} design="pulse" />

			{uses &&
				(uses.length === 0 ? (
					<NonIdealState icon={faLink} text="Nothing uses this custom feedback yet" />
				) : (
					<ul className="custom-feedback-uses-list">
						{uses.map((use) => (
							<UseRow key={`${use.controlId}:${use.entityId}`} use={use} />
						))}
					</ul>
				))}
		</div>
	)
}

const UseRow = observer(function UseRow({ use }: { use: CustomFeedbackUse }) {
	const stores = useContext(RootAppStoreContext)
	const description = describeUseControl(use.controlId, stores)

	return (
		<li className="custom-feedback-use">
			<div className="custom-feedback-use-name">
				<span className="custom-feedback-use-kind">{description.kind}</span>
				<UseControlName name={description.name} link={description.link} />
			</div>
			{use.disabled && <div className="custom-feedback-use-status">Disabled</div>}
		</li>
	)
})
