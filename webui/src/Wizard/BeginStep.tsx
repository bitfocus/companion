import { faRocket } from '@fortawesome/free-solid-svg-icons'
import { Button } from '~/Components/Button'
import { NonIdealState } from '~/Components/NonIdealState'

interface BeginStepProps {
	/** The wizard version the user last completed (0 for a fresh install) */
	prevVersion: number
	/** Titles of the steps that are new/changed since `prevVersion` */
	newStepTitles: string[]
	/** Whether the full flow is currently being shown (fresh install or "review all") */
	showAll: boolean
	/** Switch from the short upgrade flow to reviewing every setting */
	onReviewAll: () => void
}

export function BeginStep({ prevVersion, newStepTitles, showAll, onReviewAll }: BeginStepProps): React.JSX.Element {
	const isUpgrade = prevVersion > 0

	// Returning user with a short upgrade flow: explain what's new and offer to review everything
	if (isUpgrade && !showAll && newStepTitles.length > 0) {
		return (
			<div className="wizard-centered-step">
				<NonIdealState icon={faRocket}>
					<h4 className="mb-2">Welcome back!</h4>
					<p>
						Since you last set up Companion, a few settings are new or have changed. We'll quickly walk you through them
						- use the steps above to navigate.
					</p>
					<p className="mb-0">
						<Button color="link" className="p-0 align-baseline" onClick={onReviewAll}>
							Review all settings instead
						</Button>
					</p>
				</NonIdealState>
			</div>
		)
	}

	// Fresh install, or a returning user who chose to review everything
	return (
		<div className="wizard-centered-step">
			<NonIdealState icon={faRocket}>
				<h4 className="mb-2">{isUpgrade ? 'Review your settings' : 'Welcome to Companion'}</h4>
				<p className="mb-0">
					{isUpgrade
						? 'These are the settings we recommend you review. Use the steps above to jump between them.'
						: "Let's get you set up. We'll walk through a few settings worth reviewing before you start - use the steps above to navigate."}
				</p>
			</NonIdealState>
		</div>
	)
}
