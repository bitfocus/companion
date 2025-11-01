import { CAlert, CCol, CForm, CFormLabel } from '@coreui/react'
import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PreventDefaultHandler } from '~/Resources/util'
import { MyErrorBoundary } from '~/Resources/Error'
import { LoadingBar, LoadingRetryOrError } from '~/Resources/Loading'
import { TextInputField } from '~/Components/index.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	isInternalUserValueFeedback,
	type SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ExpressionVariableOptions } from '@companion-app/shared/Model/ExpressionVariableModel.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faDollarSign, faGlobe, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { AddEntityPanel } from '~/Controls/Components/AddEntityPanel.js'
import { PanelCollapseHelperProvider } from '~/Helpers/CollapseHelper.js'
import { EntityEditorContextProvider, useEntityEditorContext } from '~/Controls/Components/EntityEditorContext.js'
import { findAllEntityIdsDeep } from '~/Controls/Util.js'
import { useControlEntitiesEditorService, useControlEntityService } from '~/Services/Controls/ControlEntitiesService.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { RootAppStoreContext } from '~/Stores/RootAppStore'
import { EntityManageChildGroups } from '~/Controls/Components/EntityChildGroup'
import { EntityCommonCells } from '~/Controls/Components/EntityCommonCells'
import { useControlConfig } from '~/Hooks/useControlConfig'
import { trpc, useMutationExt } from '~/Resources/TRPC'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay'
import { useSubscription } from '@trpc/tanstack-react-query'
import { EditableEntityList } from '~/Controls/Components/EntityList'
import { InlineHelp } from '~/Components/InlineHelp'
import { useLocalVariablesStore, type LocalVariablesStore } from '~/Controls/LocalVariablesStore'
import { isLabelValid } from '@companion-app/shared/Label.js'

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
		<div className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					{controlConfig.config.type === 'expression-variable' ? (
						<>
							<MyErrorBoundary>
								<ExpressionVariableConfig options={controlConfig.config.options} controlId={controlId} />
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ExpressionVariableEntityEditor
									controlId={controlId}
									entity={controlConfig.config.entity}
									localVariablesStore={localVariablesStore}
								/>
							</MyErrorBoundary>

							{!!controlConfig.config.entity && !isInternalUserValueFeedback(controlConfig.config.entity) && (
								<MyErrorBoundary>
									<div className="mt-3 pt-3 border-top">
										<ExpressionVariableLocalVariablesEditor
											controlId={controlId}
											localVariables={controlConfig.config.localVariables}
											localVariablesStore={localVariablesStore}
										/>
									</div>
								</MyErrorBoundary>
							)}
						</>
					) : (
						<CAlert color="danger">
							Invalid control type: {controlConfig.config.type}. Expected 'expression-variable'.
						</CAlert>
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

	return (
		<CCol sm={12} className="p-0">
			<CForm onSubmit={PreventDefaultHandler} className="row flex-form">
				<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
					Name
					<InlineHelp help="The name for the variable. It will get wrapped with $(expression:X) for you">
						<FontAwesomeIcon icon={faQuestionCircle} />
					</InlineHelp>
				</CFormLabel>
				<CCol xs={8}>
					<TextInputField setValue={setName} value={options.variableName} checkValid={isLabelValid} />
				</CCol>

				<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Description</CFormLabel>
				<CCol xs={8}>
					<TextInputField setValue={setDescription} value={options.description} />
				</CCol>
			</CForm>
		</CCol>
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
			>
				<PanelCollapseHelperProvider storageId={`feedbacks_${controlId}_entities`} knownPanelIds={entityIds}>
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
			<CCol sm={12} className="p-0">
				<CForm onSubmit={PreventDefaultHandler} className="row flex-form">
					<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Current Value</CFormLabel>
					<CCol xs={8}>
						{expressionVariableDefinition?.isActive ? (
							<ExpressionVariableCurrentValue controlId={controlId} name={expressionVariableDefinition.variableName} />
						) : (
							<small>Variable is not active (the name is either empty or in use elsewhere)</small>
						)}
					</CCol>
				</CForm>
			</CCol>

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
			>
				<PanelCollapseHelperProvider storageId={`localVariables_${controlId}_entities`} knownPanelIds={entityIds}>
					<GenericConfirmModal ref={confirmModal} />

					<EditableEntityList
						heading={
							<InlineHelp help="You can use local variables inside of this expression variable to create some dynamic values based on feedbacks">
								Local Variables
							</InlineHelp>
						}
						subheading={
							<CAlert color="info" className="mb-2">
								Local variables are not yet supported by all modules or fields. Fields which support local variables can
								be identified by the <FontAwesomeIcon icon={faGlobe} /> icon.
							</CAlert>
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

function ExpressionVariableCurrentValue({ name }: { controlId: string; name: string }) {
	const { notifier } = useContext(RootAppStoreContext)

	const onCopied = useCallback(() => notifier.show(`Copied`, 'Copied to clipboard', 3000), [notifier])

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

	if (!sub.data) {
		return <LoadingBar />
	}

	if (!sub.data.ok) {
		return <CAlert color="danger">Error: {sub.data.error}</CAlert>
	}

	return <VariableValueDisplay value={sub.data.value} onCopied={onCopied} />
}
