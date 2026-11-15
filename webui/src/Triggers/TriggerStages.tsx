import { faArrowDown, faBolt, faFilter, faPlay, type IconDefinition } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import React, { useCallback, useContext } from 'react'
import type { TriggerControlId } from '@companion-app/shared/ControlId.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { Button } from '~/Components/Button.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { TriggerEventEditor } from './EventEditor.js'
import './TriggerStages.css'

interface TriggerStagesProps {
	config: TriggerModel
	controlId: TriggerControlId
	localVariablesStore: LocalVariablesStore
}

/** A trigger's behaviour, as WHEN (events), IF (conditions) and THEN (actions) cards joined by arrows */
export function TriggerStages({ config, controlId, localVariablesStore }: TriggerStagesProps): React.JSX.Element {
	return (
		<div className="trigger-stages">
			<TriggerStage>
				<TriggerEventEditor
					heading={<TriggerStageHeading tone="warning" icon={faBolt} label="WHEN" title="Trigger Events" />}
					headingActions={<TriggerStageCount count={config.events.length} noun="event" />}
					controlId={controlId}
					events={config.events}
					localVariablesStore={localVariablesStore}
				/>
			</TriggerStage>

			<TriggerStageConnector />

			<TriggerStage>
				<ControlEntitiesEditor
					heading={<TriggerStageHeading tone="info" icon={faFilter} label="IF" title="Conditions & Guardrails" />}
					headingActions={[
						config.condition.length === 0 ? (
							<span key="count" className="trigger-stage-count">
								Always run
							</span>
						) : (
							<TriggerStageCount key="count" count={config.condition.length} noun="condition" />
						),
					]}
					controlId={controlId}
					entities={config.condition}
					listId="feedbacks"
					entityType={EntityModelType.Feedback}
					entityTypeLabel="condition"
					feedbackListType={FeedbackEntitySubType.Boolean}
					location={undefined}
					localVariablesStore={localVariablesStore}
					localVariablePrefix={null}
				/>
			</TriggerStage>

			<TriggerStageConnector />

			<TriggerStage>
				<ControlEntitiesEditor
					heading={<TriggerStageHeading tone="good" icon={faPlay} label="THEN" title="Execute Actions" />}
					headingActions={[
						<TriggerStageCount key="count" count={config.actions.length} noun="action" />,
						<TestActionsButton key="test" controlId={controlId} triggerName={config.options.name} />,
					]}
					controlId={controlId}
					location={undefined}
					listId="trigger_actions"
					entities={config.actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
					localVariablesStore={localVariablesStore}
					localVariablePrefix={null}
				/>
			</TriggerStage>
		</div>
	)
}

/** A stage's card. The list inside it draws its heading as the card's header */
function TriggerStage({ children }: { children: React.ReactNode }): React.JSX.Element {
	return (
		<div className="trigger-stage">
			<MyErrorBoundary>{children}</MyErrorBoundary>
		</div>
	)
}

function TriggerStageConnector(): React.JSX.Element {
	return (
		<div className="trigger-stage-connector">
			<div className="trigger-stage-connector-arrow">
				<FontAwesomeIcon icon={faArrowDown} />
			</div>
		</div>
	)
}

interface TriggerStageHeadingProps {
	tone: 'warning' | 'info' | 'good'
	icon: IconDefinition
	label: string
	title: string
}

function TriggerStageHeading({ tone, icon, label, title }: TriggerStageHeadingProps): React.JSX.Element {
	return (
		<div className="flex items-center gap-2">
			<span className={classNames('trigger-stage-badge', `tone-${tone}`)}>
				<FontAwesomeIcon icon={icon} className="text-3xs" />
				{label}
			</span>
			<span className="text-xs font-semibold text-body">{title}</span>
		</div>
	)
}

function TriggerStageCount({ count, noun }: { count: number; noun: string }): React.JSX.Element {
	return (
		<span className="trigger-stage-count">
			{count} {count === 1 ? noun : `${noun}s`}
		</span>
	)
}

function TestActionsButton({
	controlId,
	triggerName,
}: {
	controlId: TriggerControlId
	triggerName: string
}): React.JSX.Element {
	const { notifier } = useContext(RootAppStoreContext)
	const testActionsMutation = useMutationExt(trpc.controls.triggers.testActions.mutationOptions())

	const doTestRun = useCallback(() => {
		testActionsMutation
			.mutateAsync({ controlId })
			.then(() => {
				notifier.show('Trigger Tested', `Fired trigger "${triggerName || 'Untitled'}"`, 3000)
			})
			.catch((err) => {
				notifier.show('Test Failed', String(err), 4000)
			})
	}, [testActionsMutation, controlId, triggerName, notifier])

	return (
		<Button
			size="sm"
			className="inline-flex items-center gap-1.5 shrink-0"
			onClick={doTestRun}
			title="Test fire trigger actions immediately"
		>
			<FontAwesomeIcon icon={faPlay} className="text-2xs" />
			<span>Test Run</span>
		</Button>
	)
}
