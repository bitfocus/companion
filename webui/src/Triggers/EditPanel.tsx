import { CButton, CCol, CForm, CInputGroup, CInputGroupAppend, CLabel, CRow } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import {
	LoadingRetryOrError,
	socketEmitPromise,
	SocketContext,
	MyErrorBoundary,
	PreventDefaultHandler,
} from '../util.js'
import { ControlActionSetEditor } from '../Controls/ActionSetEditor.jsx'
import jsonPatch, { Operation as JsonPatchOperation } from 'fast-json-patch'

import { ControlOptionsEditor } from '../Controls/ControlOptionsEditor.js'
import { ControlFeedbacksEditor } from '../Controls/FeedbackEditor.jsx'
import { cloneDeep } from 'lodash-es'
import { TextInputField } from '../Components/index.js'
import { TriggerEventEditor } from './EventEditor.js'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'
import type { TriggerModel } from '@companion/shared/Model/TriggerModel.js'

interface EditTriggerPanelProps {
	controlId: string
}

export function EditTriggerPanel({ controlId }: EditTriggerPanelProps) {
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

		socketEmitPromise(socket, 'controls:subscribe', [controlId])
			.then((config) => {
				setConfig(config?.config ?? false)
				setRuntimeProps(config?.runtime ?? {})
				setConfigError(null)
			})
			.catch((e) => {
				console.error('Failed to load trigger config', e)
				setConfig(null)
				setConfigError('Failed to load trigger config')
			})

		const patchConfig = (patch: JsonPatchOperation[] | false) => {
			setConfig((oldConfig) => {
				if (!oldConfig || patch === false) {
					return null
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig) || {}, patch).newDocument
				}
			})
		}

		const patchRuntimeProps = (patch: JsonPatchOperation[] | false) => {
			setRuntimeProps((oldProps) => {
				if (patch === false) {
					return {}
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldProps) || {}, patch).newDocument
				}
			})
		}

		socket.on(`controls:config-${controlId}`, patchConfig)
		socket.on(`controls:runtime-${controlId}`, patchRuntimeProps)

		return () => {
			socket.off(`controls:config-${controlId}`, patchConfig)
			socket.off(`controls:runtime-${controlId}`, patchRuntimeProps)

			socketEmitPromise(socket, 'controls:unsubscribe', [controlId]).catch((e) => {
				console.error('Failed to unsubscribe trigger config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])

	const hotPressDown = useCallback(() => {
		socketEmitPromise(socket, 'triggers:test', [controlId]).catch((e) => console.error(`Hot press failed: ${e}`))
	}, [socket, controlId])

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
						<TriggerConfig options={config.options} controlId={controlId} hotPressDown={hotPressDown} />

						<ControlOptionsEditor
							controlType={config.type}
							options={config.options}
							configRef={configRef}
							controlId={controlId}
						/>
					</MyErrorBoundary>

					{config && runtimeProps ? (
						<>
							<MyErrorBoundary>
								<TriggerEventEditor
									heading={
										<>
											Events &nbsp;
											<FontAwesomeIcon icon={faQuestionCircle} title="When should the trigger execute" />
										</>
									}
									controlId={controlId}
									events={config.events}
								/>
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ControlFeedbacksEditor
									heading={
										<>
											Condition &nbsp;
											<FontAwesomeIcon
												icon={faQuestionCircle}
												title="Only execute when all of this conditions are true"
											/>
										</>
									}
									entityType="condition"
									controlId={controlId}
									feedbacks={config.condition}
									booleanOnly={true}
									location={undefined}
									addPlaceholder="+ Add condition"
								/>
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ControlActionSetEditor
									heading={
										<>
											Actions &nbsp;
											<FontAwesomeIcon icon={faQuestionCircle} title="What should happen when executed" />
										</>
									}
									controlId={controlId}
									location={undefined}
									stepId=""
									setId={'0'}
									addPlaceholder="+ Add action"
									actions={config.action_sets['0']}
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
	hotPressDown: () => void
}

function TriggerConfig({ controlId, options, hotPressDown }: TriggerConfigProps) {
	const socket = useContext(SocketContext)

	const setValueInner = useCallback(
		(key: string, value: any) => {
			console.log('set', controlId, key, value)
			socketEmitPromise(socket, 'controls:set-options-field', [controlId, key, value]).catch((e) => {
				console.error(`Set field failed: ${e}`)
			})
		},
		[socket, controlId]
	)

	const setName = useCallback((val: string) => setValueInner('name', val), [setValueInner])

	return (
		<CCol sm={12} className="p-0">
			<CForm onSubmit={PreventDefaultHandler}>
				<CRow form className="flex-form">
					<CCol xs={12}>
						<CLabel>Name</CLabel>
						<p>
							<CInputGroup>
								<TextInputField setValue={setName} value={options.name} />
								<CInputGroupAppend>
									<CButton color="warning" hidden={!options} onMouseDown={hotPressDown}>
										Test actions
									</CButton>
								</CInputGroupAppend>
							</CInputGroup>
						</p>
					</CCol>
				</CRow>
			</CForm>
		</CCol>
	)
}
