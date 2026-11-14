import type { BankControlId, SomeControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import {
	EntityModelType,
	type EntityOwner,
	type SomeSocketEntityLocation,
} from '@companion-app/shared/Model/EntityModel.js'
import { exprVal, type ExpressionOrValue } from '@companion-app/shared/Model/Options.js'
import { prepareForModuleChildren, type TestApp } from '../integration/TestApp.js'
import { DEMO_MODULES, standInForModuleStore } from './modules/DemoModules.js'

export { DEMO_MODULES }

/**
 * Get ready to start the app of a scenario: stand in for the module store, so the demo modules can be installed from
 * it, and provision what running their connections needs
 */
export async function prepareDocsApp(): Promise<void> {
	await standInForModuleStore()
	await prepareForModuleChildren()
}

/**
 * Add a connection of a demo module, installing its version from the (stand in) store, and wait for it to be running
 * @returns The id of the connection
 */
export async function addDemoConnection(
	app: TestApp,
	module: (typeof DEMO_MODULES)['visionMixer' | 'audioMixer' | 'mediaPlayer'],
	label: string,
	versionId: string
): Promise<string> {
	const connectionId = await app.trpc().instances.connections.add({ module: { type: module.id }, label, versionId })
	if (!connectionId) throw new Error(`Failed to add the connection "${label}"`)

	// It starts once the module is installed, and is ready once its definitions have arrived
	await waitFor(
		() => app.registry.instance.definitions.getEntityDefinition(EntityModelType.Action, connectionId, 'program'),
		60_000
	)
	return connectionId
}

/** Create a button at a location, showing some text */
export async function createButtonWithText(
	app: TestApp,
	location: ControlLocation,
	text: string
): Promise<BankControlId> {
	const controlId = app.createButton(location)
	await app.trpc().controls.styles.updateOption({ controlId, elementId: 'text0', key: 'text', value: exprVal(text) })
	return controlId
}

/**
 * Add an action, feedback or local variable of a connection to a control, the way the ui does
 * @returns The id of the entity
 */
export async function addEntity(
	app: TestApp,
	controlId: SomeControlId,
	entityLocation: SomeSocketEntityLocation,
	ownerId: EntityOwner | null,
	connectionId: string,
	entityType: EntityModelType,
	entityDefinition: string,
	options: Record<string, ExpressionOrValue<any>>
): Promise<string> {
	const entityId = await app
		.trpc()
		.controls.entities.add({ controlId, entityLocation, ownerId, connectionId, entityType, entityDefinition })
	if (!entityId) throw new Error(`Failed to add "${entityDefinition}" to ${controlId}`)

	for (const [key, value] of Object.entries(options)) {
		await app.trpc().controls.entities.setOption({ controlId, entityLocation, entityId, key, value })
	}
	return entityId
}

/**
 * Add an element to the style of a button
 * @param app The app
 * @param controlId The button
 * @param type The type of element, eg `text` or `gauge`
 * @param name The name to show for it in the list of elements
 * @param parentElementId The group to put it in, or null for the top level
 * @param values The values of its properties
 * @returns The id of the element
 */
export async function addElement(
	app: TestApp,
	controlId: SomeControlId,
	type: string,
	name: string,
	parentElementId: string | null,
	values: Record<string, ExpressionOrValue<any>>
): Promise<string> {
	const elementId = await app.trpc().controls.styles.addElement({ controlId, type, afterElementId: null })
	if (typeof elementId !== 'string') throw new Error(`Failed to add a ${type} element to ${controlId}`)

	await app.trpc().controls.styles.setElementName({ controlId, elementId, name })
	if (parentElementId) {
		await app.trpc().controls.styles.moveElement({ controlId, elementId, parentElementId, newIndex: 0 })
	}
	await app.trpc().controls.styles.updateOptions({ controlId, elementId, values })
	return elementId
}

/** The location of the actions run when the first step of a button is pressed */
export function firstStepDown(app: TestApp, controlId: SomeControlId): SomeSocketEntityLocation {
	const control = app.registry.controls.getControl(controlId)
	// Only buttons have steps, which the control's types don't expose
	const entities = control?.supportsEntities ? (control.entities as unknown as { getStepIds?: () => string[] }) : null
	if (!entities?.getStepIds) throw new Error(`Control "${controlId}" does not have steps`)
	return { stepId: entities.getStepIds()[0], setId: 'down' }
}

/** Wait for a check to pass, as the app processes a change */
export async function waitFor<T>(
	check: () => T | undefined | null | false | Promise<T | undefined | null | false>,
	timeout = 5_000
): Promise<T> {
	const end = Date.now() + timeout
	while (Date.now() < end) {
		const result = await check()
		if (result) return result
		await new Promise((resolve) => setTimeout(resolve, 50))
	}
	throw new Error('Timed out waiting for the app')
}
