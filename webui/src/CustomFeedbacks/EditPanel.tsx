import { useCallback, useId, useMemo } from 'react'
import type { CustomFeedbackControlId } from '@companion-app/shared/ControlId.js'
import type { CustomFeedbackModel, CustomFeedbackOptions } from '@companion-app/shared/Model/CustomFeedbackModel.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { toCompanionInputField } from '@companion-app/shared/Model/Options.js'
import { stringifyError } from '@companion-app/shared/Stringify.js'
import { FormLabel } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid.js'
import type { InputFieldDefinitionsService } from '~/Components/InputFieldDefinitionsEditor/InputFieldDefinitionsEditor.js'
import { TabArea } from '~/Components/TabArea.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import { BuildingBlockInputsEditor } from '~/Controls/BuildingBlockInputsEditor.js'
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
import type { CustomFeedbackEditTab } from './customFeedbackEditTabs.js'
import { CustomFeedbackUsesEditor } from './UsesEditor.js'

interface EditCustomFeedbackPanelProps {
	controlId: CustomFeedbackControlId
	activeTab: CustomFeedbackEditTab
	setActiveTab: (tab: CustomFeedbackEditTab) => void
}

export function EditCustomFeedbackPanel({
	controlId,
	activeTab,
	setActiveTab,
}: EditCustomFeedbackPanelProps): React.JSX.Element {
	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const loadError = configError ?? null
	const dataReady = !loadError && !!controlConfig

	return (
		<div className="flex flex-col flex-1 min-h-0 overflow-hidden">
			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig && (
				<CustomFeedbackPanelContent
					config={controlConfig.config}
					controlId={controlId}
					activeTab={activeTab}
					setActiveTab={setActiveTab}
				/>
			)}
		</div>
	)
}

interface CustomFeedbackPanelContentProps {
	config: CustomFeedbackModel
	controlId: CustomFeedbackControlId
	activeTab: CustomFeedbackEditTab
	setActiveTab: (tab: CustomFeedbackEditTab) => void
}

function CustomFeedbackPanelContent({
	config,
	controlId,
	activeTab,
	setActiveTab,
}: CustomFeedbackPanelContentProps): React.ReactNode {
	const setControlNotes = useControlNotesSetter(controlId, 'custom-feedback')
	const notesState = useNotesEditor(controlId, config.options.notes, setControlNotes)

	const inputFields = useMemo(() => config.inputs.map(toCompanionInputField), [config.inputs])
	const inputAddMutation = useMutationExt(trpc.controls.customFeedbacks.inputs.add.mutationOptions())
	const inputRemoveMutation = useMutationExt(trpc.controls.customFeedbacks.inputs.remove.mutationOptions())
	const inputMoveMutation = useMutationExt(trpc.controls.customFeedbacks.inputs.move.mutationOptions())
	const inputUpdateMutation = useMutationExt(trpc.controls.customFeedbacks.inputs.update.mutationOptions())
	const inputsService = useMemo(
		(): InputFieldDefinitionsService => ({
			addField: (field) => {
				inputAddMutation.mutateAsync({ controlId, field }).catch((e) => console.error('Failed to add input', e))
			},
			removeField: (inputId) => {
				inputRemoveMutation.mutateAsync({ controlId, inputId }).catch((e) => console.error('Failed to remove input', e))
			},
			moveField: (inputId, index) => {
				inputMoveMutation
					.mutateAsync({ controlId, inputId, index })
					.catch((e) => console.error('Failed to move input', e))
			},
			updateField: (inputId, field) => {
				inputUpdateMutation
					.mutateAsync({ controlId, inputId, field })
					.catch((e) => console.error('Failed to update input', e))
			},
		}),
		[inputAddMutation, inputRemoveMutation, inputMoveMutation, inputUpdateMutation, controlId]
	)
	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables, null, inputFields)

	return (
		<div className="flex-1 min-h-0 flex flex-col overflow-hidden">
			<div className="px-3 pt-2 shrink-0">
				<CustomFeedbackDetails config={config} controlId={controlId} />
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
						<TabArea.Tab value="uses">Uses</TabArea.Tab>
					</TabArea.List>
				</TabArea.Root>
			</div>

			<div className="page-scroll p-4 pt-0">
				<div className="max-w-readable">
					{activeTab === 'inputs' && (
						<MyErrorBoundary>
							<BuildingBlockInputsEditor
								service={inputsService}
								inputs={config.inputs}
								usedAs="feedback"
								collapseStorageId={`custom_feedback_inputs_${controlId}`}
							/>
						</MyErrorBoundary>
					)}

					{activeTab === 'uses' && (
						<MyErrorBoundary>
							<CustomFeedbackUsesEditor controlId={controlId} />
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

function CustomFeedbackDetails({
	config,
	controlId,
}: {
	config: CustomFeedbackModel
	controlId: CustomFeedbackControlId
}) {
	const setOptionInner = useControlOptionsSetter(controlId, 'custom-feedback')
	const nameId = useId()
	const descriptionId = useId()

	const setOption = useCallback(
		<K extends keyof CustomFeedbackOptions>(key: K, value: CustomFeedbackOptions[K]) => {
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
					placeholder="Custom feedback name"
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
					placeholder="Shown when choosing the feedback"
				/>
			</Grid.Col>
		</Grid.Row>
	)
}
