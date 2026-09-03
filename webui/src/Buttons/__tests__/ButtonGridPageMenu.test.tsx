import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Every mutation the menu fires, by the trpc path it was built from */
const sent: { path: string; input: unknown }[] = []

/** Whether the server accepts what it is sent - only a test about failure says otherwise */
let mutationsFail = false

// The real `trpc` proxy is kept, so each mutation is still named by its real path - only the sending
// is stood in for
vi.mock('~/Resources/TRPC.js', async (importOriginal) => {
	const original = await importOriginal<Record<string, unknown>>()
	return {
		...original,
		useMutationExt: (options: { mutationKey?: unknown[][] }) => ({
			...options,
			mutateAsync: async (input: unknown) => {
				sent.push({ path: (options.mutationKey?.[0] ?? []).join('.'), input })
				if (mutationsFail) throw new Error('nope')
			},
		}),
	}
})

const { ButtonGridPageMenu } = await import('../ButtonGridPageMenu.js')
const { RootAppStoreContext } = await import('~/Stores/RootAppStore.js')

/**
 * Wiping a page and recreating its navigation buttons live behind this menu rather than in the row
 * under the grid, so what matters is that they are reachable, and that neither happens without
 * being confirmed first.
 */
function setup() {
	const queryClient = new QueryClient()
	// Deep partial of the root store - the modals behind this menu reach for a couple of things
	const rootStore: any = {
		userConfig: { properties: { gridSize: { minRow: 0, maxRow: 3, minColumn: 0, maxColumn: 7 } } },
		pages: { data: [], get: () => undefined },
		// The export modal's filename field offers variables, and reads them straight off the store
		variablesStore: { allVariableDefinitions: { get: () => [] } },
	}

	const utils = render(
		<QueryClientProvider client={queryClient}>
			<RootAppStoreContext.Provider value={rootStore}>
				<ButtonGridPageMenu pageNumber={3} pageInfo={undefined} />
			</RootAppStoreContext.Provider>
		</QueryClientProvider>
	)

	return { ...utils, user: userEvent.setup() }
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
	await user.click(screen.getByRole('button', { name: 'Page actions' }))
}

beforeEach(() => {
	sent.length = 0
	mutationsFail = false
})

describe('the page menu', () => {
	it('keeps the page actions one click away from the grid', async () => {
		const { user } = setup()

		await openMenu(user)

		for (const label of ['Edit page', 'Export page', 'Recreate navigation buttons', 'Clear page']) {
			expect(screen.getByText(label)).toBeInTheDocument()
		}
	})

	it('asks before wiping a page, naming the page it would wipe', async () => {
		const { user } = setup()
		await openMenu(user)

		await user.click(screen.getByText('Clear page'))

		expect(screen.getByText(/clear all buttons on page 3/)).toBeInTheDocument()
		expect(sent).toEqual([])
	})

	it('wipes the page once that is confirmed', async () => {
		const { user } = setup()
		await openMenu(user)
		await user.click(screen.getByText('Clear page'))

		await user.click(screen.getByRole('button', { name: 'Clear' }))

		expect(sent).toEqual([{ path: 'pages.clearPage', input: { pageNumber: 3 } }])
	})

	it('asks before recreating the navigation buttons, naming the ones it would erase', async () => {
		const { user } = setup()
		await openMenu(user)

		await user.click(screen.getByText('Recreate navigation buttons'))

		expect(screen.getByText(/3\/0\/0, 3\/1\/0 and 3\/2\/0/)).toBeInTheDocument()
		expect(sent).toEqual([])
	})

	it('recreates them once that is confirmed', async () => {
		const { user } = setup()
		await openMenu(user)
		await user.click(screen.getByText('Recreate navigation buttons'))

		await user.click(screen.getByRole('button', { name: 'Recreate' }))

		expect(sent).toEqual([{ path: 'pages.recreateNav', input: { pageNumber: 3 } }])
	})

	it('opens the page properties editor rather than doing anything itself', async () => {
		const { user } = setup()
		await openMenu(user)

		await user.click(screen.getByText('Edit page'))

		expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
		expect(sent).toEqual([])
	})

	it.each([
		['Clear page', 'Clear', 'Clear page failed'],
		['Recreate navigation buttons', 'Recreate', 'Reset nav failed'],
	] as const)('reports a failed %s rather than letting the rejection escape', async (label, confirm, message) => {
		mutationsFail = true
		const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
		const { user } = setup()
		await openMenu(user)
		await user.click(screen.getByText(label))

		await user.click(screen.getByRole('button', { name: confirm }))

		await vi.waitFor(() => expect(errors).toHaveBeenCalledWith(expect.stringContaining(message)))
		errors.mockRestore()
	})

	it('offers the page as an export rather than doing anything itself', async () => {
		const { user } = setup()
		await openMenu(user)

		await user.click(screen.getByText('Export page'))

		expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument()
		expect(sent).toEqual([])
	})
})
