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
import React, { memo, useCallback, useContext, useMemo, useRef, useState } from 'react'
import {
	FeedbacksContext,
	ConnectionsContext,
	MyErrorBoundary,
	socketEmitPromise,
	SocketContext,
	PreventDefaultHandler,
	RecentFeedbacksContext,
} from '../util'
import Select, { createFilter } from 'react-select'
import { OptionsInputField } from './OptionsInputField'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal'
import { CheckboxInputField, DropdownInputField } from '../Components'
import { ButtonStyleConfigFields } from './ButtonStyleConfig'
import { AddFeedbacksModal, AddFeedbacksModalRef } from './AddModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import { OptionButtonPreview } from './OptionButtonPreview'
import { MenuPortalContext } from '../Components/DropdownInputField'
import { ButtonStyleProperties } from '@companion/shared/Style'
import { FilterOptionOption } from 'react-select/dist/declarations/src/filters'
import { FeedbackInstance } from '@companion/shared/Model/FeedbackModel'
import { InternalFeedbackDefinition } from '@companion/shared/Model/Options'
import { DropdownChoiceId } from '@companion-module/base'
import { ControlLocation } from '@companion/shared/Model/Common'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible'
import { LearnButton } from '../Components/LearnButton'

interface ControlFeedbacksEditorProps {
	controlId: string
	feedbacks: FeedbackInstance[]
	heading: JSX.Element | string
	entityType: string
	booleanOnly: boolean
	location: ControlLocation | undefined
	addPlaceholder: string
}

export function ControlFeedbacksEditor({
	controlId,
	feedbacks,
	heading,
	entityType,
	booleanOnly,
	location,
	addPlaceholder,
}: ControlFeedbacksEditorProps) {
	const socket = useContext(SocketContext)

	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const feedbacksRef = useRef<FeedbackInstance[]>()
	feedbacksRef.current = feedbacks

	const addFeedbacksRef = useRef<AddFeedbacksModalRef>(null)
	const showAddModal = useCallback(() => {
		addFeedbacksRef.current?.show()
	}, [])

	const setValue = useCallback(
		(feedbackId: string, key: string, val: any) => {
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
		(feedbackId: string, isInverted: boolean) => {
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
		(feedbackId: string) => {
			confirmModal.current?.show(`Delete ${entityType}`, `Delete ${entityType}?`, 'Delete', () => {
				socketEmitPromise(socket, 'controls:feedback:remove', [controlId, feedbackId]).catch((e) => {
					console.error(`Failed to delete feedback: ${e}`)
				})
			})
		},
		[socket, controlId, entityType]
	)

	const doDuplicate = useCallback(
		(feedbackId: string) => {
			socketEmitPromise(socket, 'controls:feedback:duplicate', [controlId, feedbackId]).catch((e) => {
				console.error(`Failed to duplicate feedback: ${e}`)
			})
		},
		[socket, controlId]
	)

	const doLearn = useCallback(
		(feedbackId: string) => {
			socketEmitPromise(socket, 'controls:feedback:learn', [controlId, feedbackId]).catch((e) => {
				console.error(`Failed to learn feedback values: ${e}`)
			})
		},
		[socket, controlId]
	)

	const addFeedback = useCallback(
		(feedbackType: string) => {
			const [connectionId, feedbackId] = feedbackType.split(':', 2)
			socketEmitPromise(socket, 'controls:feedback:add', [controlId, connectionId, feedbackId]).catch((e) => {
				console.error('Failed to add control feedback', e)
			})
		},
		[socket, controlId]
	)

	const moveCard = useCallback(
		(dragIndex: number, hoverIndex: number) => {
			socketEmitPromise(socket, 'controls:feedback:reorder', [controlId, dragIndex, hoverIndex]).catch((e) => {
				console.error(`Move failed: ${e}`)
			})
		},
		[socket, controlId]
	)

	const emitEnabled = useCallback(
		(feedbackId: string, enabled: boolean) => {
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

interface FeedbackTableRowDragItem {
	feedbackId: string
	index: number
}
interface FeedbackTableRowDragStatus {
	isDragging: boolean
}

interface FeedbackTableRowProps {
	entityType: string
	feedback: FeedbackInstance
	controlId: string
	index: number
	dragId: string
	moveCard: (dragIndex: number, hoverIndex: number) => void
	setValue: (feedbackId: string, key: string, val: any) => void
	setInverted: (feedbackId: string, inverted: boolean) => void
	doDelete: (feedbackId: string) => void
	doDuplicate: (feedbackId: string) => void
	doLearn: (feedbackId: string) => void
	doEnabled: (feedbackId: string, enabled: boolean) => void
	isCollapsed: boolean
	setCollapsed: (feedbackId: string, collapsed: boolean) => void
	booleanOnly: boolean
	location: ControlLocation | undefined
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
}: FeedbackTableRowProps) {
	const socket = useContext(SocketContext)

	const innerDelete = useCallback(() => doDelete(feedback.id), [feedback.id, doDelete])
	const innerDuplicate = useCallback(() => doDuplicate(feedback.id), [feedback.id, doDuplicate])
	const innerLearn = useCallback(() => doLearn(feedback.id), [doLearn, feedback.id])
	const innerInverted = useCallback((isInverted) => setInverted(feedback.id, isInverted), [feedback.id, setInverted])

	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<FeedbackTableRowDragItem>({
		accept: dragId,
		hover(item, _monitor) {
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
	const [{ isDragging }, drag, preview] = useDrag<FeedbackTableRowDragItem, unknown, FeedbackTableRowDragStatus>({
		type: dragId,
		item: {
			feedbackId: feedback.id,
			index: index,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

	const setSelectedStyleProps = useCallback(
		(selected: string[]) => {
			socketEmitPromise(socket, 'controls:feedback:set-style-selection', [controlId, feedback.id, selected]).catch(
				(e) => {
					console.error(`Failed: ${e}`)
				}
			)
		},
		[socket, controlId, feedback.id]
	)

	const setStylePropsValue = useCallback(
		(key: string, value: any) => {
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
		return null
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

interface FeedbackEditorProps {
	entityType: string
	feedback: FeedbackInstance
	location: ControlLocation | undefined
	setValue: (feedbackId: string, key: string, value: any) => void
	setInverted: (inverted: boolean) => void
	innerDelete: () => void
	innerDuplicate: () => void
	innerLearn: () => void
	setSelectedStyleProps: (keys: string[]) => void
	setStylePropsValue: (key: string, value: any) => void
	isCollapsed: boolean
	doCollapse: () => void
	doExpand: () => void
	doEnabled: (feedbackId: string, enabled: boolean) => void
	booleanOnly: boolean
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
}: FeedbackEditorProps) {
	const feedbacksContext = useContext(FeedbacksContext)
	const connectionsContext = useContext(ConnectionsContext)

	const connectionInfo = connectionsContext[feedback.instance_id]
	const connectionLabel = connectionInfo?.label ?? feedback.instance_id

	const feedbackSpec = (feedbacksContext[feedback.instance_id] || {})[feedback.type]

	const [feedbackOptions, optionVisibility] = useOptionsAndIsVisible(feedbackSpec, feedback)

	const innerSetEnabled = useCallback((e) => doEnabled(feedback.id, e.target.checked), [doEnabled, feedback.id])

	const name = feedbackSpec
		? `${connectionLabel}: ${feedbackSpec.label}`
		: `${connectionLabel}: ${feedback.type} (undefined)`

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
						{!!doEnabled && (
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
						<div className="cell-button-preview">
							<OptionButtonPreview location={location} options={feedback.options} />
						</div>
					)}

					<div className="cell-actions">
						{feedbackSpec?.hasLearn && <LearnButton id={feedback.id} doLearn={innerLearn} />}
					</div>

					<div className="cell-option">
						<CForm onSubmit={PreventDefaultHandler}>
							{feedbackOptions.map((opt, i) => (
								<MyErrorBoundary key={i}>
									<OptionsInputField
										key={i}
										isOnControl={!!location}
										isAction={false}
										connectionId={feedback.instance_id}
										option={opt}
										actionId={feedback.id}
										value={(feedback.options || {})[opt.id]}
										setValue={setValue}
										visibility={optionVisibility[opt.id] ?? true}
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
											<CheckboxInputField value={!!feedback.isInverted} setValue={setInverted} />
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

interface FeedbackManageStylesProps {
	feedbackSpec: InternalFeedbackDefinition | undefined
	feedback: FeedbackInstance
	setSelectedStyleProps: (keys: string[]) => void
}

function FeedbackManageStyles({ feedbackSpec, feedback, setSelectedStyleProps }: FeedbackManageStylesProps) {
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
								setValue={setSelectedStyleProps as (keys: DropdownChoiceId[]) => void}
								value={currentValue}
							/>
						</CFormGroup>
					</MyErrorBoundary>
				</CForm>
			</div>
		)
	} else {
		return null
	}
}

interface FeedbackStylesProps {
	feedbackSpec: InternalFeedbackDefinition | undefined
	feedback: FeedbackInstance
	setStylePropsValue: (key: string, value: any) => void
}

function FeedbackStyles({ feedbackSpec, feedback, setStylePropsValue }: FeedbackStylesProps) {
	const [pngError, setPngError] = useState<string | null>(null)
	const clearPngError = useCallback(() => setPngError(null), [])
	const setPng = useCallback(
		(data) => {
			setPngError(null)
			setStylePropsValue('png64', data)
		},
		[setStylePropsValue]
	)
	const clearPng = useCallback(() => {
		setPngError(null)
		setStylePropsValue('png64', null)
	}, [setStylePropsValue])

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
						setValueInner={setStylePropsValue}
						setPng={setPng}
						clearPng={clearPng}
						setPngError={clearPngError}
						showField={showField}
					/>
					{Object.keys(currentStyle).length === 0 ? 'Feedback has no effect. Try adding a property to override' : ''}
				</CForm>
			</div>
		)
	} else {
		return null
	}
}

const baseFilter = createFilter<AddFeedbackOption>()
const filterOptions = (candidate: FilterOptionOption<AddFeedbackOption>, input: string) => {
	if (input) {
		return !candidate.data.isRecent && baseFilter(candidate, input)
	} else {
		return candidate.data.isRecent
	}
}

const noOptionsMessage = ({ inputValue }: { inputValue: string }) => {
	if (inputValue) {
		return 'No feedbacks found'
	} else {
		return 'No recently used feedbacks'
	}
}

interface AddFeedbackOption {
	isRecent: boolean
	value: string
	label: string
}
interface AddFeedbackGroup {
	label: string
	options: AddFeedbackOption[]
}

interface AddFeedbackDropdownProps {
	onSelect: (feedbackType: string) => void
	booleanOnly: boolean
	addPlaceholder: string
}

const AddFeedbackDropdown = memo(function AddFeedbackDropdown({
	onSelect,
	booleanOnly,
	addPlaceholder,
}: AddFeedbackDropdownProps) {
	const recentFeedbacksContext = useContext(RecentFeedbacksContext)
	const menuPortal = useContext(MenuPortalContext)
	const feedbacksContext = useContext(FeedbacksContext)
	const connectionsContext = useContext(ConnectionsContext)

	const options = useMemo(() => {
		const options: Array<AddFeedbackOption | AddFeedbackGroup> = []
		for (const [connectionId, instanceFeedbacks] of Object.entries(feedbacksContext)) {
			for (const [feedbackId, feedback] of Object.entries(instanceFeedbacks || {})) {
				if (!feedback) continue
				if (!booleanOnly || feedback.type === 'boolean') {
					const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
					options.push({
						isRecent: false,
						value: `${connectionId}:${feedbackId}`,
						label: `${connectionLabel}: ${feedback.label}`,
					})
				}
			}
		}

		const recents: AddFeedbackOption[] = []
		for (const feedbackType of recentFeedbacksContext?.recentFeedbacks ?? []) {
			if (feedbackType) {
				const [connectionId, feedbackId] = feedbackType.split(':', 2)
				const feedbackInfo = feedbacksContext[connectionId]?.[feedbackId]
				if (feedbackInfo) {
					const connectionLabel = connectionsContext[connectionId]?.label ?? connectionId
					recents.push({
						isRecent: true,
						value: `${connectionId}:${feedbackId}`,
						label: `${connectionLabel}: ${feedbackInfo.label}`,
					})
				}
			}
		}
		options.push({
			label: 'Recently Used',
			options: recents,
		})

		return options
	}, [feedbacksContext, connectionsContext, booleanOnly, recentFeedbacksContext?.recentFeedbacks])

	const innerChange = useCallback(
		(e: AddFeedbackOption | null) => {
			if (e?.value) {
				recentFeedbacksContext?.trackRecentFeedback(e.value)

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
})
