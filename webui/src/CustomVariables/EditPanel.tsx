import { CAlert, CCol, CForm, CFormLabel } from '@coreui/react'
import React, { useCallback, useContext, useMemo, useRef } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { LoadingBar, LoadingRetryOrError, MyErrorBoundary, PreventDefaultHandler } from '~/util.js'
import { TextInputField } from '~/Components/index.js'
import { EntityModelType, FeedbackEntitySubType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { CustomVariableOptions } from '@companion-app/shared/Model/CustomVariableModel.js'
import { observer } from 'mobx-react-lite'
import { NonIdealState } from '~/Components/NonIdealState.js'
import { faDollarSign, faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
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
import { trpc, useMutationExt } from '~/TRPC'
import { VariableValueDisplay } from '~/Components/VariableValueDisplay'
import { useSubscription } from '@trpc/tanstack-react-query'

interface EditCustomVariablePanelProps {
	controlId: string
}

export function EditCustomVariablePanel({ controlId }: EditCustomVariablePanelProps): React.JSX.Element {
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
					{controlConfig.config.type === 'custom-variable' ? (
						<>
							<MyErrorBoundary>
								<CustomVariableConfig options={controlConfig.config.options} controlId={controlId} />
							</MyErrorBoundary>

							<MyErrorBoundary>
								<CustomVariableEntityEditor controlId={controlId} entity={controlConfig.config.entity} />
							</MyErrorBoundary>
						</>
					) : (
						<CAlert color="danger">
							Invalid control type: {controlConfig.config.type}. Expected 'custom-variable'.
						</CAlert>
					)}
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface CustomVariableConfigProps {
	controlId: string
	options: CustomVariableOptions
}

function CustomVariableConfig({ controlId, options }: CustomVariableConfigProps) {
	const { customVariablesList } = useContext(RootAppStoreContext)

	const customVariableDefinition = customVariablesList.customVariables.get(controlId)

	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: keyof CustomVariableOptions, value: any) => {
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
						title="The name for the variable. It will get wrapped with $(custom:X) for you"
					/>
				</CFormLabel>
				<CCol xs={8}>
					<TextInputField setValue={setName} value={options.variableName} />
				</CCol>

				<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Description</CFormLabel>
				<CCol xs={8}>
					<TextInputField setValue={setDescription} value={options.description} />
				</CCol>

				<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">Current Value</CFormLabel>
				<CCol xs={8}>
					{customVariableDefinition?.isActive ? (
						<CustomVariableCurrentValue name={options.variableName} />
					) : (
						<small>Variable is not active (the name is either empty or in use elsewhere)</small>
					)}
				</CCol>
			</CForm>
		</CCol>
	)
}

interface CustomVariableEntityEditorProps {
	controlId: string
	entity: SomeEntityModel | null
}

const CustomVariableEntityEditor = observer(function CustomVariableEntityEditor({
	controlId,
	entity,
}: CustomVariableEntityEditorProps) {
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
				localVariablesStore={null}
				localVariablePrefix={null}
			>
				<PanelCollapseHelperProvider storageId={`feedbacks_${controlId}_entities`} knownPanelIds={entityIds}>
					<GenericConfirmModal ref={confirmModal} />

					{!entity ? <CustomVariableAddRootEntity /> : <CustomVariableSoleEntityEditor entity={entity} />}
				</PanelCollapseHelperProvider>
			</EntityEditorContextProvider>
		</>
	)
})

const CustomVariableAddRootEntity = observer(function CustomVariableAddRootEntity() {
	return (
		<>
			<NonIdealState text="Choose the root type of the custom variable below to begin" icon={faDollarSign} />
			<AddEntityPanel
				ownerId={null}
				entityType={EntityModelType.Feedback}
				feedbackListType={FeedbackEntitySubType.Value}
				entityTypeLabel="definition"
			/>
		</>
	)
})

interface CustomVariableSoleEntityEditorProps {
	entity: SomeEntityModel
}

const CustomVariableSoleEntityEditor = observer(function CustomVariableSoleEntityEditor({
	entity,
}: CustomVariableSoleEntityEditorProps) {
	const { connections, entityDefinitions } = useContext(RootAppStoreContext)

	const { serviceFactory } = useEntityEditorContext()
	const entityService = useControlEntityService(serviceFactory, entity, 'variable')

	const connectionInfo = connections.getInfo(entity.connectionId)
	const connectionLabel = connectionInfo?.label ?? entity.connectionId

	const entityDefinition = entityDefinitions.getEntityDefinition(entity.type, entity.connectionId, entity.definitionId)

	const definitionName = entityDefinition
		? `${connectionLabel}: ${entityDefinition.label}`
		: `${connectionLabel}: ${entity.definitionId} (undefined)`

	return (
		<>
			<CCol sm={12} className="p-0">
				<CForm onSubmit={PreventDefaultHandler} className="row flex-form">
					<CFormLabel className="col-sm-4 col-form-label col-form-label-sm">
						Variable Type
						<FontAwesomeIcon
							icon={faQuestionCircle}
							title="The name for the variable. It will get wrapped with $(custom:X) for you"
						/>
					</CFormLabel>
					<CCol xs={8}>
						<b>{definitionName}</b>
						<br />
						<small>{entityDefinition?.description ?? ''}</small>
					</CCol>
				</CForm>
			</CCol>

			<div className="editor-grid">
				<EntityCommonCells
					entity={entity}
					feedbackListType={FeedbackEntitySubType.Value}
					entityDefinition={entityDefinition}
					service={entityService}
				/>

				<EntityManageChildGroups entity={entity} entityDefinition={entityDefinition} />
			</div>
		</>
	)
})

function CustomVariableCurrentValue({ name }: { name: string }) {
	const { notifier } = useContext(RootAppStoreContext)

	const onCopied = useCallback(() => notifier.current?.show(`Copied`, 'Copied to clipboard', 3000), [notifier])

	const sub = useSubscription(
		trpc.preview.expressionStream.watchExpression.subscriptionOptions(
			{
				controlId: null,
				expression: `$(custom:${name})`,
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
