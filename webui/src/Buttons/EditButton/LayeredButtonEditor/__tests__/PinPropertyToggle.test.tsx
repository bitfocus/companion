import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SomeButtonGraphicsElement } from '@companion-app/shared/Model/StyleLayersModel.js'
import { ElementPropertiesProvider } from '../ElementPropertiesContext.js'
import { PinPropertyToggle } from '../PinPropertyToggle.js'

const mutateAsync = vi.hoisted(() => vi.fn(async () => {}))

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: { controls: { styles: { setElementPropertyPinned: { mutationOptions: vi.fn(() => ({})) } } } },
	useMutationExt: () => ({ mutateAsync }),
}))

beforeEach(() => mutateAsync.mockClear())

function renderToggle(element: SomeButtonGraphicsElement, property: string, isPinnedView = false) {
	return render(
		<ElementPropertiesProvider
			controlId="control0"
			localVariablesStore={{} as never}
			isPropertyOverridden={() => false}
			isPinnedView={isPinnedView}
		>
			<PinPropertyToggle elementProps={element} property={property} />
		</ElementPropertiesProvider>
	)
}

const textElement = (pinnedProperties: string[]) =>
	({ id: 'text0', type: 'text', pinnedProperties }) as unknown as SomeButtonGraphicsElement

describe('PinPropertyToggle', () => {
	it('unpins a currently-pinned property', () => {
		renderToggle(textElement(['color']), 'color')
		fireEvent.click(screen.getByRole('button'))
		expect(mutateAsync).toHaveBeenCalledWith({
			controlId: 'control0',
			elementId: 'text0',
			property: 'color',
			pinned: false,
		})
	})

	it('pins a property that is not pinned', () => {
		renderToggle(textElement(['color']), 'weight')
		fireEvent.click(screen.getByRole('button'))
		expect(mutateAsync).toHaveBeenCalledWith({
			controlId: 'control0',
			elementId: 'text0',
			property: 'weight',
			pinned: true,
		})
	})

	it('renders no pin control for the canvas, whose properties are button-level', () => {
		const canvas = { id: 'canvas', type: 'canvas' } as unknown as SomeButtonGraphicsElement
		renderToggle(canvas, 'decoration')
		expect(screen.queryByRole('button')).toBeNull()
		expect(mutateAsync).not.toHaveBeenCalled()
	})
})
