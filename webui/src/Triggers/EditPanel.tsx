import { useCallback, useId, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import type { TriggerModel, TriggerOptions } from '@companion-app/shared/Model/TriggerModel.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button'
import { Form, FormLabel, InputGroup } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { ControlNotesEditor } from '~/Controls/ControlNotesEditor.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { useLocalVariablesStore } from '../Controls/LocalVariablesStore.js'
import { TriggerEventEditor } from './EventEditor.js'

interface EditTriggerPanelProps {
	controlId: string
}

export function EditTriggerPanel({ controlId }: EditTriggerPanelProps): React.JSX.Element {
	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					{controlConfig.config.type === 'trigger' ? (
						<TriggerPanelContent config={controlConfig.config} controlId={controlId} />
					) : (
						<StaticAlert color="danger">
							Invalid control type: {controlConfig.config.type}. Expected 'trigger'.
						</StaticAlert>
					)}
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface TriggerPanelContentProps {
	config: TriggerModel
	controlId: string
}

function TriggerPanelContent({ config, controlId }: TriggerPanelContentProps): React.ReactNode {
	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)
	const [activeTab, setActiveTab] = useLocalStorage('triggerEditor.activeTab', 'events')

	return (
		<>
			<MyErrorBoundary>
				<TriggerConfig options={config.options} controlId={controlId} />
			</MyErrorBoundary>

			<MyErrorBoundary>
				<ControlNotesEditor controlId={controlId} notes={config.options.notes} />
			</MyErrorBoundary>

			<div className="sticky-tabs">
				<TabArea.Root value={activeTab} onValueChange={setActiveTab}>
					<TabArea.List>
						<TabArea.Tab value="events">Events</TabArea.Tab>
						<TabArea.Tab value="conditions">Conditions</TabArea.Tab>
						<TabArea.Tab value="actions">Actions</TabArea.Tab>
						<TabArea.Tab value="variables">Local Variables</TabArea.Tab>
						<TabArea.Indicator />
					</TabArea.List>
				</TabArea.Root>
			</div>

			{activeTab === 'events' && (
				<MyErrorBoundary>
					<TriggerEventEditor
						heading="Events"
						subheading={<div className="mb-2">This trigger will be executed when any of the events happens</div>}
						controlId={controlId}
						events={config.events}
						localVariablesStore={localVariablesStore}
					/>
				</MyErrorBoundary>
			)}

			{activeTab === 'conditions' && (
				<MyErrorBoundary>
					<ControlEntitiesEditor
						className="mt-2"
						heading="Conditions"
						subheading={<div className="mb-2">Only execute when all of these conditions are true</div>}
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
				</MyErrorBoundary>
			)}

			{activeTab === 'actions' && (
				<MyErrorBoundary>
					<ControlEntitiesEditor
						className="mt-2"
						heading="Actions"
						subheading={<div className="mb-2">What should happen when executed</div>}
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
				</MyErrorBoundary>
			)}

			{activeTab === 'variables' && (
				<MyErrorBoundary>
					<LocalVariablesEditor
						className="mt-2"
						controlId={controlId}
						location={undefined}
						variables={config.localVariables}
						localVariablesStore={localVariablesStore}
					/>
				</MyErrorBoundary>
			)}
		</>
	)
}

interface TriggerConfigProps {
	controlId: string
	options: TriggerOptions
}

function TriggerConfig({ controlId, options }: TriggerConfigProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: string, value: JsonValue) => {
			console.log('set', controlId, key, value)
			setOptionsFieldMutation
				.mutateAsync({
					controlId,
					key,
					value,
				})
				.catch((e) => {
					console.error(`Set field failed: ${e}`)
				})
		},
		[setOptionsFieldMutation, controlId]
	)

	const setName = useCallback((val: string) => setValueInner('name', val), [setValueInner])

	const nameFieldId = useId()

	return (
		<Grid.Col sm={12} className="p-0">
			<Form onSubmit={PreventDefaultHandler} className="row flex-form">
				<Grid.Col xs={12}>
					<FormLabel htmlFor={nameFieldId}>Name</FormLabel>
					<br />
					<InputGroup>
						<TextInputFieldSimple id={nameFieldId} setValue={setName} value={options.name} />
						<TestActionsButton controlId={controlId} hidden={!options} />
					</InputGroup>
				</Grid.Col>
			</Form>
		</Grid.Col>
	)
}

function TestActionsButton({ controlId, hidden }: { controlId: string; hidden: boolean }): React.JSX.Element {
	const testActionsMutation = useMutationExt(trpc.controls.triggers.testActions.mutationOptions())

	const hotPressDown = useCallback(() => {
		testActionsMutation.mutateAsync({ controlId }).catch((e) => console.error(`Hot press failed: ${e}`))
	}, [testActionsMutation, controlId])
	return (
		<Button color="warning" hidden={hidden} onMouseDown={hotPressDown}>
			Test actions
		</Button>
	)
}
