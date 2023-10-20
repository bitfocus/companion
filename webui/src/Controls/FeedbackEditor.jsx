import { CAlert, CButton, CForm, CFormGroup, CButtonGroup, CSwitch, CLabel } from '@coreui/react'
import {
	faSort,
	faTrash,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faCopy,
	faFolderOpen,
	faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
	FeedbacksContext,
	InstancesContext,
	MyErrorBoundary,
	socketEmitPromise,
	sandbox,
	SocketContext,
	PreventDefaultHandler,
	RecentFeedbacksContext,
} from '../util'
import Select, { createFilter } from 'react-select'
import { OptionsInputField } from './OptionsInputField'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal } from '../Components/GenericConfirmModal'
import { CheckboxInputField, DropdownInputField } from '../Components'
import { ButtonStyleConfigFields } from './ButtonStyleConfig'
import { AddFeedbacksModal } from './AddModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import { OptionButtonPreview } from './OptionButtonPreview'
import { MenuPortalContext } from '../Components/DropdownInputField'
import { ButtonStyleProperties } from '@companion/shared/Style'

export function ControlFeedbacksEditor({
	controlId,
	feedbacks,
	heading,
	entityType,
	booleanOnly,
	location,
	addPlaceholder,
}) {
	const socket = useContext(SocketContext)

	const confirmModal = useRef()

	const feedbacksRef = useRef()
	feedbacksRef.current = feedbacks

	const addFeedbacksRef = useRef(null)
	const showAddModal = useCallback(() => {
		if (addFeedbacksRef.current) {
			addFeedbacksRef.current.show()
		}
	}, [])

	const setValue = useCallback(
		(feedbackId, key, val) => {
			const currentFeedback = feedbacksRef.current?.find((fb) => fb.id === feedbackId)
			if (!currentFeedback?.options || currentFeedback.options[key] !== val) {
				socketEmitPromise(socket, 'controls:feedback:set-option', [controlId, feedbackId, key, val]).catch((e) => {
					console.error(`Set-option failed: ${e}`)
				})
			}
		},
		[socket, controlId]
	)
	const setInverted = useCallback(
		(feedbackId, isInverted) => {
			const currentFeedback = feedbacksRef.current?.find((fb) => fb.id === feedbackId)
			if (!currentFeedback || currentFeedback.isInverted !== isInverted) {
				socketEmitPromise(socket, 'controls:feedback:set-inverted', [controlId, feedbackId, isInverted]).catch((e) => {
					console.error(`Set-inverted failed: ${e}`)
				})
			}
		},
		[socket, controlId]
	)

	const doDelete = useCallback(
		(feedbackId) => {
			confirmModal.current.show(`Delete ${entityType}`, `Delete ${entityType}?`, 'Delete', () => {
				socketEmitPromise(socket, 'controls:feedback:remove', [controlId, feedbackId]).catch((e) => {
					console.error(`Failed to delete feedback: ${e}`)
				})
			})
		},
		[socket, controlId, entityType]
	)

	const doDuplicate = useCallback(
		(feedbackId) => {
			socketEmitPromise(socket, 'controls:feedback:duplicate', [controlId, feedbackId]).catch((e) => {
				console.error(`Failed to duplicate feedback: ${e}`)
			})
		},
		[socket, controlId]
	)

	const doLearn = useCallback(
		(feedbackId) => {
			socketEmitPromise(socket, 'controls:feedback:learn', [controlId, feedbackId]).catch((e) => {
				console.error(`Failed to learn feedback values: ${e}`)
			})
		},
		[socket, controlId]
	)

	const addFeedback = useCallback(
		(feedbackType) => {
			const [instanceId, feedbackId] = feedbackType.split(':', 2)
			socketEmitPromise(socket, 'controls:feedback:add', [controlId, instanceId, feedbackId]).catch((e) => {
				console.error('Failed to add bank feedback', e)
			})
		},
		[socket, controlId]
	)

	const moveCard = useCallback(
		(dragIndex, hoverIndex) => {
			socketEmitPromise(socket, 'controls:feedback:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
				console.error(`Move failed: ${e}`)
			})
		},
		[socket, controlId]
	)

	const emitEnabled = useCallback(
		(feedbackId, enabled) => {
			socketEmitPromise(socket, 'controls:feedback:enabled', [controlId, feedbackId, enabled]).catch((e) => {
				console.error('Failed to enable/disable feedback', e)
			})
		},
		[socket, controlId]
	)

	const feedbackIds = useMemo(() => feedbacks.map((fb) => fb.id), [feedbacks])
	const { setPanelCollapsed, isPanelCollapsed, setAllCollapsed, setAllExpanded, canExpandAll, canCollapseAll } =
		usePanelCollapseHelper(`feedbacks_${controlId}`, feedbackIds)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<MyErrorBoundary>
				<AddFeedbacksModal ref={addFeedbacksRef} addFeedback={addFeedback} booleanOnly={booleanOnly} />
			</MyErrorBoundary>

			<h4 className="mt-3">
				{heading}
				{feedbacks.length > 1 && (
					<CButtonGroup className="right">
						<CButtonGroup>
							{canExpandAll && (
								<CButton size="sm" onClick={setAllExpanded} title="Expand all feedbacks">
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							)}
							{canCollapseAll && (
								<CButton size="sm" onClick={setAllCollapsed} title="Collapse all feedbacks">
									<FontAwesomeIcon icon={faCompressArrowsAlt} />
								</CButton>
							)}
						</CButtonGroup>
					</CButtonGroup>
				)}
			</h4>

			<table className="table feedback-table">
				<tbody>
					{feedbacks.map((a, i) => (
						<MyErrorBoundary key={a?.id ?? i}>
							<FeedbackTableRow
								key={a?.id ?? i}
								entityType={entityType}
								index={i}
								controlId={controlId}
								feedback={a}
								setValue={setValue}
								setInverted={setInverted}
								doDelete={doDelete}
								doDuplicate={doDuplicate}
								doLearn={doLearn}
								doEnabled={emitEnabled}
								dragId={`feedback_${controlId}`}
								moveCard={moveCard}
								setCollapsed={setPanelCollapsed}
								isCollapsed={isPanelCollapsed(a.id)}
								booleanOnly={booleanOnly}
								location={location}
							/>
						</MyErrorBoundary>
					))}
				</tbody>
			</table>

			<div className="add-dropdown-wrapper">
				<AddFeedbackDropdown onSelect={addFeedback} booleanOnly={booleanOnly} addPlaceholder={addPlaceholder} />
				<CButton
					color="primary"
					onClick={showAddModal}
					style={{
						borderTopLeftRadius: 0,
						borderBottomLeftRadius: 0,
					}}
				>
					<FontAwesomeIcon icon={faFolderOpen} />
				</CButton>
			</div>
		</>
	)
}

function FeedbackTableRow({
	entityType,
	feedback,
	controlId,
	index,
	dragId,
	moveCard,
	setValue,
	setInverted,
	doDelete,
	doDuplicate,
	doLearn,
	doEnabled,
	isCollapsed,
	setCollapsed,
	booleanOnly,
	location,
}) {
	const socket = useContext(SocketContext)

	const innerDelete = useCallback(() => doDelete(feedback.id), [feedback.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(feedback.id), [feedback.id, doDuplicate])
	const innerLearn = useCallback(() => doLearn(feedback.id), [doLearn, feedback.id])
	const innerInverted = useCallback((isInverted) => setInverted(feedback.id, isInverted), [feedback.id, setInverted])

	const ref = useRef(null)
	const [, drop] = useDrop({
		accept: dragId,
		hover(item, monitor) {
			if (!ref.current) {
				return
			}
			const dragIndex = item.index
			const hoverIndex = index
			// Don't replace items with themselves
			if (dragIndex === hoverIndex) {
				return
			}

			// Time to actually perform the action
			moveCard(dragIndex, hoverIndex)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
		},
	})
	const [{ isDragging }, drag, preview] = useDrag({
		type: dragId,
		item: {
			actionId: feedback.id,
			index: index,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const setSelectedStyleProps = useCallback(
		(selected) => {
			socketEmitPromise(socket, 'controls:feedback:set-style-selection', [controlId, feedback.id, selected]).catch(
				(e) => {
					console.error(`Failed: ${e}`)
				}
			)
		},
		[socket, controlId, feedback.id]
	)

	const setStylePropsValue = useCallback(
		(key, value) => {
			socketEmitPromise(socket, 'controls:feedback:set-style-value', [controlId, feedback.id, key, value]).catch(
				(e) => {
					console.error(`Failed: ${e}`)
				}
			)
		},
		[socket, controlId, feedback.id]
	)

	const doCollapse = useCallback(() => {
		setCollapsed(feedback.id, true)
	}, [setCollapsed, feedback.id])
	const doExpand = useCallback(() => {
		setCollapsed(feedback.id, false)
	}, [setCollapsed, feedback.id])

	if (!feedback) {
		// Invalid feedback, so skip
		return ''
	}

	return (
		<tr ref={ref} className={isDragging ? 'feedbacklist-dragging' : ''}>
			<td ref={drag} className="td-reorder">
				<FontAwesomeIcon icon={faSort} />
			</td>
			<td>
				<FeedbackEditor
					entityType={entityType}
					location={location}
					feedback={feedback}
					setValue={setValue}
					setInverted={innerInverted}
					innerDelete={innerDelete}
					innerDuplicate={innerDuplicate}
					innerLearn={innerLearn}
					setSelectedStyleProps={setSelectedStyleProps}
					setStylePropsValue={setStylePropsValue}
					isCollapsed={isCollapsed}
					doCollapse={doCollapse}
					doExpand={doExpand}
					doEnabled={doEnabled}
					booleanOnly={booleanOnly}
				/>
			</td>
		</tr>
	)
}

function FeedbackEditor({
	entityType,
	feedback,
	location,
	setValue,
	setInverted,
	innerDelete,
	innerDuplicate,
	innerLearn,
	setSelectedStyleProps,
	setStylePropsValue,
	isCollapsed,
	doCollapse,
	doExpand,
	doEnabled,
	booleanOnly,
}) {
	const feedbacksContext = useContext(FeedbacksContext)
	const instancesContext = useContext(InstancesContext)

	const instance = instancesContext[feedback.instance_id]
	const instanceLabel = instance?.label ?? feedback.instance_id

	const feedbackSpec = (feedbacksContext[feedback.instance_id] || {})[feedback.type]
	const options = feedbackSpec?.options ?? []

	const [optionVisibility, setOptionVisibility] = useState({})

	const innerSetEnabled = useCallback((e) => doEnabled(feedback.id, e.target.checked), [doEnabled, feedback.id])

	useEffect(() => {
		const options = feedbackSpec?.options ?? []

		for (const option of options) {
			if (typeof option.isVisibleFn === 'string') {
				option.isVisible = sandbox(option.isVisibleFn)
			}
		}
	}, [feedbackSpec])

	useEffect(() => {
		const visibility = {}
		const options = feedbackSpec?.options ?? []

		if (options === null || feedback === null) {
			return
		}

		for (const option of options) {
			if (typeof option.isVisible === 'function') {
				visibility[option.id] = option.isVisible(feedback.options, option.isVisibleData)
			}
		}

		setOptionVisibility(visibility)

		return () => {
			setOptionVisibility({})
		}
	}, [feedbackSpec, feedback])

	let name = ''
	if (feedbackSpec) {
		name = `${instanceLabel}: ${feedbackSpec.label}`
	} else {
		name = `${instanceLabel}: ${feedback.type} (undefined)`
	}

	const showButtonPreview = feedback?.instance_id === 'internal' && feedbackSpec?.showButtonPreview

	return (
		<>
			<div className="editor-grid-header remove075right">
				<div className="cell-name">{name}</div>

				<div className="cell-controls">
					<CButtonGroup>
						{isCollapsed ? (
							<CButton size="sm" onClick={doExpand} title={`Expand ${entityType} view`}>
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</CButton>
						) : (
							<CButton size="sm" onClick={doCollapse} title={`Collapse ${entityType} view`}>
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</CButton>
						)}
						<CButton size="sm" onClick={innerDuplicate} title={`Duplicate ${entityType}`}>
							<FontAwesomeIcon icon={faCopy} />
						</CButton>
						<CButton size="sm" onClick={innerDelete} title={`Remove ${entityType}`}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
						{doEnabled && (
							<>
								&nbsp;
								<CSwitch
									color="success"
									checked={!feedback.disabled}
									title={feedback.disabled ? `Enable ${entityType}` : `Disable ${entityType}`}
									onChange={innerSetEnabled}
								/>
							</>
						)}
					</CButtonGroup>
				</div>
			</div>

			{!isCollapsed && (
				<div className="editor-grid remove075right">
					<div className="cell-description">{feedbackSpec?.description || ''}</div>

					{location && showButtonPreview && (
						<div className="cell-bank-preview">
							<OptionButtonPreview location={location} options={feedback.options} />
						</div>
					)}

					<div className="cell-actions">
						{feedbackSpec?.hasLearn && (
							<CButton color="info" size="sm" onClick={innerLearn} title="Capture the current values from the device">
								Learn
							</CButton>
						)}
					</div>

					<div className="cell-option">
						<CForm onSubmit={PreventDefaultHandler}>
							{options.map((opt, i) => (
								<MyErrorBoundary key={i}>
									<OptionsInputField
										key={i}
										isOnControl={!!location}
										instanceId={feedback.instance_id}
										option={opt}
										actionId={feedback.id}
										value={(feedback.options || {})[opt.id]}
										setValue={setValue}
										visibility={optionVisibility[opt.id]}
									/>
								</MyErrorBoundary>
							))}
						</CForm>
					</div>

					{feedbackSpec?.type === 'boolean' && feedbackSpec.showInvert !== false && (
						<div className="cell-invert">
							<MyErrorBoundary>
								<CForm onSubmit={PreventDefaultHandler}>
									<CFormGroup>
										<CLabel>
											Invert
											<FontAwesomeIcon
												style={{ marginLeft: '5px' }}
												icon={faQuestionCircle}
												title={'If checked, the behaviour of this feedback is inverted'}
											/>
										</CLabel>
										<p>
											<CheckboxInputField value={feedback.isInverted} setValue={setInverted} />
											&nbsp;
										</p>
									</CFormGroup>
								</CForm>
							</MyErrorBoundary>
						</div>
					)}

					{!booleanOnly && (
						<>
							<FeedbackStyles feedbackSpec={feedbackSpec} feedback={feedback} setStylePropsValue={setStylePropsValue} />
							<FeedbackManageStyles
								feedbackSpec={feedbackSpec}
								feedback={feedback}
								setSelectedStyleProps={setSelectedStyleProps}
							/>
						</>
					)}
				</div>
			)}
		</>
	)
}

function FeedbackManageStyles({ feedbackSpec, feedback, setSelectedStyleProps }) {
	if (feedbackSpec?.type === 'boolean') {
		const choicesSet = new Set(ButtonStyleProperties.map((c) => c.id))
		const currentValue = Object.keys(feedback.style || {}).filter((id) => choicesSet.has(id))

		return (
			<div className="cell-styles-manage">
				<CForm onSubmit={PreventDefaultHandler}>
					<MyErrorBoundary>
						<CFormGroup>
							<label>Change style properties</label>
							<DropdownInputField
								multiple={true}
								choices={ButtonStyleProperties}
								setValue={setSelectedStyleProps}
								value={currentValue}
							/>
						</CFormGroup>
					</MyErrorBoundary>
				</CForm>
			</div>
		)
	} else {
		return ''
	}
}

function FeedbackStyles({ feedbackSpec, feedback, setStylePropsValue }) {
	const setValue = useCallback(
		(key, value) => {
			setStylePropsValue(key, value).catch((e) => {
				console.error('Failed to update feedback style', e)
			})
		},
		[setStylePropsValue]
	)
	const [pngError, setPngError] = useState(null)
	const clearPngError = useCallback(() => setPngError(null), [])
	const setPng = useCallback(
		(data) => {
			setPngError(null)
			setStylePropsValue('png64', data).catch((e) => {
				console.error('Failed to upload png', e)
				setPngError('Failed to set png')
			})
		},
		[setStylePropsValue]
	)

	const currentStyle = useMemo(() => feedback?.style || {}, [feedback?.style])
	const showField = useCallback((id) => id in currentStyle, [currentStyle])

	if (feedbackSpec?.type === 'boolean') {
		return (
			<div className="cell-styles">
				<CForm onSubmit={PreventDefaultHandler}>
					{pngError && (
						<CAlert color="warning" closeButton>
							{pngError}
						</CAlert>
					)}

					<ButtonStyleConfigFields
						values={currentStyle}
						setValueInner={setValue}
						setPng={setPng}
						setPngError={clearPngError}
						showField={showField}
					/>
					{Object.keys(currentStyle).length === 0 ? 'Feedback has no effect. Try adding a property to override' : ''}
				</CForm>
			</div>
		)
	} else {
		return ''
	}
}

const baseFilter = createFilter()
const filterOptions = (candidate, input) => {
	if (input) {
		return !candidate.data.isRecent && baseFilter(candidate, input)
	} else {
		return candidate.data.isRecent
	}
}

const noOptionsMessage = ({ inputValue }) => {
	if (inputValue) {
		return 'No feedbacks found'
	} else {
		return 'No recently used feedbacks'
	}
}

function AddFeedbackDropdown({ onSelect, booleanOnly, addPlaceholder }) {
	const recentFeedbacksContext = useContext(RecentFeedbacksContext)
	const menuPortal = useContext(MenuPortalContext)
	const feedbacksContext = useContext(FeedbacksContext)
	const instancesContext = useContext(InstancesContext)

	const options = useMemo(() => {
		const options = []
		for (const [instanceId, instanceFeedbacks] of Object.entries(feedbacksContext)) {
			for (const [feedbackId, feedback] of Object.entries(instanceFeedbacks || {})) {
				if (!booleanOnly || feedback.type === 'boolean') {
					const instanceLabel = instancesContext[instanceId]?.label ?? instanceId
					options.push({
						isRecent: false,
						value: `${instanceId}:${feedbackId}`,
						label: `${instanceLabel}: ${feedback.label}`,
					})
				}
			}
		}

		const recents = []
		for (const feedbackType of recentFeedbacksContext.recentFeedbacks || []) {
			if (feedbackType) {
				const [instanceId, feedbackId] = feedbackType.split(':', 2)
				const feedbackInfo = feedbacksContext[instanceId]?.[feedbackId]
				if (feedbackInfo) {
					const instanceLabel = instancesContext[instanceId]?.label ?? instanceId
					recents.push({
						isRecent: true,
						value: `${instanceId}:${feedbackId}`,
						label: `${instanceLabel}: ${feedbackInfo.label}`,
					})
				}
			}
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [feedbacksContext, instancesContext, booleanOnly, recentFeedbacksContext.recentFeedbacks])

	const innerChange = useCallback(
		(e) => {
			if (e.value) {
				recentFeedbacksContext.trackRecentFeedback(e.value)

				onSelect(e.value)
			}
		},
		[onSelect, recentFeedbacksContext]
	)

	return (
		<Select
			menuShouldBlockScroll={!!menuPortal} // The dropdown doesn't follow scroll when in a modal
			menuPortalTarget={menuPortal || document.body}
			menuPosition={'fixed'}
			classNamePrefix="select-control"
			menuPlacement="auto"
			isClearable={false}
			isSearchable={true}
			isMulti={false}
			options={options}
			placeholder={addPlaceholder || '+ Add feedback'}
			value={null}
			onChange={innerChange}
			filterOption={filterOptions}
			noOptionsMessage={noOptionsMessage}
		/>
	)
}
