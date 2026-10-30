import { useMemo } from 'react'
import type { CustomFeedbackModel } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { toCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { StaticAlert } from '~/Components/Alert.js'
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

interface EditCustomFeedbackPanelProps {
	controlId: string
}

export function EditCustomFeedbackPanel({ controlId }: EditCustomFeedbackPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const loadError = configError ?? null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig &&
				(controlConfig.config.type === 'custom-feedback' ? (
					<CustomFeedbackPanelContent config={controlConfig.config} controlId={controlId} />
				) : (
					<StaticAlert color="danger">
						Invalid control type: {controlConfig.config.type}. Expected 'custom-feedback'.
					</StaticAlert>
				))}
		</div>
	)
}

interface CustomFeedbackPanelContentProps {
	config: CustomFeedbackModel
	controlId: string
}

function CustomFeedbackPanelContent({ config, controlId }: CustomFeedbackPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId)
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)
	const [activeTab, setActiveTab] = useLocalStorage<'feedbacks' | 'inputs' | 'variables'>(
		'customFeedbackEditor.activeTab',
		'feedbacks'
	)

	const inputFields = useMemo(() => config.inputs.map(toCompanionInputField), [config.inputs])
	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables, null, inputFields)

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			<div className="px-3 pt-2 shrink-0">
				<CustomEntityDetails
					controlId={controlId}
					name={config.options.name}
					description={config.options.description}
					namePlaceholder="Custom feedback name"
					descriptionPlaceholder="Shown when choosing the feedback"
				/>
				<div className="flex justify-end">
					<AddNoteButton state={notesState} />
				</div>

				<MyErrorBoundary>
					<NotesStrip key={controlId} state={notesState} />
				</MyErrorBoundary>

				<TabArea.Root variant="pills" value={activeTab} onValueChange={setActiveTab} className="mt-1">
					<TabArea.List>
						<TabArea.Tab value="feedbacks">Feedbacks</TabArea.Tab>
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

			<div className="page-scroll p-4 pt-0">
				<div className="max-w-readable">
					{activeTab === 'inputs' && (
						<MyErrorBoundary>
							<CustomEntityInputsEditor
								controlId={controlId}
								kind="customFeedbacks"
								inputs={config.inputs}
								subheading={
									<p className="text-sm text-muted">
										The inputs are the options of the feedback. Their values are available to the feedbacks as{' '}
										<code>$(options:id)</code>.
									</p>
								}
							/>
						</MyErrorBoundary>
					)}

					{activeTab === 'variables' && (
						<MyErrorBoundary>
							<LocalVariablesEditor
								description="Each use of the custom feedback has its own copy of these variables, which see the inputs it is given."
								controlId={controlId}
								location={undefined}
								variables={config.localVariables}
								localVariablesStore={localVariablesStore}
							/>
						</MyErrorBoundary>
					)}

					{activeTab === 'feedbacks' && (
						<MyErrorBoundary>
							<ControlEntitiesEditor
								heading="Feedbacks"
								subheading={
									<p className="text-sm text-muted">
										The custom feedback is true when all of these feedbacks are true.
									</p>
								}
								headingActions={[]}
								controlId={controlId}
								location={undefined}
								listId="feedbacks"
								entities={config.feedbacks}
								entityType={EntityModelType.Feedback}
								entityTypeLabel="feedback"
								feedbackListType={FeedbackEntitySubType.Boolean}
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
