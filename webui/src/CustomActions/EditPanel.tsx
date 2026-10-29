import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useContext, useId, useMemo } from 'react'
import type { JsonValue } from 'type-fest'
import type { CustomActionModel } from '@companion-app/shared/Model/CustomActionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import type {
	AuthorableInputField,
	ExpressionOrValue,
	SomeCompanionInputField,
} from '@companion-app/shared/Model/Options.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import {
	InputFieldDefinitionsEditor,
	type InputFieldDefinitionsService,
} from '~/Components/InputFieldDefinitionsEditor/InputFieldDefinitionsEditor.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'

interface EditCustomActionPanelProps {
	controlId: string
}

export function EditCustomActionPanel({ controlId }: EditCustomActionPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const loadError = configError ?? null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig &&
				(controlConfig.config.type === 'custom-action' ? (
					<CustomActionPanelContent
						config={controlConfig.config}
						controlId={controlId}
						testRunning={!!controlConfig.runtime.testRunning}
					/>
				) : (
					<StaticAlert color="danger">
						Invalid control type: {controlConfig.config.type}. Expected 'custom-action'.
					</StaticAlert>
				))}
		</div>
	)
}

interface CustomActionPanelContentProps {
	config: CustomActionModel
	controlId: string
	testRunning: boolean
}

function CustomActionPanelContent({ config, controlId, testRunning }: CustomActionPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId)
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)
	const [activeTab, setActiveTab] = useLocalStorage<'actions' | 'inputs' | 'variables'>(
		'customActionEditor.activeTab',
		'actions'
	)

	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables, null, config.inputs)

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			<div className="px-3 pt-2 shrink-0">
				<CustomActionDetails config={config} controlId={controlId} />
				<div className="flex justify-end">
					<AddNoteButton state={notesState} />
				</div>

				<MyErrorBoundary>
					<NotesStrip key={controlId} state={notesState} />
				</MyErrorBoundary>

				<TabArea.Root variant="pills" value={activeTab} onValueChange={setActiveTab} className="mt-1">
					<TabArea.List>
						<TabArea.Tab value="actions">Actions</TabArea.Tab>
						<TabArea.Tab value="inputs">
							<span>Inputs</span>
							{config.inputs.length > 0 && (
								<span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-primary/20 text-primary">
									{config.inputs.length}
								</span>
							)}
						</TabArea.Tab>
						<TabArea.Tab value="variables">
							<span>Local Variables</span>
							{config.localVariables.length > 0 && (
								<span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-primary/20 text-primary">
									{config.localVariables.length}
								</span>
							)}
						</TabArea.Tab>
					</TabArea.List>
				</TabArea.Root>
			</div>

			<div className="page-scroll p-4 pt-2">
				<div className="max-w-readable">
					{activeTab === 'inputs' && (
						<MyErrorBoundary>
							<CustomActionInputsEditor controlId={controlId} inputs={config.inputs} />
						</MyErrorBoundary>
					)}

					{activeTab === 'variables' && (
						<MyErrorBoundary>
							<LocalVariablesEditor
								description="Each run of the custom action starts with these variables at their startup values. Changes to them only last for that run."
								controlId={controlId}
								location={undefined}
								variables={config.localVariables}
								localVariablesStore={localVariablesStore}
							/>
						</MyErrorBoundary>
					)}

					{activeTab === 'actions' && (
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading="Actions"
								subheading={
									<p className="text-sm text-muted">The actions run in order each time the custom action is called.</p>
								}
								headingActions={[
									<TestRunButton
										key="test-run"
										controlId={controlId}
										name={config.options.name}
										running={testRunning}
									/>,
								]}
								controlId={controlId}
								location={undefined}
								listId="custom_action_actions"
								entities={config.actions}
								entityType={EntityModelType.Action}
								entityTypeLabel="action"
								feedbackListType={null}
								localVariablesStore={localVariablesStore}
								localVariablePrefix={null}
							/>
						</MyErrorBoundary>
					)}
				</div>
			</div>
		</div>
	)
}

function CustomActionDetails({ config, controlId }: { config: CustomActionModel; controlId: string }) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())
	const nameId = useId()
	const descriptionId = useId()

	const setOption = useCallback(
		(key: string, value: JsonValue | undefined) => {
			setOptionsFieldMutation.mutateAsync({ controlId, key, value }).catch((e) => {
				console.error(`Set ${key} failed: ${e}`)
			})
		},
		[setOptionsFieldMutation, controlId]
	)

	const resultVariableNames = useMemo(
		() =>
			config.localVariables.flatMap((entity) =>
				entity.type === EntityModelType.Feedback && entity.variableName ? [entity.variableName] : []
			),
		[config.localVariables]
	)
	const resultField = useMemo(
		(): SomeCompanionInputField => ({
			type: 'dropdown',
			id: 'resultVariable',
			label: 'Result',
			tooltip:
				resultVariableNames.length > 0
					? 'The local variable whose value at the end of a run is the result of the action'
					: 'The result of the action is one of its local variables. Add a local variable to choose one',
			default: '',
			choices: [{ id: '', label: 'None' }, ...resultVariableNames.map((name) => ({ id: name, label: name }))],
		}),
		[resultVariableNames]
	)
	const setResultVariable = useCallback(
		(_key: string, value: ExpressionOrValue<JsonValue | undefined>) =>
			setOption('resultVariable', typeof value.value === 'string' && value.value !== '' ? value.value : null),
		[setOption]
	)

	return (
		<Grid.Row className="sm:gap-2">
			<FormLabel htmlFor={nameId} sm={4} column="sm">
				Name
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={nameId}
					value={config.options.name}
					setValue={(value) => setOption('name', value)}
					placeholder="Custom action name"
				/>
			</Grid.Col>

			<FormLabel htmlFor={descriptionId} sm={4} column="sm">
				Description
			</FormLabel>
			<Grid.Col sm={8}>
				<TextInputFieldSimple
					id={descriptionId}
					value={config.options.description}
					setValue={(value) => setOption('description', value)}
					placeholder="Shown when choosing the action"
				/>
			</Grid.Col>

			<OptionsInputField
				allowInternalFields={false}
				isLocatedInGrid={false}
				entityType={null}
				option={resultField}
				value={{ isExpression: false, value: config.options.resultVariable ?? '' }}
				setValue={setResultVariable}
				visibility={true}
				localVariablesStore={null}
				fieldSupportsExpression={false}
				readonly={resultVariableNames.length === 0}
			/>
		</Grid.Row>
	)
}

function CustomActionInputsEditor({ controlId, inputs }: { controlId: string; inputs: AuthorableInputField[] }) {
	const addMutation = useMutationExt(trpc.controls.customActions.inputAdd.mutationOptions())
	const removeMutation = useMutationExt(trpc.controls.customActions.inputRemove.mutationOptions())
	const moveMutation = useMutationExt(trpc.controls.customActions.inputMove.mutationOptions())
	const updateMutation = useMutationExt(trpc.controls.customActions.inputUpdate.mutationOptions())

	const service = useMemo(
		(): InputFieldDefinitionsService => ({
			addField: (field) => {
				addMutation.mutateAsync({ controlId, field }).catch((e) => console.error('Failed to add input', e))
			},
			removeField: (inputId) => {
				removeMutation.mutateAsync({ controlId, inputId }).catch((e) => console.error('Failed to remove input', e))
			},
			moveField: (inputId, index) => {
				moveMutation.mutateAsync({ controlId, inputId, index }).catch((e) => console.error('Failed to move input', e))
			},
			updateField: (inputId, field) => {
				updateMutation
					.mutateAsync({ controlId, inputId, field })
					.catch((e) => console.error('Failed to update input', e))
			},
		}),
		[addMutation, removeMutation, moveMutation, updateMutation, controlId]
	)

	return (
		<InputFieldDefinitionsEditor
			heading="Inputs"
			subheading={
				<p className="text-sm text-muted">
					The inputs are the options of the action. Their values are available to the actions as{' '}
					<code>$(options:id)</code>.
				</p>
			}
			headingActions={null}
			fields={inputs}
			service={service}
			readonly={false}
			localVariablesStore={null}
			collapseStorageId={`custom_action_inputs_${controlId}`}
		/>
	)
}

function TestRunButton({ controlId, name, running }: { controlId: string; name: string; running: boolean }) {
	const { notifier } = useContext(RootAppStoreContext)
	const testRunMutation = useMutationExt(trpc.controls.customActions.testRun.mutationOptions())

	const doTestRun = useCallback(() => {
		testRunMutation.mutateAsync({ controlId }).catch((err) => {
			notifier.show('Test Failed', `Failed to run "${name}": ${String(err)}`, 4000)
		})
	}, [testRunMutation, controlId, name, notifier])

	return (
		<Button size="sm" onClick={doTestRun} disabled={running} title="Run the actions now, with the default inputs">
			<FontAwesomeIcon icon={faPlay} className="me-1.5 text-2xs" />
			{running ? 'Running…' : 'Test Run'}
		</Button>
	)
}
