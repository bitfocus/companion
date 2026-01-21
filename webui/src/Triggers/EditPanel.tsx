import { CButton, CCol, CForm, CInputGroup, CFormLabel, CAlert } from '@coreui/react'
import React, { useCallback, useRef } from 'react'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { LoadingRetryOrError } from '~/Resources/Loading.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { TextInputField } from '~/Components/index.js'
import { TriggerEventEditor } from './EventEditor.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { useLocalVariablesStore } from '../Controls/LocalVariablesStore.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { LocalVariablesEditor } from '~/Controls/LocalVariablesEditor.js'
import { InlineHelp } from '~/Components/InlineHelp.js'
import type { JsonValue } from 'type-fest'

interface EditTriggerPanelProps {
	controlId: string
}

export function EditTriggerPanel({ controlId }: EditTriggerPanelProps): React.JSX.Element {
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
					{controlConfig.config.type === 'trigger' ? (
						<TriggerPanelContent config={controlConfig.config} controlId={controlId} />
					) : (
						<CAlert color="danger">Invalid control type: {controlConfig.config.type}. Expected 'trigger'.</CAlert>
					)}
				</div>
			) : (
				''
			)}
		</div>
	)
}

interface TriggerPanelContentProps {
	config: TriggerModel
	controlId: string
}

function TriggerPanelContent({ config, controlId }: TriggerPanelContentProps): React.ReactNode {
	const localVariablesStore = useLocalVariablesStore(controlId, config.localVariables)

	return (
		<>
			<MyErrorBoundary>
				<TriggerConfig options={config.options} controlId={controlId} />
			</MyErrorBoundary>

			<MyErrorBoundary>
				<TriggerEventEditor
					heading={
						<>
							Events &nbsp;
							<InlineHelp help="The trigger will be executed when any of the events happens">
								<FontAwesomeIcon icon={faQuestionCircle} />
							</InlineHelp>
						</>
					}
					controlId={controlId}
					events={config.events}
					localVariablesStore={localVariablesStore}
				/>
			</MyErrorBoundary>

			<MyErrorBoundary>
				<ControlEntitiesEditor
					heading={
						<>
							Conditions &nbsp;
							<InlineHelp help="Only execute when all of these conditions are true">
								<FontAwesomeIcon icon={faQuestionCircle} />
							</InlineHelp>
						</>
					}
					controlId={controlId}
					entities={config.condition}
					listId="feedbacks"
					entityType={EntityModelType.Feedback}
					entityTypeLabel="condition"
					feedbackListType={FeedbackEntitySubType.Boolean}
					location={undefined}
					localVariablesStore={localVariablesStore}
					localVariablePrefix={null}
				/>
			</MyErrorBoundary>

			<MyErrorBoundary>
				<ControlEntitiesEditor
					heading={
						<>
							Actions &nbsp;
							<InlineHelp help="What should happen when executed">
								<FontAwesomeIcon icon={faQuestionCircle} />
							</InlineHelp>
						</>
					}
					controlId={controlId}
					location={undefined}
					listId="trigger_actions"
					entities={config.actions}
					entityType={EntityModelType.Action}
					entityTypeLabel="action"
					feedbackListType={null}
					localVariablesStore={localVariablesStore}
					localVariablePrefix={null}
				/>
			</MyErrorBoundary>

			<MyErrorBoundary>
				<LocalVariablesEditor
					controlId={controlId}
					location={undefined}
					variables={config.localVariables}
					localVariablesStore={localVariablesStore}
				/>
			</MyErrorBoundary>
		</>
	)
}

interface TriggerConfigProps {
	controlId: string
	options: Record<string, any>
}

function TriggerConfig({ controlId, options }: TriggerConfigProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: string, value: JsonValue) => {
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

	const setName = useCallback((val: string) => setValueInner('name', val), [setValueInner])

	return (
		<CCol sm={12} className="p-0">
			<CForm onSubmit={PreventDefaultHandler} className="row flex-form">
				<CCol xs={12}>
					<CFormLabel>Name</CFormLabel>
					<br />
					<CInputGroup>
						<TextInputField setValue={setName} value={options.name} />
						<TestActionsButton controlId={controlId} hidden={!options} />
					</CInputGroup>
				</CCol>
			</CForm>
		</CCol>
	)
}

function TestActionsButton({ controlId, hidden }: { controlId: string; hidden: boolean }): React.JSX.Element {
	const testActionsMutation = useMutationExt(trpc.controls.triggers.testActions.mutationOptions())

	const hotPressDown = useCallback(() => {
		testActionsMutation.mutateAsync({ controlId }).catch((e) => console.error(`Hot press failed: ${e}`))
	}, [testActionsMutation, controlId])
	return (
		<CButton color="warning" hidden={hidden} onMouseDown={hotPressDown}>
			Test actions
		</CButton>
	)
}
