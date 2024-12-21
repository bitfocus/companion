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
import { MyErrorBoundary, PreventDefaultHandler, checkDragState } from '../util.js'
import { OptionsInputField } from './OptionsInputField.js'
import { useDrag, useDrop } from 'react-dnd'
import { GenericConfirmModal, GenericConfirmModalRef } from '../Components/GenericConfirmModal.js'
import { DropdownInputField, TextInputField } from '../Components/index.js'
import { ButtonStyleConfigFields } from './ButtonStyleConfig.js'
import { AddFeedbacksModal, AddFeedbacksModalRef } from './AddModal.js'
import { PanelCollapseHelper, usePanelCollapseHelper } from '../Helpers/CollapseHelper.js'
import { OptionButtonPreview } from './OptionButtonPreview.js'
import { ButtonStyleProperties } from '@companion-app/shared/Style.js'
import { ClientFeedbackDefinition } from '@companion-app/shared/Model/FeedbackDefinitionModel.js'
import { DropdownChoiceId } from '@companion-module/base'
import { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { useOptionsAndIsVisible } from '../Hooks/useOptionsAndIsVisible.js'
import { LearnButton } from '../Components/LearnButton.js'
import { AddFeedbackDropdown } from './AddFeedbackDropdown.js'
import { observer } from 'mobx-react-lite'
import { RootAppStoreContext } from '../Stores/RootAppStore.js'
import classNames from 'classnames'
import { InlineHelp } from '../Components/InlineHelp.js'
import { isEqual } from 'lodash-es'
import { findAllEntityIdsDeep, stringifyEntityOwnerId } from './Util.js'
import {
	EntityModelType,
	EntityOwner,
	EntitySupportedChildGroupDefinition,
	FeedbackEntityModel,
	SomeEntityModel,
} from '@companion-app/shared/Model/EntityModel.js'
import {
	useControlEntityService,
	useControlEntitiesEditorService,
	IEntityEditorService,
} from '../Services/Controls/ControlEntitiesService.js'
import { EntityDropPlaceholderZone, EntityListDragItem } from './EntityListDropZone.js'

interface ControlFeedbacksEditorProps {
	controlId: string
	feedbacks: SomeEntityModel[]
	heading: JSX.Element | string
	entityType: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
	addPlaceholder: string
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

	const feedbacksService = useControlEntitiesEditorService(
		controlId,
		'feedbacks',
		entityType,
		EntityModelType.Feedback,
		confirmModal
	)

	const feedbackIds = useMemo(() => findAllEntityIdsDeep(feedbacks), [feedbacks])

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
	feedbacks: SomeEntityModel[]
	entityType: string
	onlyType: 'boolean' | 'advanced' | null
	location: ControlLocation | undefined
	addPlaceholder: string
	feedbacksService: IEntityEditorService
	ownerId: EntityOwner | null
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
		(connectionId: string, definitionId: string) => feedbacksService.addEntity(connectionId, definitionId, ownerId),
		[feedbacksService, ownerId]
	)

	const childFeedbackIds = feedbacks.map((f) => f.id)

	const expandGroupId = stringifyEntityOwnerId(ownerId)

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
						<EntityDropPlaceholderZone
							dragId={`feedbacks_${controlId}`}
							ownerId={ownerId}
							listId="feedbacks"
							entityCount={feedbacks ? feedbacks.length : 0}
							entityType={entityType}
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

interface FeedbackTableRowDragItem extends EntityListDragItem {}
interface FeedbackTableRowDragStatus {
	isDragging: boolean
}

interface FeedbackTableRowProps {
	controlId: string
	entityType: string
	feedback: SomeEntityModel
	serviceFactory: IEntityEditorService
	index: number
	ownerId: EntityOwner | null
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
			if (item.entityId === hoverId || (dragIndex === hoverIndex && isEqual(dragOwnerId, hoverOwnerId))) {
				return
			}
			// Can't move into itself
			if (hoverOwnerId && item.entityId === hoverOwnerId.parentId) return

			// Time to actually perform the action
			serviceFactory.moveCard('feedbacks', item.entityId, hoverOwnerId, hoverIndex)

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
			entityId: feedback.id,
			listId: 'feedbacks',
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
				{feedback.type === EntityModelType.Feedback ? (
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
				) : (
					<p>Entity is not a feedback!</p>
				)}
			</td>
		</tr>
	)
}

interface FeedbackEditorProps {
	controlId: string
	ownerId: EntityOwner | null
	entityType: string
	feedback: FeedbackEntityModel
	location: ControlLocation | undefined
	serviceFactory: IEntityEditorService
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
	const service = useControlEntityService(serviceFactory, feedback)

	const { connections, feedbackDefinitions } = useContext(RootAppStoreContext)

	const connectionInfo = connections.getInfo(feedback.connectionId)
	const connectionLabel = connectionInfo?.label ?? feedback.connectionId
	const connectionsWithSameType = connectionInfo ? connections.getAllOfType(connectionInfo.instance_type) : []

	const feedbackSpec = feedbackDefinitions.connections.get(feedback.connectionId)?.get(feedback.type)

	const [feedbackOptions, optionVisibility] = useOptionsAndIsVisible(feedbackSpec?.options, feedback?.options)

	const innerSetEnabled = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => service.setEnabled?.(e.target.checked),
		[service.setEnabled]
	)

	const name = feedbackSpec
		? `${connectionLabel}: ${feedbackSpec.label}`
		: `${connectionLabel}: ${feedback.type} (undefined)`

	const showButtonPreview = feedback?.connectionId === 'internal' && feedbackSpec?.showButtonPreview

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
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(stringifyEntityOwnerId(ownerId), feedback.id)

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
						{feedbackSpec?.hasLearn && !!service.performLearn && (
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
										connectionId={feedback.connectionId}
										option={opt}
										value={(feedback.options || {})[opt.id]}
										setValue={service.setValue}
										visibility={optionVisibility[opt.id] ?? true}
									/>
								</MyErrorBoundary>
							))}
						</CForm>
					</div>

					{feedback.connectionId === 'internal' &&
						feedbackSpec?.supportsChildGroups &&
						feedbackSpec.supportsChildGroups.length > 0 && (
							<div
								className={classNames('cell-children', {
									'hide-top-gap': feedbackSpec.showInvert || feedbackOptions.length > 0, //&& (feedback.children ?? []).length > 0,
								})}
							>
								{feedbackSpec.supportsChildGroups.map((groupInfo) => (
									<FeedbackManageChildGroup
										key={groupInfo.groupId}
										controlId={controlId}
										location={location}
										groupInfo={groupInfo}
										entities={feedback.children?.[groupInfo.groupId]}
										parentId={feedback.id}
										panelCollapseHelper={panelCollapseHelper}
										serviceFactory={serviceFactory}
									/>
								))}
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
									value={feedback.connectionId}
									setValue={(val) => service.setConnection(`${val}`)}
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

interface FeedbackManageChildGroupProps {
	controlId: string
	location: ControlLocation | undefined
	groupInfo: EntitySupportedChildGroupDefinition
	entities: SomeEntityModel[] | undefined
	parentId: string
	panelCollapseHelper: PanelCollapseHelper
	serviceFactory: IEntityEditorService
}

function FeedbackManageChildGroup({
	controlId,
	location,
	groupInfo,
	entities,
	parentId,
	panelCollapseHelper,
	serviceFactory: serviceFactory0,
}: FeedbackManageChildGroupProps) {
	const groupId: EntityOwner = { parentId, childGroup: groupInfo.groupId }

	const serviceFactory = useControlEntitiesEditorService(
		controlId,
		serviceFactory0.listId,
		groupInfo.entityType,
		groupInfo.type,
		serviceFactory0.confirmModal
	)

	return (
		<CForm onSubmit={PreventDefaultHandler}>
			<InlineFeedbacksEditor
				controlId={controlId}
				heading={
					groupInfo.label ? (
						<>
							{groupInfo.label}&nbsp;
							{groupInfo.hint ? <FontAwesomeIcon icon={faQuestionCircle} title={groupInfo.hint} /> : null}
						</>
					) : null
				}
				feedbacks={entities ?? []}
				entityType={groupInfo.entityType}
				onlyType={groupInfo.booleanFeedbacksOnly ? 'boolean' : null}
				location={location}
				addPlaceholder={`+ Add ${groupInfo.entityType}`}
				feedbacksService={serviceFactory}
				ownerId={groupId}
				panelCollapseHelper={panelCollapseHelper}
			/>
		</CForm>
	)
}

interface FeedbackManageStylesProps {
	feedbackSpec: ClientFeedbackDefinition | undefined
	feedback: FeedbackEntityModel
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
	feedback: FeedbackEntityModel
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
