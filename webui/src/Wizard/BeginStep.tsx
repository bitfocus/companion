import { Button } from '~/Components/Button'

interface BeginStepProps {
	/** The wizard version the user last completed (0 for a fresh install) */
	prevVersion: number
	/** Titles of every configurable step, in order */
	allStepTitles: string[]
	/** Titles of the steps that are new/changed since `prevVersion` */
	newStepTitles: string[]
	/** Whether the full flow is currently being shown (fresh install or "review all") */
	showAll: boolean
	/** Switch from the short upgrade flow to reviewing every setting */
	onReviewAll: () => void
}

/** Format a wizard version number (e.g. 34) as a friendly release string (e.g. "3.4") */
function formatWizardVersion(version: number): string {
	return `${Math.floor(version / 10)}.${version % 10}`
}

export function BeginStep({
	prevVersion,
	allStepTitles,
	newStepTitles,
	showAll,
	onReviewAll,
}: BeginStepProps): React.JSX.Element {
	const isUpgrade = prevVersion > 0

	// Returning user with a short upgrade flow: explain what's new and offer to review everything
	if (isUpgrade && !showAll && newStepTitles.length > 0) {
		return (
			<div>
				<p style={{ marginTop: 0 }}>
					Welcome back! Since you last set up Companion (version {formatWizardVersion(prevVersion)}), the following
					settings are new or have changed and are worth a quick review:
				</p>
				<ol>
					{newStepTitles.map((title) => (
						<li key={title}>{title}</li>
					))}
				</ol>
				<p className="mb-0">
					We'll just walk you through these. Would you rather go through everything?{' '}
					<Button color="link" className="p-0 align-baseline" onClick={onReviewAll}>
						Review all settings
					</Button>
				</p>
			</div>
		)
	}

	// Fresh install, or a returning user who chose to review everything
	return (
		<div>
			<p style={{ marginTop: 0 }}>
				{isUpgrade
					? 'Here are all of the settings you can review before using Companion:'
					: 'Whether you are a new user or upgrading, there are a number of settings you should review before using Companion. This wizard will walk you through the following configuration settings:'}
			</p>
			<ol>
				{allStepTitles.map((title) => (
					<li key={title}>{title}</li>
				))}
			</ol>
		</div>
	)
}
