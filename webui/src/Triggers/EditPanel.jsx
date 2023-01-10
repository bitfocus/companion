import { CButton, CCol, CForm, CInputGroup, CInputGroupAppend, CLabel, CRow } from '@coreui/react'
import React, { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { LoadingRetryOrError, socketEmitPromise, SocketContext, MyErrorBoundary } from '../util'
import { ControlActionSetEditor } from '../Controls/ActionSetEditor'
import jsonPatch from 'fast-json-patch'

import { ControlOptionsEditor } from '../Controls/ControlOptionsEditor'
import { ControlFeedbacksEditor } from '../Controls/FeedbackEditor'
import { cloneDeep } from 'lodash-es'
import { TextInputField } from '../Components'
import { TriggerEventEditor } from './EventEditor'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

export function EditTriggerPanel({ controlId }) {
	const socket = useContext(SocketContext)

	const resetModalRef = useRef()

	const [config, setConfig] = useState(null)
	const [runtimeProps, setRuntimeProps] = useState(null)

	const configRef = useRef()
	configRef.current = config // update the ref every render

	const [configError, setConfigError] = useState(null)

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
				console.error('Failed to load bank config', e)
				setConfig(null)
				setConfigError('Failed to load bank config')
			})

		const patchConfig = (patch) => {
			setConfig((oldConfig) => {
				if (patch === false) {
					return false
				} else {
					return jsonPatch.applyPatch(cloneDeep(oldConfig) || {}, patch).newDocument
				}
			})
		}

		const patchRuntimeProps = (patch) => {
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
				console.error('Failed to unsubscribe bank config', e)
			})
		}
	}, [socket, controlId, reloadConfigToken])

	const doRetryLoad = useCallback(() => setReloadConfigToken(nanoid()), [])

	const hotPressDown = useCallback(() => {
		socketEmitPromise(socket, 'triggers:test', [controlId]).catch((e) => console.error(`Hot press failed: ${e}`))
	}, [socket, controlId])

	const errors = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasRuntimeProps = runtimeProps || runtimeProps === false
	const dataReady = !loadError && config && hasRuntimeProps

	return (
		<div className="edit-button-panel">
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
									controlId={controlId}
									feedbacks={config.condition}
									booleanOnly={true}
									isOnControl={false}
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

function TriggerConfig({ controlId, options, hotPressDown }) {
	const socket = useContext(SocketContext)

	const setValueInner = useCallback(
		(key, value) => {
			console.log('set', controlId, key, value)
			socketEmitPromise(socket, 'controls:set-options-field', [controlId, key, value]).catch((e) => {
				console.error(`Set field failed: ${e}`)
			})
		},
		[socket, controlId]
	)

	const setName = useCallback((val) => setValueInner('name', val), [setValueInner])

	return (
		<CCol sm={12} className="p-0">
			<CForm>
				<CRow form className="button-style-form">
					<CCol className="fieldtype-checkbox" xs={12}>
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
