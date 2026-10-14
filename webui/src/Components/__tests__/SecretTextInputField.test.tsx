import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SecretTextInputField } from '../SecretTextInputField.js'

function renderField(checkValid: boolean | undefined) {
	const { container } = render(
		<SecretTextInputField id={undefined} value="hunter2" setValue={vi.fn()} checkValid={checkValid} />
	)
	return container.querySelector('input')
}

describe('SecretTextInputField validity', () => {
	it('marks the input aria-invalid when the value is invalid', () => {
		expect(renderField(false)).toHaveAttribute('aria-invalid', 'true')
	})

	it('does not mark the input aria-invalid when the value is valid or unchecked', () => {
		expect(renderField(true)).toHaveAttribute('aria-invalid', 'false')
		expect(renderField(undefined)).toHaveAttribute('aria-invalid', 'false')
	})
})
