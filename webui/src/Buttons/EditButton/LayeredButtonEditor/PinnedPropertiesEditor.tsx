import { faArrowRight, faThumbtack } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { observer } from 'mobx-react-lite'
import { Fragment, useCallback, useContext } from 'react'
import type { SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { capitalize } from '@companion-app/shared/Util.js'
import { Button } from '~/Components/Button.js'
import { Form } from '~/Components/Form.js'
import { Grid } from '~/Components/Grid'
import { NonIdealState } from '~/Components/NonIdealState.js'
import type { LocalVariablesStore } from '~/Controls/LocalVariablesStore.js'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
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

	return (
		<ElementPropertiesProvider
			controlId={controlId}
			localVariablesStore={localVariablesStore}
			isPropertyOverridden={isPropertyOverridden}
		>
			{sections.length === 0 ? (
				<NonIdealState icon={faThumbtack}>
					Nothing on this button is pinned. Select an element above and use the <FontAwesomeIcon icon={faThumbtack} />{' '}
					beside a property to pin it here, where it can be edited without selecting that element first.
					<div className="mt-2">
						<ResetPinnedPropertiesButton controlId={controlId} />
					</div>
				</NonIdealState>
			) : (
				<>
					<Form row className="gap-2" onSubmit={PreventDefaultHandler}>
						{sections.map((section) => (
							<Fragment key={section.element.id}>
								<PinnedSectionHeader section={section} styleStore={styleStore} />

								{section.fields.map((field) => (
									<SchemaFieldWrapper
										key={field.id}
										field={field}
										elementProps={section.element}
										localVariablesStore={localVariablesStore}
									/>
								))}
							</Fragment>
						))}
					</Form>

					<div className="pinned-view-footer">
						<ResetPinnedPropertiesButton controlId={controlId} />
					</div>
				</>
			)}
		</ElementPropertiesProvider>
	)
})

// Names the element the properties below belong to, and doubles as the way through to its full property
// panel - so reaching a property that isn't pinned is one click, not a hunt through the layer list.
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
		<Grid.Col>
			<button type="button" className="pinned-section-header" onClick={openElement} title="Edit all properties">
				<FontAwesomeIcon icon={getElementTypeIcon(element.type)} fixedWidth />
				<span className="pinned-section-name">{element.name || capitalize(element.type)}</span>
				{disabled && <span className="pinned-section-state">Disabled</span>}
				{hiddenInPreview && <span className="pinned-section-state">Hidden in preview</span>}
				<FontAwesomeIcon icon={faArrowRight} className="pinned-section-open" />
			</button>
		</Grid.Col>
	)
})

/** Restores every element on this button to its type's default pinned properties. */
const ResetPinnedPropertiesButton = observer(function ResetPinnedPropertiesButton({
	controlId,
}: {
	controlId: string
}) {
	const resetMutation = useMutationExt(trpc.controls.styles.resetPinnedProperties.mutationOptions())

	const resetToDefaults = useCallback(() => {
		resetMutation.mutateAsync({ controlId }).catch((e) => {
			console.error('Failed to reset pinned properties', e)
		})
	}, [resetMutation, controlId])

	return (
		<Button size="sm" onClick={resetToDefaults} title="Restore the default pinned properties of every element">
			Reset to defaults
		</Button>
	)
})
