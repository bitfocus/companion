import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { memo } from 'react'

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
					<WizardStepperStep
						key={item.index}
						index={item.index}
						displayNumber={i + 1}
						title={item.title}
						isNew={item.isNew}
						status={status}
						onJump={onJump}
					/>
				)
			})}
		</ol>
	)
}

interface WizardStepperStepProps {
	index: number
	/** 1-based position shown in the marker before a step is completed */
	displayNumber: number
	title: string
	isNew?: boolean
	status: StepStatus
	onJump: (index: number) => void
}

const WizardStepperStep = memo(function WizardStepperStep({
	index,
	displayNumber,
	title,
	isNew,
	status,
	onJump,
}: WizardStepperStepProps): React.JSX.Element {
	return (
		<li className={classNames('wizard-stepper-step', `wizard-stepper-step-${status}`)}>
			<button
				type="button"
				className="wizard-stepper-button"
				onClick={() => onJump(index)}
				aria-current={status === 'active' ? 'step' : undefined}
				aria-label={title}
			>
				<span className="wizard-stepper-marker">
					{status === 'complete' ? <FontAwesomeIcon icon={faCheck} /> : displayNumber}
				</span>
				<span className="wizard-stepper-label">
					{title}
					{isNew && <span className="wizard-stepper-badge">New</span>}
				</span>
			</button>
		</li>
	)
})
