import { CAlert, CButton, CForm, CButtonGroup, CFormSwitch } from '@coreui/react'
import {
	faSort,
	faTrash,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faCopy,
	faFolderOpen,
	faPencil,
	faQuestionCircle,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import React, { useCallback, useContext, useMemo, useRef, useState } from 'react'
import { DragState, MyErrorBoundary, PreventDefaultHandler, checkDragState } from '../util.js'
import { OptionsInputField } from './OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { DropdownInputField, TextInputField } from '../Components/index.js'
import { ButtonStyleConfigFields } from './ButtonStyleConfig.js'
import { AddFeedbacksModal, AddFeedbacksModalRef } from './AddModal.js'
import { PanelCollapseHelper, usePanelCollapseHelper } from '../Helpers/CollapseHelper.js'
import { OptionButtonPreview } from './OptionButtonPreview.js'
import { ButtonStyleProperties } from '@companion-app/shared/Style.js'
import { FeedbackInstance, FeedbackOwner } from '@companion-app/shared/Model/FeedbackModel.js'
import { ClientFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import { DropdownChoiceId } from '@companion-module/base'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { LearnButton } from '../Components/LearnButton.js'
import { AddFeedbackDropdown } from './AddFeedbackDropdown.js'
import {
	IFeedbackEditorService,
	useControlFeedbackService,
	useControlFeedbacksEditorService,
} from '../Services/Controls/ControlFeedbacksService.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import classNames from 'classnames'
import { InlineHelp } from '../Components/InlineHelp.js'
import { isEqual } from 'lodash-es'
interface ControlFeedbacksEditorProps {
	controlId: string
	feedbacks: FeedbackInstance[]
	heading: JSX.Element | string
	entityType: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
	addPlaceholder: string
}

function findAllFeedbackIdsDeep(feedbacks: FeedbackInstance[]): string[] {
	const result: string[] = feedbacks.map((f) => f.id)

	for (const feedback of feedbacks) {
		if (feedback.children) {
			result.push(...findAllFeedbackIdsDeep(feedback.children))
		}
		if (feedback.advancedChildren) {
			result.push(...findAllFeedbackIdsDeep(feedback.advancedChildren))
		}
	}

	return result
}

export function ControlFeedbacksEditor({
	controlId,
	feedbacks,
	heading,
	entityType,
	onlyType,
	location,
	addPlaceholder,
}: ControlFeedbacksEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const feedbacksService = useControlFeedbacksEditorService(controlId, confirmModal, entityType)

	const feedbackIds = useMemo(() => findAllFeedbackIdsDeep(feedbacks), [feedbacks])

	const panelCollapseHelper = usePanelCollapseHelper(`feedbacks_${controlId}`, feedbackIds)

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<InlineFeedbacksEditor
				controlId={controlId}
				heading={heading}
				feedbacks={feedbacks}
				entityType={entityType}
				onlyType={onlyType}
				location={location}
				addPlaceholder={addPlaceholder}
				feedbacksService={feedbacksService}
				ownerId={null}
				panelCollapseHelper={panelCollapseHelper}
			/>
		</>
	)
}

interface InlineFeedbacksEditorProps {
	controlId: string
	heading: JSX.Element | string | null
	feedbacks: FeedbackInstance[]
	entityType: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
	addPlaceholder: string
	feedbacksService: IFeedbackEditorService
	ownerId: FeedbackOwner | null
	panelCollapseHelper: PanelCollapseHelper
}

const InlineFeedbacksEditor = observer(function InlineFeedbacksEditor({
	controlId,
	heading,
	feedbacks,
	entityType,
	onlyType,
	location,
	addPlaceholder,
	feedbacksService,
	ownerId,
	panelCollapseHelper,
}: InlineFeedbacksEditorProps) {
	const addFeedbacksRef = useRef<AddFeedbacksModalRef>(null)
	const showAddModal = useCallback(() => addFeedbacksRef.current?.show(), [])

	const addFeedback = useCallback(
		(feedbackType: string) => feedbacksService.addFeedback(feedbackType, ownerId),
		[feedbacksService, ownerId]
	)

	const childFeedbackIds = feedbacks.map((f) => f.id)

	const expandGroupId = feedbackOwnerString(ownerId)

	return (
		<>
			<MyErrorBoundary>
				<AddFeedbacksModal
					ref={addFeedbacksRef}
					addFeedback={addFeedback}
					onlyType={onlyType}
					entityType={entityType}
				/>
			</MyErrorBoundary>

			<h4 className="mt-3">
				{heading}

				{feedbacks.length >= 1 && (
					<CButtonGroup className="right">
						<CButtonGroup>
							{panelCollapseHelper.canExpandAll(expandGroupId, childFeedbackIds) && (
								<CButton
									size="sm"
									onClick={() => panelCollapseHelper.setAllExpanded(expandGroupId, childFeedbackIds)}
									title="Expand all feedbacks"
								>
									<FontAwesomeIcon icon={faExpandArrowsAlt} />
								</CButton>
							)}
							{panelCollapseHelper.canCollapseAll(expandGroupId, childFeedbackIds) && (
								<CButton
									size="sm"
									onClick={() => panelCollapseHelper.setAllCollapsed(expandGroupId, childFeedbackIds)}
									title="Collapse all feedbacks"
								>
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
								controlId={controlId}
								ownerId={ownerId}
								entityType={entityType}
								index={i}
								feedback={a}
								dragId={`feedbacks_${controlId}`}
								serviceFactory={feedbacksService}
								panelCollapseHelper={panelCollapseHelper}
								onlyType={onlyType}
								location={location}
							/>
						</MyErrorBoundary>
					))}
					{!!ownerId && (
						<FeedbackRowDropPlaceholder
							dragId={`feedbacks_${controlId}`}
							ownerId={ownerId}
							feedbackCount={feedbacks ? feedbacks.length : 0}
							moveCard={feedbacksService.moveCard}
						/>
					)}
				</tbody>
			</table>

			<div className="add-dropdown-wrapper">
				<AddFeedbackDropdown onSelect={addFeedback} onlyType={onlyType} addPlaceholder={addPlaceholder} />
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
})

interface FeedbackTableRowDragItem {
	feedbackId: string
	index: number
	ownerId: FeedbackOwner | null
	dragState: DragState | null
}
interface FeedbackTableRowDragStatus {
	isDragging: boolean
}

interface FeedbackTableRowProps {
	controlId: string
	entityType: string
	feedback: FeedbackInstance
	serviceFactory: IFeedbackEditorService
	index: number
	ownerId: FeedbackOwner | null
	dragId: string
	panelCollapseHelper: PanelCollapseHelper
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
}

function FeedbackTableRow({
	controlId,
	entityType,
	feedback,
	serviceFactory,
	index,
	ownerId,
	dragId,
	panelCollapseHelper,
	onlyType,
	location,
}: FeedbackTableRowProps) {
	const ref = useRef<HTMLTableRowElement>(null)
	const [, drop] = useDrop<FeedbackTableRowDragItem>({
		accept: dragId,
		hover(item, monitor) {
			if (!ref.current) {
				return
			}

			// Ensure the hover targets this element, and not a child element
			if (!monitor.isOver({ shallow: true })) return

			const dragOwnerId = item.ownerId
			const dragIndex = item.index

			const hoverOwnerId = ownerId
			const hoverIndex = index
			const hoverId = feedback.id

			if (!checkDragState(item, monitor, hoverId)) return

			// Don't replace items with themselves
			if (item.feedbackId === hoverId || (dragIndex === hoverIndex && isEqual(dragOwnerId, hoverOwnerId))) {
				return
			}
			// Can't move into itself
			if (hoverOwnerId && item.feedbackId === hoverOwnerId.parentFeedbackId) return

			// Time to actually perform the action
			serviceFactory.moveCard(item.feedbackId, hoverOwnerId, hoverIndex)

			// Note: we're mutating the monitor item here!
			// Generally it's better to avoid mutations,
			// but it's good here for the sake of performance
			// to avoid expensive index searches.
			item.index = hoverIndex
			item.ownerId = hoverOwnerId
		},
		drop(item, _monitor) {
			item.dragState = null
		},
	})
	const [{ isDragging }, drag, preview] = useDrag<FeedbackTableRowDragItem, unknown, FeedbackTableRowDragStatus>({
		type: dragId,
		item: {
			feedbackId: feedback.id,
			index: index,
			ownerId: ownerId,
			dragState: null,
		},
		collect: (monitor) => ({
			isDragging: monitor.isDragging(),
		}),
	})
	preview(drop(ref))

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
					controlId={controlId}
					ownerId={ownerId}
					entityType={entityType}
					location={location}
					feedback={feedback}
					serviceFactory={serviceFactory}
					panelCollapseHelper={panelCollapseHelper}
					onlyType={onlyType}
				/>
			</td>
		</tr>
	)
}

interface FeedbackEditorProps {
	controlId: string
	ownerId: FeedbackOwner | null
	entityType: string
	feedback: FeedbackInstance
	location: ControlLocation | undefined
	serviceFactory: IFeedbackEditorService
	panelCollapseHelper: PanelCollapseHelper
	onlyType: 'boolean' | 'advanced' | null
}

const FeedbackEditor = observer(function FeedbackEditor({
	controlId,
	ownerId,
	entityType,
	feedback,
	location,
	serviceFactory,
	panelCollapseHelper,
	onlyType,
}: FeedbackEditorProps) {
	const service = useControlFeedbackService(serviceFactory, feedback)

	const { connections, feedbackDefinitions } = useContext(RootAppStoreContext)

	const connectionInfo = connections.getInfo(feedback.instance_id)
	const connectionLabel = connectionInfo?.label ?? feedback.instance_id
	const connectionsWithSameType = connectionInfo ? connections.getAllOfType(connectionInfo.instance_type) : []

	const feedbackSpec = feedbackDefinitions.connections.get(feedback.instance_id)?.get(feedback.type)

	const [feedbackOptions, optionVisibility] = useOptionsAndIsVisible(feedbackSpec?.options, feedback?.options)

	const innerSetEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => service.setEnabled(e.target.checked),
		[service.setEnabled]
	)

	const name = feedbackSpec
		? `${connectionLabel}: ${feedbackSpec.label}`
		: `${connectionLabel}: ${feedback.type} (undefined)`

	const showButtonPreview = feedback?.instance_id === 'internal' && feedbackSpec?.showButtonPreview

	const canSetHeadline = !!service.setHeadline
	const headline = feedback.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	const doCollapse = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(feedback.id, true),
		[panelCollapseHelper, feedback.id]
	)
	const doExpand = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(feedback.id, false),
		[panelCollapseHelper, feedback.id]
	)
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(feedbackOwnerString(ownerId), feedback.id)

	const childrenGroupId: FeedbackOwner = { parentFeedbackId: feedback.id, childGroup: 'children' }
	const advancedChildrenGroupId: FeedbackOwner = { parentFeedbackId: feedback.id, childGroup: 'advancedChildren' }

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
						{canSetHeadline && !headlineExpanded && !isCollapsed && (
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
								<CFormSwitch
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
					<div
						className={classNames('cell-description', {
							'no-options': feedbackOptions.length === 0,
						})}
					>
						{headlineExpanded && <div className="name">{name}</div>}
						{feedbackSpec?.description && <div className="description">{feedbackSpec?.description || ''}</div>}
					</div>

					{showButtonPreview && (
						<div className="cell-button-preview">
							<OptionButtonPreview location={location} options={feedback.options} />
						</div>
					)}

					<div className="cell-actions">
						{feedbackSpec?.hasLearn && (
							<div style={{ marginTop: 10 }}>
								<LearnButton id={feedback.id} doLearn={service.performLearn} />
							</div>
						)}
					</div>

					<div className="cell-option">
						<CForm onSubmit={PreventDefaultHandler}>
							{feedbackOptions.map((opt, i) => (
								<MyErrorBoundary key={i}>
									<OptionsInputField
										key={i}
										isLocatedInGrid={!!location}
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

					{feedback.instance_id === 'internal' && feedbackSpec?.supportsChildFeedbacks && (
						<div
							className={classNames('cell-children', {
								'hide-top-gap':
									(feedbackSpec.showInvert || feedbackOptions.length > 0) && (feedback.children ?? []).length > 0,
							})}
						>
							<CForm onSubmit={PreventDefaultHandler}>
								<InlineFeedbacksEditor
									controlId={controlId}
									heading={
										feedbackSpec.supportsAdvancedChildFeedbacks ? (
											<>
												Conditions&nbsp;
												<FontAwesomeIcon
													icon={faQuestionCircle}
													title="This feedback will only execute when all of the conditions are true"
												/>
											</>
										) : null
									}
									feedbacks={feedback.children ?? []}
									entityType="condition"
									onlyType={'boolean'}
									location={location}
									addPlaceholder="+ Add condition"
									feedbacksService={serviceFactory}
									ownerId={childrenGroupId}
									panelCollapseHelper={panelCollapseHelper}
								/>
							</CForm>

							{feedbackSpec.supportsAdvancedChildFeedbacks && (
								<>
									<CForm onSubmit={PreventDefaultHandler} className="mt-2">
										<InlineFeedbacksEditor
											controlId={controlId}
											heading={
												<>
													Feedbacks&nbsp;
													<FontAwesomeIcon
														icon={faQuestionCircle}
														title="These feedbacks will only be shown if the conditions above are met"
													/>
												</>
											}
											feedbacks={feedback.advancedChildren ?? []}
											entityType="feedback"
											onlyType={'advanced'}
											location={location}
											addPlaceholder="+ Add feedback"
											feedbacksService={serviceFactory}
											ownerId={advancedChildrenGroupId}
											panelCollapseHelper={panelCollapseHelper}
										/>
									</CForm>
								</>
							)}
						</div>
					)}

					<div className="cell-left-main">
						{connectionsWithSameType.length > 1 && (
							<div className="option-field">
								<DropdownInputField
									label="Connection"
									choices={connectionsWithSameType
										.sort((connectionA, connectionB) => connectionA[1].sortOrder - connectionB[1].sortOrder)
										.map((connection) => {
											const [id, info] = connection
											return { id, label: info.label }
										})}
									multiple={false}
									value={feedback.instance_id}
									setValue={service.setConnection}
								></DropdownInputField>
							</div>
						)}
						{feedbackSpec?.type === 'boolean' && feedbackSpec.showInvert !== false && (
							<MyErrorBoundary>
								<CForm onSubmit={PreventDefaultHandler}>
									<div style={{ paddingLeft: 20 }}>
										<CFormSwitch
											label={
												<InlineHelp help="If checked, the behaviour of this feedback is inverted">Invert</InlineHelp>
											}
											color="success"
											checked={!!feedback.isInverted}
											size="xl"
											onChange={(e) => service.setInverted(e.currentTarget.checked)}
										/>
									</div>
								</CForm>
							</MyErrorBoundary>
						)}
					</div>

					{onlyType === null && (
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
})

interface FeedbackManageStylesProps {
	feedbackSpec: ClientFeedbackDefinition | undefined
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
						<DropdownInputField
							label="Change style properties"
							multiple={true}
							choices={ButtonStyleProperties}
							setValue={setSelectedStyleProps as (keys: DropdownChoiceId[]) => void}
							value={currentValue}
						/>
					</MyErrorBoundary>
				</CForm>
			</div>
		)
	} else {
		return null
	}
}

interface FeedbackStylesProps {
	feedbackSpec: ClientFeedbackDefinition | undefined
	feedback: FeedbackInstance
	setStylePropsValue: (key: string, value: any) => void
}

function FeedbackStyles({ feedbackSpec, feedback, setStylePropsValue }: FeedbackStylesProps) {
	const [pngError, setPngError] = useState<string | null>(null)
	const clearPngError = useCallback(() => setPngError(null), [])
	const setPng = useCallback(
		(data: string | null) => {
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
	const showField = useCallback((id: string) => id in currentStyle, [currentStyle])

	if (feedbackSpec?.type === 'boolean') {
		return (
			<div className="cell-styles">
				<CForm onSubmit={PreventDefaultHandler}>
					{pngError && (
						<CAlert color="warning" dismissible>
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

interface FeedbackRowDropPlaceholderProps {
	dragId: string
	ownerId: FeedbackOwner
	feedbackCount: number
	moveCard: (dragFeedbackId: string, hoverOwnerId: FeedbackOwner | null, hoverIndex: number) => void
}

function FeedbackRowDropPlaceholder({ dragId, ownerId, feedbackCount, moveCard }: FeedbackRowDropPlaceholderProps) {
	const [isDragging, drop] = useDrop<FeedbackTableRowDragItem, unknown, boolean>({
		accept: dragId,
		collect: (monitor) => {
			return monitor.canDrop()
		},
		hover(item, _monitor) {
			// Can't move into itself
			if (isEqual(item.feedbackId, ownerId)) return

			moveCard(item.feedbackId, ownerId, 0)
		},
	})

	if (!isDragging || feedbackCount > 0) return null

	return (
		<tr ref={drop} className={'feedbacklist-dropzone'}>
			<td colSpan={3}>
				<p>Drop feedback here</p>
			</td>
		</tr>
	)
}

function feedbackOwnerString(ownerId: FeedbackOwner | null): string | null {
	return ownerId ? `${ownerId.parentFeedbackId}_${ownerId.childGroup}` : null
}
