import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import {
	CButton,
	CCol,
	CForm,
	CFormGroup,
	CInput,
	CLabel,
	CModal,
	CModalBody,
	CModalFooter,
	CModalHeader,
	CRow,
} from '@coreui/react'
import { MyErrorBoundary, useMountEffect, socketEmit2, SocketContext } from '../util'
import Select from 'react-select'
import { AddFeedbackDropdown, FeedbackEditor } from '../Buttons/EditButton/FeedbackPanel'
import { nanoid } from 'nanoid'
import { ActionsPanelInner } from '../Buttons/EditButton/ActionsPanel'
import { CheckboxInputField } from '../Components'
import update from 'immutability-helper'
import { AddFeedbacksModal } from '../Buttons/EditButton/AddModal'
import { useEffect } from 'react'

function getPluginSpecDefaults(pluginOptions) {
	const config = {}
	// Populate some defaults for the plugin values
	for (const spec of pluginOptions) {
		switch (spec.type) {
			case 'select':
				config[spec.key] = spec.multi ? [] : spec.choices[0]?.id
				break
			case 'textinput':
				config[spec.key] = ''
				break
			default:
				break
		}
	}

	return config
}

function getFeedbackDefaults() {
	// This should be somewhere in the backend, but there isnt anywhere appropriate currently
	return [
		{
			id: nanoid(),
			type: 'variable_value',
			instance_id: 'internal',
			options: {
				variable: 'internal:time_hms',
				op: 'eq',
				value: '',
			},
		},
	]
}

export function TriggerEditModal({ doClose, doSave, item, plugins }) {
	const socket = useContext(SocketContext)

	const actionsRef = useRef()

	const [config, setConfig] = useState({})

	useEffect(() => {
		actionsRef.current = config.actions
	}, [config.actions])

	const pluginSpec = plugins?.find((p) => p.type === config.type)

	const doSaveInner = useCallback(
		(e) => {
			e.preventDefault()

			doSave(config)
			doClose()
		},
		[doClose, doSave, config]
	)

	const changeType = useCallback(
		(e) => {
			const pluginType = e.value
			const pluginSpec = plugins?.find((p) => p.type === pluginType)
			const pluginOptions = pluginSpec?.options || []

			console.log('pluginType', pluginType)
			const innerConfig = getPluginSpecDefaults(pluginOptions)

			setConfig((oldConfig) => ({
				title: '',
				actions: [],
				...oldConfig,
				type: pluginType,
				config: pluginType === 'feedback' ? getFeedbackDefaults() : innerConfig,
			}))
		},
		[plugins]
	)

	useMountEffect(() => {
		if (item) {
			// hack
			if (!item.actions) item.actions = []

			if (item.type === 'feedback' && !Array.isArray(item.config)) item.config = [item.config]

			setConfig(item)
		} else if (plugins) {
			const defaultPlugin = plugins.find((p) => p.type === 'feedback') ?? plugins[0]
			changeType({ value: defaultPlugin.type })
		}
	})

	const pluginChoices = useMemo(() => {
		return plugins.map((p) => ({ value: p.type, label: p.name }))
	}, [plugins])

	const setActions = useCallback((cb) => {
		setConfig((oldConfig) => {
			const newConfig = { ...oldConfig }
			newConfig.actions = cb(oldConfig.actions || [])
			return newConfig
		})
	}, [])

	const addActionSelect = useCallback(
		(actionType) => {
			const [instanceId, actionId] = actionType.split(':', 2)
			socketEmit2(socket, 'action-definitions:create-item', [instanceId, actionId]).then((action) => {
				if (action) {
					setConfig((oldConfig) => ({
						...oldConfig,
						actions: [...oldConfig.actions, action],
					}))
				}
			})
		},
		[socket]
	)

	const actionDelete = useCallback(
		(actionId) => {
			setActions((oldActions) => oldActions.filter((a) => a.id !== actionId))
		},
		[setActions]
	)
	const actionSetDelay = useCallback(
		(actionId, delay) => {
			setActions((oldActions) => {
				const actionIndex = oldActions.findIndex((a) => a.id === actionId)
				const oldValue = oldActions[actionIndex]?.options?.delay
				if (oldValue !== delay) {
					return update(oldActions, {
						[actionIndex]: {
							delay: { $set: delay },
						},
					})
				} else {
					return oldActions
				}
			})
		},
		[setActions]
	)
	const actionReorder = useCallback(
		(dragIndex, hoverIndex) => {
			setActions((actions) => {
				const dragCard = actions[dragIndex]
				return update(actions, {
					$splice: [
						[dragIndex, 1],
						[hoverIndex, 0, dragCard],
					],
				})
			})
		},
		[setActions]
	)

	const actionSetValue = useCallback(
		(actionId, key, val) => {
			setActions((oldActions) => {
				const actionIndex = oldActions.findIndex((a) => a.id === actionId)
				const oldValue = (oldActions[actionIndex].options || {})[key]
				if (oldValue !== val) {
					return update(oldActions, {
						[actionIndex]: {
							options: {
								[key]: { $set: val },
							},
						},
					})
				} else {
					return oldActions
				}
			})
		},
		[setActions]
	)
	const doLearn = useCallback(
		(actionId) => {
			if (actionsRef.current) {
				const action = actionsRef.current.find((a) => a.id === actionId)
				if (action) {
					socketEmit2(socket, 'action-definitions:learn-single', [action])
						.then(([newOptions]) => {
							setActions((oldActions) => {
								const index = oldActions.findIndex((a) => a.id === actionId)
								if (index === -1) {
									return oldActions
								} else {
									const newActions = [...oldActions]
									newActions[index] = {
										...newActions[index],
										options: newOptions,
									}
									return newActions
								}
							})
						})
						.catch((e) => {
							console.error('Learn failed', e)
						})
				} else {
					console.error('Not found')
				}
			}
		},
		[socket, setActions]
	)

	const setTitle = useCallback((e) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			title: e.target.value,
		}))
	}, [])

	const setRelativeDelays = useCallback((e) => {
		setConfig((oldConfig) => ({
			...oldConfig,
			relative_delays: e,
		}))
	}, [])

	return (
		<CModal show={true} onClose={doClose} size="lg">
			<CForm onSubmit={doSaveInner} className={'edit-button-panel'}>
				<CModalHeader closeButton>
					<h5>Trigger Editor</h5>
				</CModalHeader>
				<CModalBody>
					<CFormGroup>
						<label>Name</label>
						<CInput required value={config.title} onChange={setTitle} />
					</CFormGroup>

					<legend>Condition</legend>
					<CFormGroup>
						<label>Type</label>
						<Select
							value={pluginChoices.find((c) => c.value === config.type)}
							onChange={changeType}
							isSearchable={false}
							isClearable={false}
							options={pluginChoices}
							required
						/>
					</CFormGroup>

					{pluginSpec?.options ? (
						<TriggerEditModalConfig pluginSpec={pluginSpec} config={config.config} setConfig={setConfig} />
					) : (
						'Unknown type selected'
					)}

					<hr />
					<legend>Action</legend>
					<CRow form className="button-style-form">
						<CCol className="fieldtype-checkbox" sm={2} xs={3}>
							<CButton
								color="warning"
								onMouseDown={() =>
									socket.emit('schedule_test_actions', config.title, config.actions, config.relative_delays)
								}
							>
								Test actions
							</CButton>
						</CCol>
						<CCol className="fieldtype-checkbox" sm={2} xs={3}>
							<CLabel>Relative Delays</CLabel>
							<p>
								<CheckboxInputField
									definition={{ default: false }}
									value={config.relative_delays ?? false}
									setValue={setRelativeDelays}
								/>
								&nbsp;
							</p>
						</CCol>
					</CRow>
					<ActionsPanelInner
						isOnBank={false}
						dragId={'triggerAction'}
						addPlaceholder="+ Add action"
						actions={config.actions || []}
						addAction={addActionSelect}
						doDelete={actionDelete}
						doSetDelay={actionSetDelay}
						doReorder={actionReorder}
						doSetValue={actionSetValue}
						emitLearn={doLearn}
					/>
				</CModalBody>
				<CModalFooter>
					<CButton color="secondary" onClick={doClose}>
						Cancel
					</CButton>
					<CButton color="primary" type="submit">
						Save
					</CButton>
				</CModalFooter>
			</CForm>
		</CModal>
	)
}

function TriggerEditModalConfig({ pluginSpec, config, setConfig }) {
	const socket = useContext(SocketContext)

	const feedbacksRef = useRef(null)
	useEffect(() => {
		feedbacksRef.current = config
	}, [config])

	const addFeedbacksRef = useRef(null)
	const showAddModal = useCallback(() => {
		if (addFeedbacksRef.current) {
			addFeedbacksRef.current.show()
		}
	}, [])

	const updateInnerConfig = useCallback(
		(id, val) => {
			setConfig((oldConfig) => ({
				...oldConfig,
				config: {
					...oldConfig.config,
					[id]: val,
				},
			}))
		},
		[setConfig]
	)
	const updateFeedbackOptionConfig = useCallback(
		(feedbackId, id, val) => {
			setConfig((oldConfig) => {
				const newFeedbacks = oldConfig.config.map((fb) => {
					if (fb.id === feedbackId) {
						return {
							...fb,
							options: {
								...fb.options,
								[id]: val,
							},
						}
					} else {
						return fb
					}
				})
				return {
					...oldConfig,
					config: newFeedbacks,
				}
			})
		},
		[setConfig]
	)

	const [recentFeedbacks, setRecentFeedbacks] = useState([])
	useMountEffect(() => {
		try {
			// Load from localStorage at startup
			const recent = JSON.parse(window.localStorage.getItem('recent_feedbacks') || '[]')
			if (Array.isArray(recent)) {
				setRecentFeedbacks(recent)
			}
		} catch (e) {
			setRecentFeedbacks([])
		}
	})

	const addFeedbackSelect = useCallback(
		(feedbackType) => {
			setRecentFeedbacks((existing) => {
				const newActions = [feedbackType, ...existing.filter((v) => v !== feedbackType)].slice(0, 20)

				window.localStorage.setItem('recent_feedbacks', JSON.stringify(newActions))

				return newActions
			})

			const [instanceId, feedbackId] = feedbackType.split(':', 2)
			socketEmit2(socket, 'feedback-definitions:create-item', [instanceId, feedbackId]).then((fb) => {
				if (fb) {
					setConfig((oldConfig) => ({
						...oldConfig,
						config: [...oldConfig.config, fb],
					}))
				}
			})
		},
		[socket, setConfig]
	)

	const delRow = useCallback(
		(feedbackId) => {
			setConfig((oldConfig) => {
				const newFeedbacks = oldConfig.config.filter((fb) => fb.id !== feedbackId)

				return {
					...oldConfig,
					config: newFeedbacks,
				}
			})
		},
		[setConfig]
	)

	const learnRow = useCallback(
		(feedbackId) => {
			if (feedbacksRef.current) {
				const oldFeedback = feedbacksRef.current.find((fb) => fb.id === feedbackId)
				if (oldFeedback) {
					socketEmit2(socket, 'feedback-definitions:learn-single', [oldFeedback])
						.then(([newOptions]) => {
							if (newOptions) {
								setConfig((oldConfig) => {
									const newFeedbacks = oldConfig.config.map((fb) => {
										if (fb.id === feedbackId) {
											return {
												...fb,
												options: newOptions,
											}
										} else {
											return fb
										}
									})
									return {
										...oldConfig,
										config: newFeedbacks,
									}
								})
							}
						})
						.catch((e) => {
							console.error('Learn failed', e)
						})
				}
			}
		},
		[socket, setConfig]
	)

	// This is a bit of a hack:
	if (pluginSpec.type === 'feedback') {
		return (
			<>
				<table className="table feedback-table">
					<tbody>
						{config.map((conf, i) => (
							<tr key={i}>
								<td>
									<MyErrorBoundary>
										<FeedbackEditorRow
											feedback={conf}
											updateFeedbackOptionConfig={updateFeedbackOptionConfig}
											delRow={delRow}
											learnRow={learnRow}
										/>
									</MyErrorBoundary>
								</td>
							</tr>
						))}
					</tbody>
				</table>

				<AddFeedbacksModal ref={addFeedbacksRef} addFeedback={addFeedbackSelect} />

				<div className="add-dropdown-wrapper">
					<AddFeedbackDropdown onSelect={addFeedbackSelect} booleanOnly recentFeedbacks={recentFeedbacks} />
					<CButton color="primary" variant="outline" onClick={showAddModal}>
						Browse
					</CButton>
				</div>
			</>
		)
	}

	return (
		<>
			{pluginSpec.options.map((spec) => (
				<CFormGroup key={spec.key}>
					<MyErrorBoundary>
						<TriggerEditModalInput
							spec={spec}
							value={config[spec.key]}
							onChange={(val) => updateInnerConfig(spec.key, val)}
						/>
					</MyErrorBoundary>
				</CFormGroup>
			))}
		</>
	)
}

function FeedbackEditorRow({ feedback, updateFeedbackOptionConfig, delRow, learnRow }) {
	const innerDelete = useCallback(() => {
		delRow(feedback.id)
	}, [feedback.id, delRow])
	const innerLearn = useCallback(() => {
		learnRow(feedback.id)
	}, [feedback.id, learnRow])

	return (
		<FeedbackEditor
			isOnBank={false}
			feedback={feedback}
			setValue={updateFeedbackOptionConfig}
			innerDelete={innerDelete}
			innerLearn={innerLearn}
		/>
	)
}

function TriggerEditModalInput({ spec, value, onChange }) {
	const choices = useMemo(() => {
		return spec?.choices?.map((ch) => ({ value: ch.id, label: ch.label })) ?? []
	}, [spec?.choices])

	switch (spec.type) {
		case 'textinput':
			return (
				<CInput
					value={value}
					onChange={(e) => onChange(e.target.value)}
					placeholder={spec.placeholder}
					pattern={spec.pattern}
					required={!spec.not_required}
				/>
			)
		case 'select': {
			const selectedValue = Array.isArray(value) ? value : value === undefined ? [] : [value]
			const selectedValue2 = selectedValue.map((v) => choices.find((c) => c.value === v))
			return (
				<Select
					value={spec.multi ? selectedValue2 : selectedValue2[0]}
					onChange={(val) => onChange(spec.multi ? val?.map((v) => v.value) : val?.value)}
					isMulti={!!spec.multi}
					isClearable={false}
					isSearchable={typeof spec.minChoicesForSearch === 'number' && spec.minChoicesForSearch <= choices.length}
					options={choices}
					required
				/>
			)
		}
		default:
			return <p>Unknown input: "{spec.type}"</p>
	}
}
