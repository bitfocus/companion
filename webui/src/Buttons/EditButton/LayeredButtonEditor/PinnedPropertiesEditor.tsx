import { faArrowRight, faThumbtack } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext } from 'react'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { Accordion } from '~/Components/Accordion.js'
import { Form } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { NonIdealState } from '~/Components/NonIdealState.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { usePanelCollapseAccordionProps, usePanelCollapseHelper } from '~/Helpers/CollapseHelper.js'
import { PreventDefaultHandler } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { getElementTypeIcon } from './Buttons.js'
import { ElementPropertiesProvider, type IsPropertyOverridden } from './ElementPropertiesContext.js'
import { SchemaFieldWrapper } from './ElementPropertiesEditor.js'
import { isElementDisabled, type LayeredStyleStore } from './StyleStore.js'
import { getElementSchemaSections } from './useElementSchema.js'

interface PinnedSection {
	element: SomeButtonGraphicsElement
	/** The pinned properties, in the element type's canonical order */
	fields: SomeCompanionInputField[]
	disabled: boolean
	hiddenInPreview: boolean
}

interface PinnedPropertiesEditorProps {
	controlId: string
	styleStore: LayeredStyleStore
	localVariablesStore: LocalVariablesStore
	isPropertyOverridden: IsPropertyOverridden
}

/**
 * The pinned view: every property pinned anywhere on this button, grouped by the element it belongs to.
 *
 * Sections follow the layer list's order and properties follow their element type's canonical order - neither
 * is reorderable, so a property sits where the full panel would have put it. Elements with nothing pinned are
 * left out entirely, so the pinned properties stay at the top where they can be edited without scrolling.
 */
export const PinnedPropertiesEditor = observer(function PinnedPropertiesEditor({
	controlId,
	styleStore,
	localVariablesStore,
	isPropertyOverridden,
}: PinnedPropertiesEditorProps) {
	const { compositeElementDefinitions } = useContext(RootAppStoreContext)

	const sections: PinnedSection[] = []
	for (const { element, ancestorDisabled } of styleStore.visualElements) {
		if (element.type === 'canvas' || element.pinnedProperties.length === 0) continue

		const schema = getElementSchemaSections(element, compositeElementDefinitions)
		if (!schema) continue

		// Driven by the schema rather than by the stored array, so the order is canonical and a property id
		// which no longer resolves (an older version's field, or a composite whose connection is gone) is
		// skipped rather than being an error
		const fields = schema
			.flatMap((section) => section.fields)
			.filter((field) => element.pinnedProperties.includes(field.id))
		if (fields.length === 0) continue

		sections.push({
			element,
			fields,
			disabled: ancestorDisabled || isElementDisabled(element),
			hiddenInPreview: !styleStore.isElementVisible(element.id),
		})
	}

	// Sections collapse like the property panel's do. Keyed by element id, which is unique to this button,
	// so the state is owned by the control and evicted with it.
	const sectionCollapse = usePanelCollapseHelper(
		`layered-pinned-sections_${controlId}`,
		sections.map((section) => section.element.id),
		false,
		{ kind: 'control', id: controlId }
	)
	const sectionAccordion = usePanelCollapseAccordionProps(
		sectionCollapse,
		sections.map((section) => section.element.id)
	)

	return (
		<ElementPropertiesProvider
			controlId={controlId}
			localVariablesStore={localVariablesStore}
			isPropertyOverridden={isPropertyOverridden}
			isPinnedView={true}
		>
			{sections.length === 0 ? (
				<NonIdealState icon={faThumbtack}>
					Nothing on this button is pinned. Select an element above and use the <FontAwesomeIcon icon={faThumbtack} />{' '}
					beside a property to pin it here, where it can be edited without selecting that element first.
				</NonIdealState>
			) : (
				<Form row className="gap-2" onSubmit={PreventDefaultHandler}>
					<Accordion.Root value={sectionAccordion.value} onValueChange={sectionAccordion.onValueChange} multiple>
						{sections.map((section) => (
							<Accordion.Item key={section.element.id} value={section.element.id}>
								<PinnedSectionHeader section={section} styleStore={styleStore} />
								<Accordion.Panel>
									<Grid.Row className="gap-2 p-2">
										{section.fields.map((field) => (
											<SchemaFieldWrapper
												key={field.id}
												field={field}
												elementProps={section.element}
												localVariablesStore={localVariablesStore}
											/>
										))}
									</Grid.Row>
								</Accordion.Panel>
							</Accordion.Item>
						))}
					</Accordion.Root>
				</Form>
			)}
		</ElementPropertiesProvider>
	)
})

// Names the element the properties below belong to, and carries the way through to its full property panel -
// so reaching a property that isn't pinned is one click, not a hunt through the layer list. The link is a
// sibling of the collapse trigger rather than inside it, since a button cannot nest inside a button.
const PinnedSectionHeader = observer(function PinnedSectionHeader({
	section,
	styleStore,
}: {
	section: PinnedSection
	styleStore: LayeredStyleStore
}) {
	const { element, disabled, hiddenInPreview } = section

	const openElement = useCallback(() => styleStore.setSelectedEntryId(element.id), [styleStore, element.id])

	return (
		<Accordion.Header className="pinned-section-header">
			<Accordion.Trigger className="font-bold">
				<FontAwesomeIcon icon={getElementTypeIcon(element.type)} fixedWidth />
				<span className="pinned-section-name">{element.name || capitalize(element.type)}</span>
				{disabled && <span className="pinned-section-state">Disabled</span>}
				{hiddenInPreview && <span className="pinned-section-state">Hidden in preview</span>}
			</Accordion.Trigger>
			<button type="button" className="pinned-section-open" onClick={openElement} title="Edit all properties">
				<FontAwesomeIcon icon={faArrowRight} />
			</button>
		</Accordion.Header>
	)
})
