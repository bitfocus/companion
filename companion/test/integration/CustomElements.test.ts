import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CUSTOM_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type CustomElementControlId } from '@companion-app/shared/ControlId.js'
import type { CustomElementUse } from '@companion-app/shared/Model/CustomElementModel.js'
import { exprExpr, exprVal } from '@companion-app/shared/Model/Options.js'
import type {
	SomeButtonGraphicsDrawElement,
	SomeButtonGraphicsElement,
} from '@companion-app/shared/Model/StyleLayersModel.js'
import type { ControlButtonLayered } from '../../lib/Controls/ControlTypes/Button/Layered.js'
import { ControlCustomElement } from '../../lib/Controls/ControlTypes/CustomElement.js'
import { createMockTrpcContext } from '../Util.js'
import { createTestApp, type TestApp } from './TestApp.js'

/** The id of an added element, which is false if the control was not found */
function expectElementId(id: string | false): string {
	if (!id) throw new Error('Failed to add the element')
	return id
}

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('custom elements', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app?.close()
	})

	/** Create a custom element which draws its `label` input as text */
	async function createLabelCustomElement(): Promise<{ controlId: CustomElementControlId; elementId: string }> {
		const controlId = await app.trpc().controls.customElements.create({ name: 'Label' })
		await app.trpc().controls.buildingBlockInputs.add({
			controlId,
			field: { type: 'textinput', id: 'label', label: 'Label', default: 'Default' },
		})
		const textId = expectElementId(
			await app.trpc().controls.styles.addElement({ controlId, type: 'text', afterElementId: null })
		)
		await app.trpc().controls.styles.updateOption({
			controlId,
			elementId: textId,
			key: 'text',
			value: exprExpr('$(options:label)'),
		})

		const parsedId = ParseControlId(controlId)
		if (parsedId?.type !== 'custom-element') throw new Error('Expected a custom element')
		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getCompositeElementDefinition(CUSTOM_CONNECTION_ID, parsedId.customElementId)
			).toBeTruthy()
		})

		return { controlId, elementId: parsedId.customElementId }
	}

	/** Give a button a composite element which uses a custom element */
	async function addUse(controlId: string, customElementId: string): Promise<string> {
		return expectElementId(
			await app.trpc().controls.styles.addElement({
				controlId,
				type: `${CUSTOM_CONNECTION_ID};${customElementId}`,
				afterElementId: null,
			})
		)
	}

	/** The current uses of a custom element, as the editor sees them */
	async function readUses(controlId: CustomElementControlId): Promise<CustomElementUse[]> {
		const iterable = await app.trpc().controls.customElements.watchUses({ controlId })
		const iterator = iterable[Symbol.asyncIterator]()
		try {
			const { value } = await iterator.next()
			return value as CustomElementUse[]
		} finally {
			await iterator.return?.()
		}
	}

	/** Every text drawn by a button */
	async function getDrawnTexts(controlId: string): Promise<string[]> {
		const control = app.registry.controls.getControl(controlId as any) as ControlButtonLayered
		const style = await control.drawing.getDrawStyle()

		const texts: string[] = []
		const visit = (elements: SomeButtonGraphicsDrawElement[]) => {
			for (const element of elements) {
				if (element.type === 'text') texts.push(element.text)
				if (element.type === 'group') visit(element.children)
			}
		}
		visit(style.elements)
		return texts
	}

	test('is offered as a composite element, which a button draws with its own inputs', async () => {
		const { elementId } = await createLabelCustomElement()

		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const useId = await addUse(button, elementId)

		// A new use starts with the default of the input
		await vi.waitFor(async () => expect(await getDrawnTexts(button)).toContain('Default'))

		await app.trpc().controls.styles.updateOption({
			controlId: button,
			elementId: useId,
			key: 'opt:label',
			value: exprVal('Hello'),
		})
		await vi.waitFor(async () => expect(await getDrawnTexts(button)).toContain('Hello'))
	})

	test('a button redraws when the custom element changes', async () => {
		const { controlId, elementId } = await createLabelCustomElement()

		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		await addUse(button, elementId)
		await vi.waitFor(async () => expect(await getDrawnTexts(button)).toContain('Default'))

		const customElement = app.registry.controls.getControl(controlId) as ControlCustomElement
		const textId = customElement.layeredStyleGetElements()[0].id
		await app.trpc().controls.styles.updateOption({
			controlId,
			elementId: textId,
			key: 'text',
			value: exprExpr('`Changed ${$(options:label)}`'),
		})

		await vi.waitFor(async () => expect(await getDrawnTexts(button)).toContain('Changed Default'))
	})

	test('renaming or removing an input updates the uses', async () => {
		const { controlId, elementId } = await createLabelCustomElement()

		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const useId = await addUse(button, elementId)
		await app.trpc().controls.styles.updateOption({
			controlId: button,
			elementId: useId,
			key: 'opt:label',
			value: exprVal('Kept'),
		})

		await app.trpc().controls.buildingBlockInputs.update({
			controlId,
			inputId: 'label',
			field: { type: 'textinput', id: 'title', label: 'Title', default: 'Default' },
		})

		// The use keeps its value under the new id, and the custom element's own reference follows it
		const buttonControl = app.registry.controls.getControl(button) as ControlButtonLayered
		const use = buttonControl.drawing.tree.getElementById(useId) as Record<string, unknown>
		expect(use['opt:label']).toBeUndefined()
		expect(use['opt:title']).toEqual(exprVal('Kept'))

		const customElement = app.registry.controls.getControl(controlId) as ControlCustomElement
		expect(customElement.layeredStyleGetElements()[0]).toMatchObject({ text: exprExpr('$(options:title)') })
		await vi.waitFor(async () => expect(await getDrawnTexts(button)).toContain('Kept'))

		await app.trpc().controls.buildingBlockInputs.remove({ controlId, inputId: 'title' })
		expect(buttonControl.drawing.tree.getElementById(useId)).not.toHaveProperty('opt:title')
	})

	test('lists its uses, including in other custom elements', async () => {
		const { controlId, elementId } = await createLabelCustomElement()

		const button = app.createButton({ pageNumber: 1, row: 1, column: 1 })
		const buttonUseId = await addUse(button, elementId)

		const outerId = await app.trpc().controls.customElements.create({ name: 'Outer' })
		const outerUseId = await addUse(outerId, elementId)

		expect(await readUses(controlId)).toEqual(
			expect.arrayContaining([
				{ controlId: button, elementId: buttonUseId, disabled: false },
				{ controlId: outerId, elementId: outerUseId, disabled: false },
			])
		)

		await app.trpc().controls.styles.removeElement({ controlId: button, elementId: buttonUseId })
		expect(await readUses(controlId)).toEqual([{ controlId: outerId, elementId: outerUseId, disabled: false }])
	})

	test("a custom element can't use itself, or one which uses it", async () => {
		const { controlId: innerId, elementId: innerElementId } = await createLabelCustomElement()

		await expect(addUse(innerId, innerElementId)).rejects.toThrow()

		const outerId = await app.trpc().controls.customElements.create({ name: 'Outer' })
		await addUse(outerId, innerElementId)
		const outerParsed = ParseControlId(outerId)
		if (outerParsed?.type !== 'custom-element') throw new Error('Expected a custom element')

		// The uses are analysed once the definitions are published
		const inner = app.registry.controls.getControl(innerId) as ControlCustomElement
		await vi.waitFor(() => {
			expect(
				app.registry.instance.definitions.getCompositeElementDefinition(
					CUSTOM_CONNECTION_ID,
					outerParsed.customElementId
				)?.elements
			).toHaveLength(1)
		})
		await vi.waitFor(() =>
			expect(
				app.registry.controls
					.getAllCustomElements()
					.find((c) => c.controlId === outerId)
					?.toClientJSON()
			).toMatchObject({ usedCustomElementIds: [innerElementId] })
		)

		await expect(addUse(innerId, outerParsed.customElementId)).rejects.toThrow()
		expect(inner.layeredStyleGetElements()).toHaveLength(1)
	})

	test('never has a canvas, and has no fixed first element', async () => {
		const { controlId } = await createLabelCustomElement()

		const boxId = expectElementId(
			await app.trpc().controls.styles.addElement({ controlId, type: 'box', afterElementId: null })
		)
		const customElement = app.registry.controls.getControl(controlId) as ControlCustomElement
		const textId = customElement.layeredStyleGetElements()[0].id

		// The box can be moved beneath the text, which a button's canvas would refuse
		expect(
			await app.trpc().controls.styles.moveElement({ controlId, elementId: boxId, parentElementId: null, newIndex: 0 })
		).toBe(true)
		expect(customElement.layeredStyleGetElements().map((element: SomeButtonGraphicsElement) => element.id)).toEqual([
			boxId,
			textId,
		])

		await expect(
			app.trpc().controls.styles.addElement({ controlId, type: 'canvas', afterElementId: null })
		).rejects.toThrow()
	})

	test('is exported and imported', async () => {
		const { controlId, elementId } = await createLabelCustomElement()
		const before = structuredClone((app.registry.controls.getControl(controlId) as ControlCustomElement).toJSON())

		// The format must be explicit - the default is gzipped
		const res = await app.http.get('/int/export/full?format=json').expect(200)
		const exported = JSON.parse(res.text || res.body.toString())
		expect(exported.customElements[elementId]).toEqual(before)

		await app.trpc().controls.customElements.delete({ controlId })
		expect(app.registry.controls.getAllCustomElements()).toHaveLength(0)

		// The pending import normally arrives via a multipart upload; it lives on the trpc context
		const ctx = createMockTrpcContext()
		ctx.pendingImport = { object: exported, timeout: null }
		await app.trpc(ctx).importExport.importFull({
			config: {
				buttons: 'unchanged',
				surfaces: { known: 'unchanged', instances: 'unchanged', remote: 'unchanged' },
				triggers: 'unchanged',
				customVariables: 'unchanged',
				expressionVariables: 'unchanged',
				customActions: 'unchanged',
				customFeedbacks: 'unchanged',
				customElements: 'reset-and-import',
				customPresets: 'unchanged',
				connections: 'unchanged',
				userconfig: 'unchanged',
				imageLibrary: 'unchanged',
			},
		})

		await vi.waitFor(() => {
			const imported = app.registry.controls.getControl(controlId)
			expect(imported).toBeInstanceOf(ControlCustomElement)
			expect((imported as ControlCustomElement).toJSON()).toEqual(before)
		})
	})
})
