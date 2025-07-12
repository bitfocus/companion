import { CButton, CCol, CForm, CInputGroup, CFormLabel } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { GenericConfirmModal, GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { LoadingRetryOrError, SocketContext, MyErrorBoundary, PreventDefaultHandler } from '~/util.js'
import { ControlEntitiesEditor } from '~/Controls/EntitiesEditor.js'
import jsonPatch from 'fast-json-patch'
import { cloneDeep } from 'lodash-es'
import { TextInputField } from '~/Components/index.js'
import { TriggerEventEditor } from './EventEditor.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import type { TriggerModel } from '@companion-app/shared/Model/TriggerModel.js'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { trpc, useMutationExt } from '~/TRPC.js'

interface EditTriggerPanelProps {
	controlId: string
}

export function EditTriggerPanel({ controlId }: EditTriggerPanelProps): React.JSX.Element {
	const socket = useContext(SocketContext)

	const resetModalRef = useRef<GenericConfirmModalRef>(null)

	const [config, setConfig] = useState<TriggerModel | null>(null)
	const [runtimeProps, setRuntimeProps] = useState<Record<string, never> | null>(null)

	const configRef = useRef<TriggerModel>()
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
				console.error('Failed to load trigger config', e)
				setConfig(null)
				setConfigError('Failed to load trigger config')
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
				console.error('Failed to unsubscribe trigger config', e)
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

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} design="pulse" />
			{config ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					<MyErrorBoundary>
						<TriggerConfig options={config.options} controlId={controlId} />
					</MyErrorBoundary>

					{config && runtimeProps ? (
						<>
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
									events={config.events}
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
									entities={config.condition}
									listId="feedbacks"
									entityType={EntityModelType.Feedback}
									entityTypeLabel="condition"
									onlyFeedbackType="boolean"
									location={undefined}
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
									entities={config.actions}
									entityType={EntityModelType.Action}
									entityTypeLabel="action"
									onlyFeedbackType={null}
								/>
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
