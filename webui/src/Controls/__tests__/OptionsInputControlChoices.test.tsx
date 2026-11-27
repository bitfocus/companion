import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EntityModelType } from '@companion-app/shared/Model/EntityModel.js'
import { exprVal, type SomeCompanionInputField } from '@companion-app/shared/Model/Options.js'

const { capture } = vi.hoisted(() => ({ capture: vi.fn() }))
vi.mock('~/Components/DropdownInputField.js', () => ({ DropdownInputField: capture }))
vi.mock('~/Components/MultiDropdownInputField.js', () => ({ MultiDropdownInputField: capture }))

const { OptionsInputControl } = await import('../OptionsInputControl.js')

describe('dependent dropdown controls', () => {
	it.each(['dropdown', 'multidropdown'] as const)(
		'filters %s suggestions while validating against all choices',
		(type) => {
			capture.mockReset().mockReturnValue(null)
			const setValue = vi.fn()
			const choices = [
				{ id: 'camera', label: 'Camera', isVisibleExpression: '$(options:scene) == "Live"' },
				{ id: 'slides', label: 'Slides', isVisibleExpression: '$(options:scene) == "Slides"' },
			]
			const value = type === 'dropdown' ? 'camera' : ['camera']
			const option: SomeCompanionInputField =
				type === 'dropdown'
					? { type, id: 'source', label: 'Source', choices, default: 'camera' }
					: { type, id: 'source', label: 'Source', choices, default: ['camera'] }
			const control = (scene: string) => (
				<OptionsInputControl
					inputId="source"
					allowInternalFields={false}
					isLocatedInGrid={true}
					entityType={EntityModelType.Action}
					option={option}
					value={value}
					setValue={setValue}
					localVariablesStore={null}
					allRawOptions={{ scene: exprVal(scene) }}
				/>
			)
			const { rerender } = render(control('Live'))
			expect(capture.mock.lastCall?.[0].choices).toEqual([choices[0]])
			rerender(control('Slides'))
			const props = capture.mock.lastCall?.[0]
			expect(props.choices).toEqual([choices[1]])
			expect(props.value).toEqual(value)
			expect(props.checkValid(value)).toBe(true)
			expect(setValue).not.toHaveBeenCalled()
		}
	)
})
