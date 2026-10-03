import { faDollarSign, faGlobe } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useSubscription } from '@trpc/tanstack-react-query'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useId, useMemo, useRef } from 'react'
import type { JsonValue } from 'type-fest'
import { isLabelValid } from '@companion-app/shared/Label.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	isInternalUserValueFeedback,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionVariableOptions } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { StaticAlert } from '~/Components/Alert'
import { EditSectionCard } from '~/Components/EditSectionCard.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { InlineHelpIcon } from '~/Components/InlineHelp'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { TextInputFieldSimple } from '~/Components/TextInputField'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay'
import { AddEntityPanel } from '~/Controls/Components/AddEntityPanel.js'
import { EntityManageChildGroups } from '~/Controls/Components/EntityChildGroup'
import { EntityCommonCells } from '~/Controls/Components/EntityCommonCells'
import { EntityEditorContextProvider, useEntityEditorContext } from '~/Controls/Components/EntityEditorContext.js'
import { EditableEntityList } from '~/Controls/Components/EntityList'
import { useEntityListReorderMonitor } from '~/Controls/Components/useEntityListReorderMonitor.js'
import { ControlNotesEditor } from '~/Controls/ControlNotesEditor.js'
import {
	EntityListActionContext,
	useLocalVariablesStore,
	type LocalVariablesStore,
} from '~/Controls/LocalVariablesStore'
import { findAllEntityIdsDeep } from '~/Controls/Util.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { useControlConfig } from '~/Hooks/useControlConfig'
import { MyErrorBoundary } from '~/Resources/Error'
import { LoadingBar, LoadingRetryOrError } from '~/Resources/Loading'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { useControlEntitiesEditorService, useControlEntityService } from '~/Services/Controls/ControlEntitiesService.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore'

interface EditExpressionVariablePanelProps {
	controlId: string
}

export function EditExpressionVariablePanel({ controlId }: EditExpressionVariablePanelProps): React.JSX.Element {
	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!controlConfig

	const localVariablesStore = useLocalVariablesStore(
		controlId,
		controlConfig?.config?.type === 'expression-variable' ? controlConfig.config.localVariables : null
	)

	return (
		<div className="edit-panel">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig ? (
				<div className={classNames({ hidden: !dataReady })}>
					{controlConfig.config.type === 'expression-variable' ? (
						<>
							<MyErrorBoundary>
								<ExpressionVariableConfig options={controlConfig.config.options} controlId={controlId} />
							</MyErrorBoundary>

							<EditSectionCard title="Value">
								{/* The entity editor's styles are scoped to these classes, so they wrap just the editor */}
								<div className="edit-button-panel flex-form">
									<MyErrorBoundary>
										<ExpressionVariableEntityEditor
											controlId={controlId}
											entity={controlConfig.config.entity}
											localVariablesStore={localVariablesStore}
										/>
									</MyErrorBoundary>
								</div>
							</EditSectionCard>

							{!!controlConfig.config.entity && !isInternalUserValueFeedback(controlConfig.config.entity) && (
								// The entity list draws its own heading (with help), so this is a bare section rather than a card
								<section className="edit-section">
									<div className="edit-button-panel flex-form">
										<MyErrorBoundary>
											<ExpressionVariableLocalVariablesEditor
												controlId={controlId}
												localVariables={controlConfig.config.localVariables}
												localVariablesStore={localVariablesStore}
											/>
										</MyErrorBoundary>
									</div>
								</section>
							)}
						</>
					) : (
						<StaticAlert color="danger">
							Invalid control type: {controlConfig.config.type}. Expected 'expression-variable'.
						</StaticAlert>
					)}
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface ExpressionVariableConfigProps {
	controlId: string
	options: ExpressionVariableOptions
}

function ExpressionVariableConfig({ controlId, options }: ExpressionVariableConfigProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: keyof ExpressionVariableOptions, value: any) => {
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

	const setName = useCallback((val: string) => setValueInner('variableName', val), [setValueInner])
	const setDescription = useCallback((val: string) => setValueInner('description', val), [setValueInner])

	const nameFieldId = useId()
	const descriptionFieldId = useId()
	const notesFieldId = useId()

	return (
		<EditSectionCard title="General Settings">
			<div className="edit-field-row">
				<label htmlFor={nameFieldId} className="text-xs font-semibold text-body">
					Name
					<InlineHelpIcon className="ms-1">
						The name for the variable. It will get wrapped with <code>$(expression:X)</code> for you
					</InlineHelpIcon>
				</label>
				<TextInputFieldSimple
					id={nameFieldId}
					setValue={setName}
					value={options.variableName}
					checkValid={isLabelValid}
				/>
			</div>
			<div className="edit-field-row">
				<label htmlFor={descriptionFieldId} className="text-xs font-semibold text-body">
					Description
				</label>
				<TextInputFieldSimple id={descriptionFieldId} setValue={setDescription} value={options.description} />
			</div>
			<div className="edit-field-row">
				<label htmlFor={notesFieldId} className="text-xs font-semibold text-body">
					Notes
				</label>
				<ControlNotesEditor id={notesFieldId} controlId={controlId} notes={options.notes} />
			</div>
		</EditSectionCard>
	)
}

interface ExpressionVariableEntityEditorProps {
	controlId: string
	entity: SomeEntityModel | null
	localVariablesStore: LocalVariablesStore
}

const ExpressionVariableEntityEditor = observer(function ExpressionVariableEntityEditor({
	controlId,
	entity,
	localVariablesStore,
}: ExpressionVariableEntityEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const serviceFactory = useControlEntitiesEditorService(controlId, 'feedbacks', confirmModal)
	useEntityListReorderMonitor(controlId, EntityModelType.Feedback, serviceFactory)

	const entityIds = useMemo(() => findAllEntityIdsDeep(entity ? [entity] : []), [entity])

	return (
		<>
			<EntityEditorContextProvider
				controlId={controlId}
				location={undefined}
				serviceFactory={serviceFactory}
				readonly={false}
				localVariablesStore={localVariablesStore}
				localVariablePrefix={null}
				previewStatusOnly
				actionContext={EntityListActionContext.NotActions}
			>
				<PanelCollapseHelperProvider
					storageId={`feedbacks_${controlId}_entities`}
					knownPanelIds={entityIds}
					evictionOwner={{ kind: 'control', id: controlId }}
				>
					<GenericConfirmModal ref={confirmModal} />

					{!entity ? (
						<ExpressionVariableAddRootEntity />
					) : (
						<ExpressionVariableSoleEntityEditor controlId={controlId} entity={entity} />
					)}
				</PanelCollapseHelperProvider>
			</EntityEditorContextProvider>
		</>
	)
})

const ExpressionVariableAddRootEntity = observer(function ExpressionVariableAddRootEntity() {
	return (
		<>
			<NonIdealState text="Choose the root type of the expression variable below to begin" icon={faDollarSign} />
			<AddEntityPanel
				ownerId={null}
				entityType={EntityModelType.Feedback}
				feedbackListType={FeedbackEntitySubType.Value}
				entityTypeLabel="definition"
			/>
		</>
	)
})

interface ExpressionVariableSoleEntityEditorProps {
	controlId: string
	entity: SomeEntityModel
}

const ExpressionVariableSoleEntityEditor = observer(function ExpressionVariableSoleEntityEditor({
	controlId,
	entity,
}: ExpressionVariableSoleEntityEditorProps) {
	const { entityDefinitions, expressionVariablesList } = useContext(RootAppStoreContext)

	const expressionVariableDefinition = expressionVariablesList.expressionVariables.get(controlId)

	const { serviceFactory } = useEntityEditorContext()
	const entityService = useControlEntityService(serviceFactory, entity, 'variable')

	const entityDefinition = entityDefinitions.getEntityDefinition(entity.type, entity.connectionId, entity.definitionId)

	return (
		<>
			<div className="edit-field-row">
				<span className="text-xs font-semibold text-body">Current value</span>
				<div className="text-xs text-body min-w-0">
					{expressionVariableDefinition?.isActive ? (
						<ExpressionVariableCurrentValue name={expressionVariableDefinition.variableName} />
					) : (
						<span className="text-muted">Variable is not active (the name is either empty or in use elsewhere)</span>
					)}
				</div>
			</div>

			<div className="editor-grid">
				<EntityCommonCells
					entity={entity}
					entityTypeLabel="variable"
					feedbackListType={FeedbackEntitySubType.Value}
					entityDefinition={entityDefinition}
					service={entityService}
				/>

				<EntityManageChildGroups entity={entity} entityDefinition={entityDefinition} />
			</div>
		</>
	)
})

interface ExpressionVariableLocalVariablesEditorProps {
	controlId: string
	localVariables: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
}

const ExpressionVariableLocalVariablesEditor = observer(function ExpressionVariableLocalVariablesEditor({
	controlId,
	localVariables,
	localVariablesStore,
}: ExpressionVariableLocalVariablesEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const serviceFactory = useControlEntitiesEditorService(controlId, 'local-variables', confirmModal)
	useEntityListReorderMonitor(controlId, EntityModelType.Feedback, serviceFactory)

	const entityIds = useMemo(() => findAllEntityIdsDeep(localVariables), [localVariables])

	return (
		<>
			<EntityEditorContextProvider
				controlId={controlId}
				location={undefined}
				serviceFactory={serviceFactory}
				readonly={false}
				localVariablesStore={localVariablesStore}
				localVariablePrefix="local"
				actionContext={EntityListActionContext.NotActions}
			>
				<PanelCollapseHelperProvider
					storageId={`localVariables_${controlId}_entities`}
					knownPanelIds={entityIds}
					evictionOwner={{ kind: 'control', id: controlId }}
				>
					<GenericConfirmModal ref={confirmModal} />

					<EditableEntityList
						heading={
							<>
								Local Variables
								<InlineHelpIcon className="ms-1">
									You can use local variables inside of this expression variable to create some dynamic values based on
									feedbacks
								</InlineHelpIcon>
							</>
						}
						subheading={
							<span className="text-xs text-muted">
								Local variables are supported on fields featuring the{' '}
								<FontAwesomeIcon icon={faGlobe} className="mx-0.5" /> icon.
							</span>
						}
						entities={localVariables}
						ownerId={null}
						entityType={EntityModelType.Feedback}
						entityTypeLabel={'variable'}
						feedbackListType={FeedbackEntitySubType.Value}
					/>
				</PanelCollapseHelperProvider>
			</EntityEditorContextProvider>
		</>
	)
})

function ExpressionVariableCurrentValue({ name }: { name: string }) {
	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: null,
				expression: `$(expression:${name})`,
				isVariableString: false,
			},
			{}
		)
	)

	// Retain the last successfully-computed value, so the row keeps showing it while a transient
	// expression error is reported inline at the field instead of being duplicated here.
	const lastGoodValue = useRef<JsonValue | undefined>(undefined)
	const hasLastGoodValue = useRef(false)
	if (sub.data?.ok) {
		lastGoodValue.current = sub.data.value
		hasLastGoodValue.current = true
	}

	if (!sub.data && !hasLastGoodValue.current) {
		return <LoadingBar />
	}

	if (!hasLastGoodValue.current) {
		// Errored before ever producing a value - the error itself is shown at the field
		return <small className="text-muted">No value</small>
	}

	return <VariableValueDisplay value={lastGoodValue.current} />
}
