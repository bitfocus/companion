import { faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { memo } from 'react'

export interface StepSelectorItem {
	/** The step index this item jumps to when clicked */
	index: number
	/** Label shown beneath the marker */
	title: string
	/** Show a "NEW" badge (e.g. for steps surfaced by a short upgrade flow) */
	isNew?: boolean
}

export interface StepSelectorProps {
	items: StepSelectorItem[]
	/** The current step index */
	currentIndex: number
	onJump: (index: number) => void
}

type StepStatus = 'complete' | 'active' | 'upcoming'

export function StepSelector({ items, currentIndex, onJump }: StepSelectorProps): React.JSX.Element {
	return (
		<ol className="step-selector" role="list">
			{items.map((item, i) => {
				const status: StepStatus =
					currentIndex > item.index ? 'complete' : currentIndex === item.index ? 'active' : 'upcoming'

				return (
					<StepSelectorStep
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

interface StepSelectorStepProps {
	index: number
	/** 1-based position shown in the marker before a step is completed */
	displayNumber: number
	title: string
	isNew?: boolean
	status: StepStatus
	onJump: (index: number) => void
}

const StepSelectorStep = memo(function StepSelectorStep({
	index,
	displayNumber,
	title,
	isNew,
	status,
	onJump,
}: StepSelectorStepProps): React.JSX.Element {
	return (
		<li className={classNames('step-selector-step', `step-selector-step-${status}`)}>
			<button
				type="button"
				className="step-selector-button"
				onClick={() => onJump(index)}
				aria-current={status === 'active' ? 'step' : undefined}
				aria-label={isNew ? `${title} (New)` : title}
			>
				<span className="step-selector-marker">
					{status === 'complete' ? <FontAwesomeIcon icon={faCheck} /> : displayNumber}
				</span>
				<span className="step-selector-label">
					{title}
					{isNew && <span className="step-selector-badge">New</span>}
				</span>
			</button>
		</li>
	)
})
