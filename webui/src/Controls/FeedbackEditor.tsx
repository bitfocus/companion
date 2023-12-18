import { CAlert, CButton, CForm, CFormGroup, CButtonGroup, CSwitch, CLabel } from '@coreui/react'
import {
	faSort,
	faTrash,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faCopy,
	faFolderOpen,
	faQuestionCircle,
	faPencil,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { FeedbacksContext, ConnectionsContext, MyErrorBoundary, PreventDefaultHandler } from '../util'
import { OptionsInputField } from './OptionsInputField'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal'
import { CheckboxInputField, DropdownInputField, TextInputField } from '../Components'
import { ButtonStyleConfigFields } from './ButtonStyleConfig'
import { AddFeedbacksModal, AddFeedbacksModalRef } from './AddModal'
import { usePanelCollapseHelper } from '../Helpers/CollapseHelper'
import { OptionButtonPreview } from './OptionButtonPreview'
import { ButtonStyleProperties } from '@companion/shared/Style'
import { FeedbackInstance } from '@companion/shared/Model/FeedbackModel'
import { InternalFeedbackDefinition } from '@companion/shared/Model/Options'
import { DropdownChoiceId } from '@companion-module/base'
import { ControlLocation } from '@companion/shared/Model/Common'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible'
import { LearnButton } from '../Components/LearnButton'
import { AddFeedbackDropdown } from './AddFeedbackDropdown'
import {
	IFeedbackEditorFeedbackService,
	IFeedbackEditorService,
	useControlFeedbackService,
	useControlFeedbacksEditorService,
} from '../Services/Controls/ControlFeedbacksService'

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
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const feedbacksService = useControlFeedbacksEditorService(controlId, confirmModal, entityType)

	const addFeedbacksRef = useRef<AddFeedbacksModalRef>(null)
	const showAddModal = useCallback(() => addFeedbacksRef.current?.show(), [])

	const feedbackIds = useMemo(() => feedbacks.map((fb) => fb.id), [feedbacks])
	const { setPanelCollapsed, isPanelCollapsed, setAllCollapsed, setAllExpanded, canExpandAll, canCollapseAll } =
		usePanelCollapseHelper(`feedbacks_${controlId}`, feedbackIds)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<MyErrorBoundary>
				<AddFeedbacksModal ref={addFeedbacksRef} addFeedback={feedbacksService.addFeedback} booleanOnly={booleanOnly} />
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
								feedback={a}
								dragId={`feedback_${controlId}`}
								serviceFactory={feedbacksService}
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
				<AddFeedbackDropdown
					onSelect={feedbacksService.addFeedback}
					booleanOnly={booleanOnly}
					addPlaceholder={addPlaceholder}
				/>
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
	serviceFactory: IFeedbackEditorService
	index: number
	dragId: string
	isCollapsed: boolean
	setCollapsed: (feedbackId: string, collapsed: boolean) => void
	booleanOnly: boolean
	location: ControlLocation | undefined
}

function FeedbackTableRow({
	entityType,
	feedback,
	serviceFactory,
	index,
	dragId,
	isCollapsed,
	setCollapsed,
	booleanOnly,
	location,
}: FeedbackTableRowProps) {
	const service = useControlFeedbackService(serviceFactory, feedback)

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
			serviceFactory.moveCard(dragIndex, hoverIndex)

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

	const doCollapse = useCallback(() => setCollapsed(feedback.id, true), [setCollapsed, feedback.id])
	const doExpand = useCallback(() => setCollapsed(feedback.id, false), [setCollapsed, feedback.id])

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
					service={service}
					isCollapsed={isCollapsed}
					doCollapse={doCollapse}
					doExpand={doExpand}
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
	service: IFeedbackEditorFeedbackService
	isCollapsed: boolean
	doCollapse: () => void
	doExpand: () => void
	booleanOnly: boolean
}

function FeedbackEditor({
	entityType,
	feedback,
	location,
	service,
	isCollapsed,
	doCollapse,
	doExpand,
	booleanOnly,
}: FeedbackEditorProps) {
	const feedbacksContext = useContext(FeedbacksContext)
	const connectionsContext = useContext(ConnectionsContext)

	const connectionInfo = connectionsContext[feedback.instance_id]
	const connectionLabel = connectionInfo?.label ?? feedback.instance_id

	const feedbackSpec = (feedbacksContext[feedback.instance_id] || {})[feedback.type]

	const [feedbackOptions, optionVisibility] = useOptionsAndIsVisible(feedbackSpec, feedback)

	const innerSetEnabled = useCallback((e) => service.setEnabled(e.target.checked), [service.setEnabled])

	const name = feedbackSpec
		? `${connectionLabel}: ${feedbackSpec.label}`
		: `${connectionLabel}: ${feedback.type} (undefined)`

	const showButtonPreview = feedback?.instance_id === 'internal' && feedbackSpec?.showButtonPreview

	const canSetHeadline = !!service.setHeadline
	const headline = feedback.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	return (
		<>
			<div className="editor-grid-header remove075right">
				<div className="cell-name">
					{!service.setHeadline || !headlineExpanded || isCollapsed ? (
						headline || name
					) : (
						<TextInputField
							value={headline ?? ''}
							placeholder={'Describe the intent of the feedback'}
							setValue={service.setHeadline}
						/>
					)}
				</div>

				<div className="cell-controls">
					<CButtonGroup>
						{canSetHeadline && !headlineExpanded && (
							<CButton size="sm" onClick={doEditHeadline} title="Set headline">
								<FontAwesomeIcon icon={faPencil} />
							</CButton>
						)}
						{isCollapsed ? (
							<CButton size="sm" onClick={doExpand} title={`Expand ${entityType} view`}>
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</CButton>
						) : (
							<CButton size="sm" onClick={doCollapse} title={`Collapse ${entityType} view`}>
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</CButton>
						)}
						<CButton size="sm" onClick={service.performDuplicate} title={`Duplicate ${entityType}`}>
							<FontAwesomeIcon icon={faCopy} />
						</CButton>
						<CButton size="sm" onClick={service.performDelete} title={`Remove ${entityType}`}>
							<FontAwesomeIcon icon={faTrash} />
						</CButton>
						{!!service.setEnabled && (
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
					<div className="cell-description">
						{headlineExpanded && <p className="name">{name}</p>}
						{feedbackSpec?.description || ''}
					</div>

					{location && showButtonPreview && (
						<div className="cell-button-preview">
							<OptionButtonPreview location={location} options={feedback.options} />
						</div>
					)}

					<div className="cell-actions">
						{feedbackSpec?.hasLearn && <LearnButton id={feedback.id} doLearn={service.performLearn} />}
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
										value={(feedback.options || {})[opt.id]}
										setValue={service.setValue}
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
											<CheckboxInputField value={!!feedback.isInverted} setValue={service.setInverted} />
											&nbsp;
										</p>
									</CFormGroup>
								</CForm>
							</MyErrorBoundary>
						</div>
					)}

					{!booleanOnly && (
						<>
							<FeedbackStyles
								feedbackSpec={feedbackSpec}
								feedback={feedback}
								setStylePropsValue={service.setStylePropsValue}
							/>
							<FeedbackManageStyles
								feedbackSpec={feedbackSpec}
								feedback={feedback}
								setSelectedStyleProps={service.setSelectedStyleProps}
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
