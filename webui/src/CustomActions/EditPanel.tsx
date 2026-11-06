import { faPlay, faStop } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useContext, useId, useMemo } from 'react'
import type { CustomActionControlId } from '@companion-app/shared/ControlId.js'
import type { CustomActionModel, CustomActionOptions } from '@companion-app/shared/Model/CustomActionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { toCompanionInputField, type AuthorableInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
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
import { useControlOptionsSetter } from '~/Controls/useControlOptionsSetter.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import type { CustomActionEditTab } from './customActionEditTabs.js'
import { CustomActionOutputsEditor } from './OutputsEditor.js'
import { CustomActionUsesEditor } from './UsesEditor.js'

interface EditCustomActionPanelProps {
	controlId: CustomActionControlId
	activeTab: CustomActionEditTab
	setActiveTab: (tab: CustomActionEditTab) => void
}

export function EditCustomActionPanel({
	controlId,
	activeTab,
	setActiveTab,
}: EditCustomActionPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const loadError = configError ?? null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig && (
				<CustomActionPanelContent
					config={controlConfig.config}
					controlId={controlId}
					testRunning={controlConfig.runtime.testRunning}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			)}
		</div>
	)
}

interface CustomActionPanelContentProps {
	config: CustomActionModel
	controlId: CustomActionControlId
	testRunning: boolean
	activeTab: CustomActionEditTab
	setActiveTab: (tab: CustomActionEditTab) => void
}

function CustomActionPanelContent({
	config,
	controlId,
	testRunning,
	activeTab,
	setActiveTab,
}: CustomActionPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId, 'custom-action')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	const inputFields = useMemo(() => config.inputs.map(toCompanionInputField), [config.inputs])
	const localVariableNames = useMemo(
		() =>
			config.localVariables.flatMap((entity) =>
				entity.type === EntityModelType.Feedback && entity.variableName ? [entity.variableName] : []
			),
		[config.localVariables]
	)
	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables, null, inputFields)

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
						<TabArea.Tab value="outputs">
							<span>Outputs</span>
							{config.outputs.length > 0 && (
								<span className="px-1.5 py-0.5 rounded-full text-3xs font-semibold bg-primary/20 text-primary">
									{config.outputs.length}
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
						<TabArea.Tab value="uses">Uses</TabArea.Tab>
					</TabArea.List>
				</TabArea.Root>
			</div>

			<div className="page-scroll p-4 pt-0">
				<div className="max-w-readable">
					{activeTab === 'inputs' && (
						<MyErrorBoundary>
							<CustomActionInputsEditor controlId={controlId} inputs={config.inputs} />
						</MyErrorBoundary>
					)}

					{activeTab === 'outputs' && (
						<MyErrorBoundary>
							<CustomActionOutputsEditor
								controlId={controlId}
								outputs={config.outputs}
								variableNames={localVariableNames}
							/>
						</MyErrorBoundary>
					)}

					{activeTab === 'uses' && (
						<MyErrorBoundary>
							<CustomActionUsesEditor controlId={controlId} testRunning={testRunning} />
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

function CustomActionDetails({ config, controlId }: { config: CustomActionModel; controlId: CustomActionControlId }) {
	const setOptionInner = useControlOptionsSetter(controlId, 'custom-action')
	const nameId = useId()
	const descriptionId = useId()

	const setOption = useCallback(
		<K extends keyof CustomActionOptions>(key: K, value: CustomActionOptions[K]) => {
			setOptionInner(key, value).catch((e) => {
				console.error(`Set ${key} failed: ${stringifyError(e)}`)
			})
		},
		[setOptionInner]
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
		</Grid.Row>
	)
}

function CustomActionInputsEditor({
	controlId,
	inputs,
}: {
	controlId: CustomActionControlId
	inputs: AuthorableInputField[]
}) {
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

function TestRunButton({
	controlId,
	name,
	running,
}: {
	controlId: CustomActionControlId
	name: string
	running: boolean
}) {
	const { notifier } = useContext(RootAppStoreContext)
	const testRunMutation = useMutationExt(trpc.controls.customActions.testRun.mutationOptions())
	const abortMutation = useMutationExt(trpc.controls.customActions.abortTestRun.mutationOptions())

	const doTestRun = useCallback(() => {
		testRunMutation.mutateAsync({ controlId }).catch((err) => {
			notifier.show('Test Failed', `Failed to run "${name}": ${String(err)}`, 4000)
		})
	}, [testRunMutation, controlId, name, notifier])

	const doAbort = useCallback(() => {
		abortMutation.mutateAsync({ controlId }).catch((err) => {
			notifier.show('Abort Failed', `Failed to abort "${name}": ${String(err)}`, 4000)
		})
	}, [abortMutation, controlId, name, notifier])

	return running ? (
		<Button size="sm" color="danger" onClick={doAbort} title="Stop the test run">
			<FontAwesomeIcon icon={faStop} className="me-1.5 text-2xs" />
			Abort Test Run
		</Button>
	) : (
		<Button size="sm" onClick={doTestRun} title="Run the actions now, with the default inputs">
			<FontAwesomeIcon icon={faPlay} className="me-1.5 text-2xs" />
			Test Run
		</Button>
	)
}
