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
		socketEmitPromise(socket, 'controls:hot-press', [controlId, true]).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [socket, controlId])
	const hotPressUp = useCallback(() => {
		socketEmitPromise(socket, 'controls:hot-press', [controlId, false]).catch((e) =>
			console.error(`Hot press failed: ${e}`)
		)
	}, [socket, controlId])

	const errors = []
	if (configError) errors.push(configError)
	const loadError = errors.length > 0 ? errors.join(', ') : null
	const hasConfig = config || config === false
	const hasRuntimeProps = runtimeProps || runtimeProps === false
	const dataReady = !loadError && hasConfig && hasRuntimeProps

	return (
		<div className="edit-button-panel">
			<GenericConfirmModal ref={resetModalRef} />

			<LoadingRetryOrError dataReady={dataReady} error={loadError} doRetry={doRetryLoad} />
			{hasConfig ? (
				<div style={{ display: dataReady ? '' : 'none' }}>
					<MyErrorBoundary>
						<TriggerConfig
							config={config.config}
							controlId={controlId}
							hotPressDown={hotPressDown}
							hotPressUp={hotPressUp}
						/>

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
								<TriggerEventEditor heading="Events" controlId={controlId} events={config.events} />
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ControlFeedbacksEditor
									heading={'Condition'}
									controlId={controlId}
									feedbacks={config.condition}
									booleanOnly={true}
									isOnBank={false}
								/>
							</MyErrorBoundary>

							<MyErrorBoundary>
								<ControlActionSetEditor
									heading="Actions"
									controlId={controlId}
									set={'0'}
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

function TriggerConfig({ controlId, config, hotPressDown, hotPressUp }) {
	const socket = useContext(SocketContext)

	const setValueInner = useCallback(
		(key, value) => {
			console.log('set', controlId, key, value)
			socketEmitPromise(socket, 'controls:set-config-field', [controlId, key, value]).catch((e) => {
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
								<TextInputField setValue={setName} value={config.name} />
								<CInputGroupAppend>
									<CButton color="warning" hidden={!config} onMouseDown={hotPressDown} onMouseUp={hotPressUp}>
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
