import { CCol, CForm, CFormLabel } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { LoadingRetryOrError, SocketContext, MyErrorBoundary, PreventDefaultHandler } from '~/util.js'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { TextInputField } from '~/Components/index.js'
import { EntityModelType, FeedbackEntitySubType, SomeEntityModel } from '@companion-app/shared/Model/EntityModel.js'
import type { CustomVariableModel2, CustomVariableOptions } from '@companion-app/shared/Model/CustomVariableModel.js'
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

interface EditCustomVariablePanelProps {
	controlId: string
}

export function EditCustomVariablePanel({ controlId }: EditCustomVariablePanelProps): React.JSX.Element {
	const socket = useContext(SocketContext)

	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const [config, setConfig] = useState<CustomVariableModel2 | null>(null)
	const [runtimeProps, setRuntimeProps] = useState<Record<string, never> | null>(null)

	const configRef = useRef<CustomVariableModel2>()
	configRef.current = config ?? undefined // update the ref every render

	const [configError, setConfigError] = useState<string | null>(null)

	const [reloadConfigToken, setReloadConfigToken] = useState(nanoid())

	useEffect(() => {
		setConfig(null)
		setConfigError(null)
		setRuntimeProps(null)

		socket
			.emitPromise('controls:subscribe', [controlId])
			.then((config) => {
				setConfig((config as any)?.config ?? false)
				setRuntimeProps((config as any)?.runtime ?? {})
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load custom variable config', e)
				setConfig(null)
				setConfigError('Failed to load custom variable config')
			})

		const unsubConfig = socket.on(`controls:config-${controlId}`, (patch) => {
			setConfig((oldConfig) => {
				if (!oldConfig || patch === false) {
					return null
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig) || {}, patch).newDocument
				}
			})
		})
		const unsubRuntimeProps = socket.on(`controls:runtime-${controlId}`, (patch) => {
			setRuntimeProps((oldProps) => {
				if (patch === false) {
					return {}
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldProps) || {}, patch).newDocument
				}
			})
		})

		return () => {
			unsubConfig()
			unsubRuntimeProps()

			socket.emitPromise('controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe custom variable config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])

	const errors: string[] = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasRuntimeProps = !!runtimeProps || runtimeProps === false
	const dataReady = !loadError && !!config && hasRuntimeProps

	return (
		<div className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{config ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					<MyErrorBoundary>
						<CustomVariableConfig options={config.options} controlId={controlId} />
					</MyErrorBoundary>

					{config && runtimeProps ? (
						<>
							<MyErrorBoundary>
								<CustomVariableEntityEditor controlId={controlId} entity={config.entity} />
							</MyErrorBoundary>
						</>
					) : (
						''
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
	const socket = useContext(SocketContext)

	const setValueInner = useCallback(
		(key: keyof CustomVariableOptions, value: any) => {
			console.log('set', controlId, key, value)
			socket.emitPromise('controls:set-options-field', [controlId, key, value]).catch((e) => {
				console.error(`Set field failed: ${e}`)
			})
		},
		[socket, controlId]
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
