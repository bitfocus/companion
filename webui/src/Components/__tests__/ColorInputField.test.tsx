import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ColorInputField } from '../ColorInputField.js'
import { MenuPortalContext } from '../MenuPortalContext.js'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pack r, g, b into a 24-bit integer (matching the component's encoding).
function packRgb(r: number, g: number, b: number): number {
	return (r << 16) | (g << 8) | b
}

// Pack r, g, b, a into the component's 32-bit format.
// Alpha is stored in the high byte as 255*(1-a) (inverted).
function packRgba(r: number, g: number, b: number, a: number): number {
	return packRgb(r, g, b) + 0x1000000 * Math.round(255 * (1 - a))
}

interface RenderOptions {
	value?: number | string
	enableAlpha?: boolean
	returnType?: 'number' | 'string'
	setValue?: (v: number | string) => void
}

function renderField(opts: RenderOptions = {}) {
	const setValue = opts.setValue ?? vi.fn()
	const user = userEvent.setup()
	const utils = render(
		<MenuPortalContext.Provider value={document.body}>
			<ColorInputField
				returnType={opts.returnType ?? 'number'}
				value={(opts.value ?? 0xff0000) as never}
				setValue={setValue as never}
				enableAlpha={opts.enableAlpha}
			/>
		</MenuPortalContext.Provider>
	)
	// The swatch is the first div that contains the colour preview.
	// Structure: container > div[lineHeight:0] > div[swatch, cursor:pointer] > div[color, background:rgba]
	const swatchDiv = utils.container.querySelector<HTMLDivElement>('[style*="cursor: pointer"]')!
	// colorDiv is the direct child of swatchDiv (querySelector('[style*="background: rgba"]') is
	// unreliable because jsdom serialises the background shorthand as background-color in the attribute)
	const colorDiv = swatchDiv.querySelector<HTMLDivElement>(':scope > div')!
	return { ...utils, setValue, user, swatchDiv, colorDiv }
}

async function openPicker(swatchDiv: HTMLDivElement) {
	await userEvent.click(swatchDiv)
}

function getHexInput() {
	return screen.getByLabelText('hex')
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

describe('Rendering (swatch)', () => {
	it('renders a colour swatch', () => {
		const { swatchDiv } = renderField()
		expect(swatchDiv).toBeInTheDocument()
	})

	it('swatch inner div background reflects the numeric value (pure red = 0xFF0000)', () => {
		const { colorDiv } = renderField({ value: 0xff0000 })
		// splitColor(0xFF0000, false) → {r:255, g:0, b:0, a:1}
		// jsdom normalises rgba(r,g,b,1) → rgb(r,g,b) when alpha=1
		expect(colorDiv.style.background).toContain('rgb(255, 0, 0)')
	})

	it('swatch shows pure green for 0x00FF00', () => {
		const { colorDiv } = renderField({ value: 0x00ff00 })
		expect(colorDiv.style.background).toContain('rgb(0, 255, 0)')
	})

	it('swatch shows pure blue for 0x0000FF', () => {
		const { colorDiv } = renderField({ value: 0x0000ff })
		expect(colorDiv.style.background).toContain('rgb(0, 0, 255)')
	})

	it('swatch shows black for value 0', () => {
		const { colorDiv } = renderField({ value: 0 })
		expect(colorDiv.style.background).toContain('rgb(0, 0, 0)')
	})

	it('swatch shows white for value 0xFFFFFF', () => {
		const { colorDiv } = renderField({ value: 0xffffff })
		expect(colorDiv.style.background).toContain('rgb(255, 255, 255)')
	})

	it('accepts a CSS string value and shows the correct colour', () => {
		const { colorDiv } = renderField({ value: 'rgb(128, 64, 32)' })
		expect(colorDiv.style.background).toContain('rgb(128, 64, 32)')
	})

	it('shows colour with alpha when enableAlpha=true and packed number has alpha byte', () => {
		// 50 % opacity red: high byte = Math.round(255 * 0.5) = 128 → 0x80000000 + 0xFF0000
		const halfOpacityRed = packRgba(255, 0, 0, 0.5)
		const { colorDiv } = renderField({ value: halfOpacityRed, enableAlpha: true })
		// (255 - 128) / 255 ≈ 0.498 due to integer rounding
		expect(colorDiv.style.background).toMatch(/rgba\(255, 0, 0, 0\.\d+\)/)
	})

	it('ignores alpha byte in swatch when enableAlpha=false', () => {
		// Pack a value that has a non-zero alpha byte
		const halfOpacityRed = packRgba(255, 0, 0, 0.5)
		const { colorDiv } = renderField({ value: halfOpacityRed, enableAlpha: false })
		// enableAlpha=false → a is always treated as 1.0
		expect(colorDiv.style.background).toContain('rgb(255, 0, 0)')
	})
})

// ---------------------------------------------------------------------------
// Picker open / close
// ---------------------------------------------------------------------------

describe('Picker open / close', () => {
	it('picker is hidden by default', () => {
		renderField()
		expect(screen.queryByLabelText('hex')).toBeNull()
	})

	it('picker opens when swatch is clicked', async () => {
		const { swatchDiv } = renderField()
		await openPicker(swatchDiv)
		expect(getHexInput()).toBeInTheDocument()
	})

	it('picker closes when swatch is clicked a second time', async () => {
		const { swatchDiv, user } = renderField()
		await user.click(swatchDiv)
		await user.click(swatchDiv)
		expect(screen.queryByLabelText('hex')).toBeNull()
	})

	it('picker closes when clicking outside', async () => {
		const { swatchDiv } = renderField()
		await openPicker(swatchDiv)
		expect(getHexInput()).toBeInTheDocument()
		// Click somewhere outside both the swatch and the picker
		await userEvent.click(document.body)
		expect(screen.queryByLabelText('hex')).toBeNull()
	})
})

// ---------------------------------------------------------------------------
// returnType='number'
// ---------------------------------------------------------------------------

describe("returnType='number'", () => {
	it('calls setValue with a packed RGB integer when hex changes (pure green)', async () => {
		const setValue = vi.fn()
		const { swatchDiv } = renderField({ value: 0xff0000, returnType: 'number', setValue })
		await openPicker(swatchDiv)
		// 0x00FF00 = 65280
		fireEvent.change(getHexInput(), { target: { value: '00FF00' } })
		expect(setValue).toHaveBeenLastCalledWith(0x00ff00)
	})

	it('calls setValue with a packed RGB integer for pure red', async () => {
		const setValue = vi.fn()
		const { swatchDiv } = renderField({ value: 0x000000, returnType: 'number', setValue })
		await openPicker(swatchDiv)
		fireEvent.change(getHexInput(), { target: { value: 'FF0000' } })
		expect(setValue).toHaveBeenLastCalledWith(0xff0000)
	})

	it('does NOT include an alpha byte when enableAlpha=false, even if alpha is dragged', async () => {
		const setValue = vi.fn()
		// Use 0x000000 as initial value so changing hex to FF0000 is a real change
		const { swatchDiv } = renderField({ value: 0x000000, returnType: 'number', enableAlpha: false, setValue })
		await openPicker(swatchDiv)
		fireEvent.change(getHexInput(), { target: { value: 'FF0000' } })
		// With enableAlpha=false the high 8 bits must be 0
		const lastCall = setValue.mock.calls.at(-1)![0] as number
		expect(lastCall & 0xff000000).toBe(0)
		expect(lastCall).toBe(0xff0000)
	})

	it('includes alpha byte in return value when enableAlpha=true and alpha < 1', async () => {
		const setValue = vi.fn()
		// Start with a fully-opaque red
		const { swatchDiv } = renderField({ value: 0xff0000, returnType: 'number', enableAlpha: true, setValue })
		await openPicker(swatchDiv)

		// Decrease alpha via the alpha input to 50 (as a percentage integer, 0-100)
		const alphaInput = screen.getByLabelText('a')
		fireEvent.change(alphaInput, { target: { value: '50' } })

		const lastCall = setValue.mock.calls.at(-1)![0] as number
		// The high byte should be non-zero when alpha < 1.
		// Use unsigned right shift (>>>) to extract the high byte as an unsigned value;
		// bitwise & on its own yields a signed 32-bit integer (0x80000000 = -2147483648).
		expect(lastCall >>> 24).toBeGreaterThan(0)
	})
})

// ---------------------------------------------------------------------------
// returnType='string'
// ---------------------------------------------------------------------------

describe("returnType='string'", () => {
	it('calls setValue with an rgba() string when hex changes', async () => {
		const setValue = vi.fn()
		const { swatchDiv } = renderField({ value: 0x000000, returnType: 'string', setValue })
		await openPicker(swatchDiv)
		fireEvent.change(getHexInput(), { target: { value: 'FF0000' } })
		expect(setValue).toHaveBeenLastCalledWith('rgba(255, 0, 0, 1)')
	})

	it('returned string includes alpha when enableAlpha=true', async () => {
		const setValue = vi.fn()
		const { swatchDiv } = renderField({
			value: 'rgba(255, 0, 0, 1)',
			returnType: 'string',
			enableAlpha: true,
			setValue,
		})
		await openPicker(swatchDiv)
		const alphaInput = screen.getByLabelText('a')
		fireEvent.change(alphaInput, { target: { value: '50' } })

		const lastCall = setValue.mock.calls.at(-1)![0] as string
		// Should contain rgba(…) with alpha ≈ 0.5
		expect(lastCall).toMatch(/^rgba\(255, 0, 0, 0\.\d+\)$/)
	})

	it('alpha field is hidden from the picker when enableAlpha=false', async () => {
		const { swatchDiv } = renderField({ returnType: 'string', enableAlpha: false })
		await openPicker(swatchDiv)
		expect(screen.queryByLabelText('a')).toBeNull()
	})

	it('alpha field is visible in the picker when enableAlpha=true', async () => {
		const { swatchDiv } = renderField({ returnType: 'string', enableAlpha: true })
		await openPicker(swatchDiv)
		expect(screen.getByLabelText('a')).toBeInTheDocument()
	})

	it('rgba string always includes a numeric alpha value (guarded by ?? 1)', async () => {
		const setValue = vi.fn()
		const { swatchDiv } = renderField({ value: 0x000000, returnType: 'string', setValue })
		await openPicker(swatchDiv)
		fireEvent.change(getHexInput(), { target: { value: 'FF0000' } })
		const result = setValue.mock.calls.at(-1)![0] as string
		expect(result).not.toContain('undefined')
		expect(result).toMatch(/^rgba\(\d+, \d+, \d+, [\d.]+\)$/)
	})
})

// ---------------------------------------------------------------------------
// Alpha encoding / round-trip
// ---------------------------------------------------------------------------

describe('Alpha round-trip (number encoding)', () => {
	it('packs and unpacks pure red with full opacity', () => {
		const packed = packRgb(255, 0, 0)
		const { colorDiv } = renderField({ value: packed, enableAlpha: true })
		expect(colorDiv.style.background).toContain('rgb(255, 0, 0)')
	})

	it('packs and unpacks with 0% opacity (fully transparent)', () => {
		// alpha=0 → high byte = 255 → Math.round(255*(1-0)) = 255
		const packed = packRgba(255, 0, 0, 0)
		const { colorDiv } = renderField({ value: packed, enableAlpha: true })
		expect(colorDiv.style.background).toContain('rgba(255, 0, 0, 0)')
	})

	// NOTE: alpha=0.5 → stored as byte 128 → decoded as (255-128)/255 = 127/255 ≈ 0.498.
	// There is inherent precision loss in the round-trip due to integer rounding.
	it('alpha 0.5 round-trip has slight precision loss (byte-rounding artefact)', () => {
		const packed = packRgba(255, 0, 0, 0.5)
		const { colorDiv } = renderField({ value: packed, enableAlpha: true })
		// Should NOT be exactly 0.5 due to rounding
		expect(colorDiv.style.background).not.toContain('rgba(255, 0, 0, 0.5)')
		expect(colorDiv.style.background).toMatch(/rgba\(255, 0, 0, 0\.4\d+\)/)
	})
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

describe('Edge cases', () => {
	it('empty-string value is treated as 0 (black) — acceptable fallback', () => {
		const { colorDiv } = renderField({ value: '' })
		expect(colorDiv.style.background).toContain('rgb(0, 0, 0)')
	})
})
