import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { CUSTOM_PRESETS_CONNECTION_ID } from '@companion-app/shared/ConnectionId.js'
import { ParseControlId, type CustomPresetControlId } from '@companion-app/shared/ControlId.js'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { exprVal } from '@companion-app/shared/Model/Options.js'
import { createTestApp, type TestApp } from './TestApp.js'

// Booting the application takes a few seconds, so the default timeouts are too tight
vi.setConfig({ testTimeout: 30_000, hookTimeout: 30_000 })

describe('custom presets', () => {
	let app: TestApp
	beforeEach(async () => {
		app = await createTestApp({ configDir: null, extraModulePath: null })
	})
	afterEach(async () => {
		await app.close()
	})

	/** Create a custom preset with the given text, and wait for it to be offered as a preset */
	async function createCustomPreset(text: string): Promise<{ controlId: CustomPresetControlId; presetId: string }> {
		const controlId = await app.trpc().controls.customPresets.create({ name: 'My preset' })
		await setText(controlId, text)

		const parsedId = ParseControlId(controlId)
		if (parsedId?.type !== 'custom-preset') throw new Error('Expected a custom preset')

		await vi.waitFor(() => {
			expect(getPresetText(parsedId.customPresetId)).toBe(text)
		})

		return { controlId, presetId: parsedId.customPresetId }
	}

	async function setText(controlId: CustomPresetControlId, text: string): Promise<void> {
		await app.trpc().controls.styles.updateOption({ controlId, elementId: 'text0', key: 'text', value: exprVal(text) })
	}

	/** The text of the preset offered for a custom preset */
	function getPresetText(presetId: string): unknown {
		const model = app.registry.instance.definitions.convertPresetToControlModel(
			CUSTOM_PRESETS_CONNECTION_ID,
			presetId,
			null
		)
		const text = model?.style.layers.find((layer) => layer.id === 'text0')
		return text && 'text' in text ? text.text?.value : undefined
	}

	/** The type and text of the button placed at a location */
	function getButton(location: ControlLocation): { type: string; text: unknown } | null {
		const controlId = app.registry.page.store.getControlIdAt(location)
		const control = controlId ? app.registry.controls.getControl(controlId) : undefined
		if (!control) return null

		const json = control.toJSON()
		if (!('style' in json)) return { type: json.type, text: undefined }
		const text = json.style.layers.find((layer) => layer.id === 'text0')
		return { type: json.type, text: text && 'text' in text ? text.text?.value : undefined }
	}

	test('a linked custom preset follows changes made to it, and a copy does not', async () => {
		const { controlId, presetId } = await createCustomPreset('First')

		const linkedLocation = { pageNumber: 1, row: 0, column: 0 }
		const copyLocation = { pageNumber: 1, row: 0, column: 1 }
		await app.trpc().controls.importPreset({
			connectionId: CUSTOM_PRESETS_CONNECTION_ID,
			presetId,
			location: linkedLocation,
			variableValues: null,
			mode: 'reference',
		})
		await app.trpc().controls.importPreset({
			connectionId: CUSTOM_PRESETS_CONNECTION_ID,
			presetId,
			location: copyLocation,
			variableValues: null,
			mode: 'copy',
		})

		expect(getButton(linkedLocation)).toEqual({ type: 'preset-reference', text: 'First' })
		expect(getButton(copyLocation)).toEqual({ type: 'button-layered', text: 'First' })

		await setText(controlId, 'Second')

		await vi.waitFor(() => {
			expect(getButton(linkedLocation)).toEqual({ type: 'preset-reference', text: 'Second' })
		})
		expect(getButton(copyLocation)).toEqual({ type: 'button-layered', text: 'First' })
	})

	test('a linked custom preset keeps how it looks when the custom preset is deleted', async () => {
		const { controlId, presetId } = await createCustomPreset('Kept')

		const location = { pageNumber: 1, row: 0, column: 0 }
		await app.trpc().controls.importPreset({
			connectionId: CUSTOM_PRESETS_CONNECTION_ID,
			presetId,
			location,
			variableValues: null,
			mode: 'reference',
		})

		await app.trpc().controls.customPresets.delete({ controlId })

		await vi.waitFor(() => {
			expect(getPresetText(presetId)).toBeUndefined()
		})
		expect(getButton(location)).toEqual({ type: 'preset-reference', text: 'Kept' })
	})

	test('a button can be saved as a custom preset', async () => {
		const location = { pageNumber: 1, row: 2, column: 2 }
		const buttonId = app.createButton(location)
		await app.trpc().controls.styles.updateOption({
			controlId: buttonId,
			elementId: 'text0',
			key: 'text',
			value: exprVal('From button'),
		})

		const controlId = await app.trpc().controls.customPresets.createFromButton({ location, name: 'Saved' })
		if (!controlId) throw new Error('Expected a custom preset')
		const parsedId = ParseControlId(controlId)
		if (parsedId?.type !== 'custom-preset') throw new Error('Expected a custom preset')

		await vi.waitFor(() => {
			expect(getPresetText(parsedId.customPresetId)).toBe('From button')
		})

		expect(app.registry.controls.getControl(controlId)?.toJSON()).toMatchObject({
			type: 'custom-preset',
			options: { name: 'Saved' },
		})
	})
})
