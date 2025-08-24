import { CAlert, CCol, CForm, CFormLabel } from '@coreui/react'
import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PreventDefaultHandler } from '~/Resources/util'
import { MyErrorBoundary } from '~/Resources/Error'
import { LoadingBar, LoadingRetryOrError } from '~/Resources/Loading'
import { TextInputField } from '~/Components/index.js'
import {
	EntityModelType,
	FeedbackEntitySubType,
	isInternalUserValueFeedback,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import type { ComputedVariableOptions } from '@companion-app/shared/Model/ComputedVariableModel.js'
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
import { LocalVariablesStore, useLocalVariablesStore } from '~/Controls/LocalVariablesStore'
import { isLabelValid } from '@companion-app/shared/Label.js'

interface EditComputedVariablePanelProps {
	controlId: string
}

export function EditComputedVariablePanel({ controlId }: EditComputedVariablePanelProps): React.JSX.Element {
	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const { controlConfig, error: configError, reloadConfig } = useControlConfig(controlId)

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const dataReady = !loadError && !!controlConfig

	const localVariablesStore = useLocalVariablesStore(
		controlId,
		controlConfig?.config?.type === 'computed-variable' ? controlConfig.config.localVariables : null
	)

	return (
		<div className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					{controlConfig.config.type === 'computed-variable' ? (
						<>
							<MyErrorBoundary>
								<ComputedVariableConfig options={controlConfig.config.options} controlId={controlId} />
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ComputedVariableEntityEditor
									controlId={controlId}
									entity={controlConfig.config.entity}
									localVariablesStore={localVariablesStore}
								/>
							</MyErrorBoundary>

							{!!controlConfig.config.entity && !isInternalUserValueFeedback(controlConfig.config.entity) && (
								<MyErrorBoundary>
									<div className="mt-3 pt-3 border-top">
										<ComputedVariableLocalVariablesEditor
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
							Invalid control type: {controlConfig.config.type}. Expected 'computed-variable'.
						</CAlert>
					)}
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface ComputedVariableConfigProps {
	controlId: string
	options: ComputedVariableOptions
}

function ComputedVariableConfig({ controlId, options }: ComputedVariableConfigProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: keyof ComputedVariableOptions, value: any) => {
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
					<FontAwesomeIcon
						icon={faQuestionCircle}
						title="The name for the variable. It will get wrapped with $(computed:X) for you"
					/>
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

interface ComputedVariableEntityEditorProps {
	controlId: string
	entity: SomeEntityModel | null
	localVariablesStore: LocalVariablesStore
}

const ComputedVariableEntityEditor = observer(function ComputedVariableEntityEditor({
	controlId,
	entity,
	localVariablesStore,
}: ComputedVariableEntityEditorProps) {
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
						<ComputedVariableAddRootEntity />
					) : (
						<ComputedVariableSoleEntityEditor controlId={controlId} entity={entity} />
					)}
				</PanelCollapseHelperProvider>
			</EntityEditorContextProvider>
		</>
	)
})

const ComputedVariableAddRootEntity = observer(function ComputedVariableAddRootEntity() {
	return (
		<>
			<NonIdealState text="Choose the root type of the computed variable below to begin" icon={faDollarSign} />
			<AddEntityPanel
				ownerId={null}
				entityType={EntityModelType.Feedback}
				feedbackListType={FeedbackEntitySubType.Value}
				entityTypeLabel="definition"
			/>
		</>
	)
})

interface ComputedVariableSoleEntityEditorProps {
	controlId: string
	entity: SomeEntityModel
}

const ComputedVariableSoleEntityEditor = observer(function ComputedVariableSoleEntityEditor({
	controlId,
	entity,
}: ComputedVariableSoleEntityEditorProps) {
	const { entityDefinitions, computedVariablesList } = useContext(RootAppStoreContext)

	const computedVariableDefinition = computedVariablesList.computedVariables.get(controlId)

	const { serviceFactory } = useEntityEditorContext()
	const entityService = useControlEntityService(serviceFactory, entity, 'variable')

	const entityDefinition = entityDefinitions.getEntityDefinition(entity.type, entity.connectionId, entity.definitionId)

	return (
		<>
			<CCol sm={12} className="p-0">
				<CForm onSubmit={PreventDefaultHandler} className="row flex-form">
					<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Current Value</CFormLabel>
					<CCol xs={8}>
						{computedVariableDefinition?.isActive ? (
							<ComputedVariableCurrentValue controlId={controlId} name={computedVariableDefinition.variableName} />
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

interface ComputedVariableLocalVariablesEditorProps {
	controlId: string
	localVariables: SomeEntityModel[]
	localVariablesStore: LocalVariablesStore
}

const ComputedVariableLocalVariablesEditor = observer(function ComputedVariableLocalVariablesEditor({
	controlId,
	localVariables,
	localVariablesStore,
}: ComputedVariableLocalVariablesEditorProps) {
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
							<InlineHelp help="You can use local variables inside of this computed variable to create some dynamic values based on feedbacks">
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

function ComputedVariableCurrentValue({ name }: { controlId: string; name: string }) {
	const { notifier } = useContext(RootAppStoreContext)

	const onCopied = useCallback(() => notifier.current?.show(`Copied`, 'Copied to clipboard', 3000), [notifier])

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: null,
				expression: `$(computed:${name})`,
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
