import { faPlay } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useCallback, useContext, useMemo } from 'react'
import type { CustomActionModel } from '@companion-app/shared/Model/CustomActionModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { toCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { StaticAlert } from '~/Components/Alert.js'
import { Button } from '~/Components/Button.js'
import { TabArea } from '~/Components/TabArea.js'
import { CustomEntityDetails } from '~/Controls/CustomEntityDetails.js'
import { CustomEntityInputsEditor } from '~/Controls/CustomEntityInputsEditor.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { useLocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { AddNoteButton, NotesStrip } from '~/Controls/Notes.js'
import { useControlNotesSetter, useNotesEditor } from '~/Controls/useNotesEditor.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import { useLocalStorage } from '~/Hooks/useLocalStorage.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { CustomActionOutputsEditor } from './OutputsEditor.js'

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
	const [activeTab, setActiveTab] = useLocalStorage<'actions' | 'inputs' | 'outputs' | 'variables'>(
		'customActionEditor.activeTab',
		'actions'
	)

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
				<CustomEntityDetails
					controlId={controlId}
					name={config.options.name}
					description={config.options.description}
					namePlaceholder="Custom action name"
					descriptionPlaceholder="Shown when choosing the action"
				/>
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
					</TabArea.List>
				</TabArea.Root>
			</div>

			<div className="page-scroll p-4 pt-0">
				<div className="max-w-readable">
					{activeTab === 'inputs' && (
						<MyErrorBoundary>
							<CustomEntityInputsEditor
								controlId={controlId}
								kind="customActions"
								inputs={config.inputs}
								subheading={
									<p className="text-sm text-muted">
										The inputs are the options of the action. Their values are available to the actions as{' '}
										<code>$(options:id)</code>.
									</p>
								}
							/>
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
