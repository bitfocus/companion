import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'

export interface WizardStepperItem {
	/** The wizard step index this item jumps to when clicked */
	index: number
	/** Label shown beneath the marker */
	title: string
	/** Show a "NEW" badge (used for steps surfaced by the short upgrade flow) */
	isNew?: boolean
}

export interface WizardStepperProps {
	items: WizardStepperItem[]
	/** The wizard's current step index */
	currentIndex: number
	onJump: (index: number) => void
}

type StepStatus = 'complete' | 'active' | 'upcoming'

export function WizardStepper({ items, currentIndex, onJump }: WizardStepperProps): React.JSX.Element {
	return (
		<ol className="wizard-stepper" role="list">
			{items.map((item, i) => {
				const status: StepStatus =
					currentIndex > item.index ? 'complete' : currentIndex === item.index ? 'active' : 'upcoming'

				return (
					<li key={item.index} className={classNames('wizard-stepper-step', `wizard-stepper-step-${status}`)}>
						<button
							type="button"
							className="wizard-stepper-button"
							onClick={() => onJump(item.index)}
							aria-current={status === 'active' ? 'step' : undefined}
							aria-label={item.title}
						>
							<span className="wizard-stepper-marker">
								{status === 'complete' ? <FontAwesomeIcon icon={faCheck} /> : i + 1}
							</span>
							<span className="wizard-stepper-label">
								{item.title}
								{item.isNew && <span className="wizard-stepper-badge">New</span>}
							</span>
						</button>
					</li>
				)
			})}
		</ol>
	)
}
