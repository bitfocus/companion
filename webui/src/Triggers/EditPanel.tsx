import { CButton, CCol, CForm, CInputGroup, CFormLabel, CAlert } from '@coreui/react'
import React, { useCallback, useRef } from 'react'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { LoadingRetryOrError, MyErrorBoundary, PreventDefaultHandler } from '~/util.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import { TextInputField } from '~/Components/index.js'
import { TriggerEventEditor } from './EventEditor.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import { useLocalVariablesStore } from '../Controls/LocalVariablesStore.js'
import { EntityModelType, FeedbackEntitySubType } from '@companion-app/shared/Model/EntityModel.js'
import { trpc, useMutationExt } from '~/TRPC.js'
import { useControlConfig } from '~/Hooks/useControlConfig.js'

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

	const localVariablesStore = useLocalVariablesStore(controlId, null)

	return (
		<div className="edit-button-panel flex-form">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={reloadConfig} design="pulse" />
			{controlConfig ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					{controlConfig.config.type === 'trigger' ? (
						<>
							<MyErrorBoundary>
								<TriggerConfig options={controlConfig.config.options} controlId={controlId} />
							</MyErrorBoundary>

							<MyErrorBoundary>
								<TriggerEventEditor
									heading={
										<>
											Events &nbsp;
											<FontAwesomeIcon
												icon={faQuestionCircle}
												title="The trigger will be executed when any of the events happens"
											/>
										</>
									}
									controlId={controlId}
									events={controlConfig.config.events}
								/>
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ControlEntitiesEditor
									heading={
										<>
											Conditions &nbsp;
											<FontAwesomeIcon
												icon={faQuestionCircle}
												title="Only execute when all of these conditions are true"
											/>
										</>
									}
									controlId={controlId}
									entities={controlConfig.config.condition}
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
											<FontAwesomeIcon icon={faQuestionCircle} title="What should happen when executed" />
										</>
									}
									controlId={controlId}
									location={undefined}
									listId="trigger_actions"
									entities={controlConfig.config.actions}
									entityType={EntityModelType.Action}
									entityTypeLabel="action"
									feedbackListType={null}
									localVariablesStore={localVariablesStore}
									localVariablePrefix={null}
								/>
							</MyErrorBoundary>
						</>
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

interface TriggerConfigProps {
	controlId: string
	options: Record<string, any>
}

function TriggerConfig({ controlId, options }: TriggerConfigProps) {
	const setOptionsFieldMutation = useMutationExt(trpc.controls.setOptionsField.mutationOptions())

	const setValueInner = useCallback(
		(key: string, value: any) => {
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
			<CForm onSubmit={PreventDefaultHandler}>
				<CForm className="row flex-form">
					<CCol xs={12}>
						<CFormLabel>Name</CFormLabel>
						<p>
							<CInputGroup>
								<TextInputField setValue={setName} value={options.name} />
								<TestActionsButton controlId={controlId} hidden={!options} />
							</CInputGroup>
						</p>
					</CCol>
				</CForm>
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
