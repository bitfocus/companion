import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PropertyFieldRow } from '../PropertyFieldRow.js'

vi.mock('../ExpressionValuePreview.js', () => ({
	ExpressionValuePreview: () => <span data-testid="expression-preview">Preview</span>,
	buildContextResolutionForPreview: () => undefined,
}))

describe('PropertyFieldRow', () => {
	it.each(['form', 'inspector'] as const)('keeps variable icons and previews with the label in %s layout', (layout) => {
		const { container } = render(
			<PropertyFieldRow
				layout={layout}
				label="Text"
				value={{ isExpression: true, value: '1 + 1' }}
				setValue={vi.fn()}
				disableAutoExpression
				localVariablesStore={null}
				entityType={null}
				fieldDefinition={{ type: 'textinput', id: 'text', label: 'Text' }}
				controlId={null}
				allRawOptions={undefined}
				isLocatedInGrid={false}
				disabled={false}
			>
				{(_value, _setValue, inputId) => <input id={inputId} />}
			</PropertyFieldRow>
		)
		const label = screen.getByTestId('expression-preview').closest('label')!
		expect(label).not.toBeNull()
		expect(label.querySelector('[data-icon="dollar-sign"]')).not.toBeNull()
		expect(label.querySelector('[data-icon="globe"]')).not.toBeNull()
		expect(container.querySelector('.property-inspector-status')).toBeNull()
	})
})
