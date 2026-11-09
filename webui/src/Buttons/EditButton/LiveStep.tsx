import { GetStepIds } from '@companion-app/shared/Controls.js'
import type { NormalButtonSteps } from '@companion-app/shared/Model/ButtonModel.js'

/** Marks the step a button is on, wherever its steps are shown */
export function LiveStepDot({ pulse }: { pulse: boolean }): React.JSX.Element {
	return (
		<span
			className={`inline-block w-1.5 h-1.5 rounded-full bg-tone-good-fill ${pulse ? 'animate-pulse' : ''}`}
			title="Active live step"
		/>
	)
}

interface LiveStepLabelProps {
	steps: NormalButtonSteps
	currentStepId: string
}

/**
 * Which step the button is on, for the editor's header, so it can be seen from every tab and not only from the
 * steps bar under Actions. Nothing for a button with one step, where there is no other step it could be on.
 */
export function LiveStepLabel({ steps, currentStepId }: LiveStepLabelProps): React.JSX.Element | null {
	const stepIds = GetStepIds(steps)
	if (stepIds.length < 2) return null

	const index = stepIds.indexOf(currentStepId)
	if (index === -1) return null

	const name = steps[currentStepId]?.options.name
	const position = `${index + 1} of ${stepIds.length}`

	return (
		<span className="edit-button-summary-step">
			<LiveStepDot pulse={false} />
			{name ? `${name} · step ${position}` : `Step ${position}`}
		</span>
	)
}
