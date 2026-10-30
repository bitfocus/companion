import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ButtonEditorTabs } from '../ButtonEditorTabs.js'

const { renameMutation } = vi.hoisted(() => ({
	renameMutation: { mutateAsync: vi.fn().mockResolvedValue(true) },
}))

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: { controls: { steps: { rename: { mutationOptions: () => ({}) } } } },
	useMutationExt: () => renameMutation,
}))

vi.mock('~/Services/Controls/ControlActionStepsAndSetsService.js', () => ({
	useControlActionStepsAndSetsService: () => ({}),
}))

vi.mock('~/Components/GenericConfirmModal.js', () => ({ GenericConfirmModal: () => null }))
vi.mock('../ControlActionStepTab.js', () => ({ ControlActionStepTab: () => null }))

type EditorProps = ComponentProps<typeof ButtonEditorTabs>

function editorProps(name?: string): EditorProps {
	return {
		controlId: 'bank:1-0-0',
		location: { pageNumber: 1, row: 0, column: 0 },
		steps: {
			0: {
				options: { name, runWhileHeld: [] },
				action_sets: { down: [], up: [], rotate_left: [], rotate_right: [] },
			},
		},
		disabledSetStep: false,
		runtimeProps: { current_step_id: '0' },
		rotaryActions: false,
		localVariablesStore: {} as EditorProps['localVariablesStore'],
		activeMainTab: 'actions',
	}
}

beforeEach(() => {
	localStorage.clear()
	vi.clearAllMocks()
})

afterEach(() => vi.restoreAllMocks())

describe('inline step renaming', () => {
	it('opens on double-click with focus and the measured tab dimensions', async () => {
		const user = userEvent.setup()
		render(<ButtonEditorTabs {...editorProps()} />)
		const tab = screen.getByRole('button', { name: 'Step 1' })
		vi.spyOn(tab, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 224, 30))

		await user.click(tab)
		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

		await user.dblClick(tab)

		const input = screen.getByRole('textbox')
		expect(input).toHaveFocus()
		expect(input).toHaveValue('')
		expect(input.closest('.button-step-rename')).toHaveStyle({ width: '224px', height: '30px' })
		expect(renameMutation.mutateAsync).not.toHaveBeenCalled()
	})

	it.each(['blur', 'Enter', 'Escape'] as const)('exits editing on %s while retaining the saved name', async (exit) => {
		const user = userEvent.setup()
		const { rerender } = render(<ButtonEditorTabs {...editorProps('Intro')} />)
		await user.dblClick(screen.getByRole('button', { name: 'Intro (1)' }))
		const input = screen.getByRole('textbox')
		expect(input).toHaveValue('Intro')

		await user.clear(input)
		await user.type(input, 'Opening')
		expect(renameMutation.mutateAsync).toHaveBeenLastCalledWith({
			controlId: 'bank:1-0-0',
			stepId: '0',
			newName: 'Opening',
		})
		// Simulate the saved configuration arriving from the server before leaving the field.
		rerender(<ButtonEditorTabs {...editorProps('Opening')} />)
		const renameCount = renameMutation.mutateAsync.mock.calls.length

		if (exit === 'blur') await user.tab()
		else await user.keyboard(`{${exit}}`)

		expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
		expect(screen.getByRole('button', { name: 'Opening (1)' })).toBeInTheDocument()
		expect(renameMutation.mutateAsync).toHaveBeenCalledTimes(renameCount)
	})
})
