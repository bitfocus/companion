import { useDragDropMonitor } from '@dnd-kit/react'
import { isSortable, useSortable } from '@dnd-kit/react/sortable'
import {
	faClone,
	faCompressArrowsAlt,
	faExpandArrowsAlt,
	faPencil,
	faSort,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import classNames from 'classnames'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useMemo, useRef, useState } from 'react'
import type { JsonValue } from 'type-fest'
import type { EventInstance } from '@companion-app/shared/Model/EventModel.js'
import { optionsObjectToExpressionOptions, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { Button, ButtonGroup } from '~/Components/Button'
import { Form } from '~/Components/Form.js'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Grid } from '~/Components/Grid'
import { SwitchInputField } from '~/Components/SwitchInputField.js'
import { TextInputFieldSimple } from '~/Components/TextInputField.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { OptionsInputField } from '~/Controls/OptionsInputField.js'
import { usePanelCollapseHelperLite, type PanelCollapseHelperLite } from '~/Helpers/CollapseHelper.js'
import { useOptionsVisibility } from '~/Hooks/useOptionsAndIsVisible.js'
import { MyErrorBoundary } from '~/Resources/Error.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import {
	useControlEventsEditorService,
	useControlEventService,
	type IEventEditorEventService,
	type IEventEditorService,
} from '~/Services/Controls/ControlEventsService.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { AddEventDropdown } from './AddEventDropdown.js'

interface TriggerEventEditorProps {
	controlId: string
	events: EventInstance[]
	heading: JSX.Element | string
	subheading?: React.ReactNode
	localVariablesStore: LocalVariablesStore
}

export const TriggerEventEditor = observer(function TriggerEventEditor({
	controlId,
	events,
	heading,
	subheading,
	localVariablesStore,
}: TriggerEventEditorProps) {
	const confirmModal = useRef<GenericConfirmModalRef>(null)

	const eventsService = useControlEventsEditorService(controlId, confirmModal)

	const eventIds = useMemo(() => events.map((ev) => ev.id), [events])
	const panelCollapseHelper = usePanelCollapseHelperLite(`events_${controlId}`, eventIds)

	const dragId = `events_${controlId}`
	useDragDropMonitor({
		onDragEnd(event) {
			if (event.canceled) return
			const { source } = event.operation
			if (!source || source.type !== dragId || !isSortable(source)) return
			const { initialIndex, index } = source
			if (initialIndex === index) return
			eventsService.moveCard(initialIndex, index)
		},
	})

	return (
		<>
			<GenericConfirmModal ref={confirmModal} />

			<h5 className="mt-2">
				{heading}
				{events.length > 1 && (
					<ButtonGroup className="right">
						{panelCollapseHelper.canExpandAll() && (
							<Button size="sm" onClick={panelCollapseHelper.setAllExpanded} title="Expand all events">
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</Button>
						)}
						{panelCollapseHelper.canCollapseAll() && (
							<Button size="sm" onClick={panelCollapseHelper.setAllCollapsed} title="Collapse all events">
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</Button>
						)}
					</ButtonGroup>
				)}
			</h5>
			{subheading}

			<div className="entity-list">
				{events.map((a, i) => (
					<MyErrorBoundary key={a?.id ?? i}>
						<EventsTableRow
							key={a?.id ?? i}
							index={i}
							event={a}
							dragId={dragId}
							serviceFactory={eventsService}
							panelCollapseHelper={panelCollapseHelper}
							localVariablesStore={localVariablesStore}
						/>
					</MyErrorBoundary>
				))}
			</div>

			<div className="add-dropdown-wrapper">
				<AddEventDropdown onSelect={eventsService.addEvent} />
			</div>
		</>
	)
})

interface EventEditorRowContentProps {
	event: EventInstance
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore

	rowRef: (element: Element | null) => void
	dragRef: (element: Element | null) => void
}

const EventEditorRowContent = observer(function EventEditorRowContent({
	event,
	serviceFactory,
	panelCollapseHelper,
	localVariablesStore,
	rowRef,
	dragRef,
}: EventEditorRowContentProps): JSX.Element {
	const service = useControlEventService(serviceFactory, event)

	return (
		<div
			ref={rowRef}
			className={classNames('entity-row', {
				'entity-disabled': !event.enabled,
			})}
		>
			<div ref={dragRef} className="entity-row-reorder">
				<FontAwesomeIcon icon={faSort} />
			</div>
			<div className="entity-row-content">
				<EventEditor
					event={event}
					service={service}
					panelCollapseHelper={panelCollapseHelper}
					localVariablesStore={localVariablesStore}
				/>
			</div>
		</div>
	)
})

interface EventsTableRowProps {
	event: EventInstance
	index: number
	dragId: string
	serviceFactory: IEventEditorService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore
}

function EventsTableRow({
	event,
	index,
	dragId,
	serviceFactory,
	panelCollapseHelper,
	localVariablesStore,
}: EventsTableRowProps): JSX.Element | null {
	// transition:null makes swaps instant (no 250ms slide). Direction-lock hysteresis that stops
	// short-past-tall jitter is handled globally by <SortableHysteresis> in App.tsx.
	const { ref, handleRef } = useSortable({
		id: event.id,
		index,
		type: dragId,
		accept: dragId,
		transition: null,
	})

	if (!event) {
		// Invalid event, so skip
		return null
	}

	return (
		<EventEditorRowContent
			event={event}
			serviceFactory={serviceFactory}
			panelCollapseHelper={panelCollapseHelper}
			localVariablesStore={localVariablesStore}
			dragRef={handleRef}
			rowRef={ref}
		/>
	)
}

interface EventEditorProps {
	event: EventInstance
	service: IEventEditorEventService
	panelCollapseHelper: PanelCollapseHelperLite
	localVariablesStore: LocalVariablesStore
}

const EventEditor = observer(function EventEditor({
	event,
	service,
	panelCollapseHelper,
	localVariablesStore,
}: EventEditorProps) {
	const { eventDefinitions } = useContext(RootAppStoreContext)

	const eventSpec = eventDefinitions.definitions.get(event.type)

	const name = eventSpec ? eventSpec.name : `${event.type} (undefined)`

	const canSetHeadline = !!service.setHeadline
	const headline = event.headline
	const [headlineExpanded, setHeadlineExpanded] = useState(canSetHeadline && !!headline)
	const doEditHeadline = useCallback(() => setHeadlineExpanded(true), [])

	const doCollapse = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(event.id, true),
		[panelCollapseHelper, event.id]
	)
	const doExpand = useCallback(
		() => panelCollapseHelper.setPanelCollapsed(event.id, false),
		[panelCollapseHelper, event.id]
	)
	const isCollapsed = panelCollapseHelper.isPanelCollapsed(event.id)

	// Events don't support expressions, so we have to pretend for the UI
	const wrappedOptions = optionsObjectToExpressionOptions(event.options || {}, false)
	const setWrappedValue = useCallback(
		(key: string, value: ExpressionOrValue<JsonValue | undefined>) => service.setValue(key, value.value),
		[service]
	)

	const optionVisibility = useOptionsVisibility(eventSpec?.options, false, wrappedOptions)

	return (
		<>
			<div className="editor-grid-header">
				<div className="cell-name">
					{!service.setHeadline || !headlineExpanded || isCollapsed ? (
						headline || name
					) : (
						<TextInputFieldSimple
							id={undefined}
							value={headline ?? ''}
							placeholder={'Describe the intent of the event'}
							setValue={service.setHeadline}
							aria-label="Event headline"
						/>
					)}
				</div>

				<div className="cell-controls">
					<ButtonGroup className="me-1">
						{canSetHeadline && !headlineExpanded && (
							<Button size="sm" onClick={doEditHeadline} title="Set headline">
								<FontAwesomeIcon icon={faPencil} />
							</Button>
						)}
						{isCollapsed ? (
							<Button size="sm" onClick={doExpand} title="Expand event view">
								<FontAwesomeIcon icon={faExpandArrowsAlt} />
							</Button>
						) : (
							<Button size="sm" onClick={doCollapse} title="Collapse event view">
								<FontAwesomeIcon icon={faCompressArrowsAlt} />
							</Button>
						)}
						<Button size="sm" onClick={service.performDuplicate} title="Duplicate event">
							<FontAwesomeIcon icon={faClone} />
						</Button>
						<Button size="sm" onClick={service.performDelete} title="Remove event">
							<FontAwesomeIcon icon={faTrash} />
						</Button>
						{!!service.setEnabled && (
							<>
								&nbsp;
								<SwitchInputField
									id={undefined}
									value={event.enabled}
									tooltip={event.enabled ? 'Disable event' : 'Enable event'}
									setValue={service.setEnabled}
									small
								/>
							</>
						)}
					</ButtonGroup>
				</div>
			</div>

			{!isCollapsed && (
				<div className="editor-grid">
					<Grid.Col sm={12} className="cell-description">
						{headlineExpanded && <p className="name">{name}</p>}
						{eventSpec?.description || ''}
					</Grid.Col>

					<Form className="row g-sm-2" onSubmit={PreventDefaultHandler}>
						{eventSpec?.options.map((opt, i) => (
							<MyErrorBoundary key={i}>
								<OptionsInputField
									key={i}
									isLocatedInGrid={false}
									entityType={null}
									allowInternalFields={true}
									option={opt}
									value={wrappedOptions[opt.id]}
									setValue={setWrappedValue}
									visibility={optionVisibility.get(opt.id) ?? true}
									localVariablesStore={localVariablesStore}
									fieldSupportsExpression={false} // Events do not support expressions
								/>
							</MyErrorBoundary>
						))}
					</Form>
				</div>
			)}
		</>
	)
})
