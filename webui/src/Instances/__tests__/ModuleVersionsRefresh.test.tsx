import { act, fireEvent, render, screen } from '@testing-library/react'
import { runInAction } from 'mobx'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { ModuleInfoStore } from '~/Stores/ModuleInfoStore.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { ModuleVersionsRefresh } from '../ModuleVersionsRefresh.js'

// Captured so tests can assert the refresh was actually requested (and with which module)
const mutateAsync = vi.hoisted(() => vi.fn())

vi.mock('~/Resources/TRPC', () => ({
	trpc: {
		instances: {
			modulesStore: {
				refreshModuleInfo: { mutationOptions: () => ({}) },
			},
		},
	},
	useMutationExt: () => ({ mutateAsync }),
}))

const MODULE_ID = 'my-module'
const PROGRESS_KEY = `${ModuleInstanceType.Surface}:${MODULE_ID}` as const

function renderRefresh(modules: ModuleInfoStore, moduleId: string | null = MODULE_ID) {
	const store = { modules } as unknown as RootAppStore
	return render(
		<RootAppStoreContext.Provider value={store}>
			<ModuleVersionsRefresh moduleType={ModuleInstanceType.Surface} moduleId={moduleId} />
		</RootAppStoreContext.Provider>
	)
}

beforeEach(() => {
	vi.useFakeTimers()
	mutateAsync.mockReset()
	mutateAsync.mockResolvedValue(undefined)
})
afterEach(() => {
	vi.useRealTimers()
})

describe('ModuleVersionsRefresh', () => {
	it('shows the clickable refresh control when idle', () => {
		renderRefresh(new ModuleInfoStore())

		expect(screen.getByLabelText('Refresh module versions')).toBeInTheDocument()
		expect(screen.queryByLabelText(/Refreshing module info/)).not.toBeInTheDocument()
	})

	it('spins while progress is reported under the moduleType:moduleId key', () => {
		const modules = new ModuleInfoStore()
		runInAction(() => modules.storeRefreshProgress.set(PROGRESS_KEY, { percent: 0.5, failed: false }))

		renderRefresh(modules)

		expect(screen.getByLabelText('Refreshing module info 50%')).toBeInTheDocument()
	})

	it('ignores progress for a different module (keyed by moduleType:moduleId)', () => {
		const modules = new ModuleInfoStore()
		runInAction(() =>
			modules.storeRefreshProgress.set(`${ModuleInstanceType.Surface}:other-module`, { percent: 0.5, failed: false })
		)

		renderRefresh(modules)

		// Another module's progress must not be picked up - this control stays idle
		expect(screen.getByLabelText('Refresh module versions')).toBeInTheDocument()
		expect(screen.queryByLabelText(/Refreshing module info/)).not.toBeInTheDocument()
	})

	it('briefly shows a checkmark once a refresh completes, then returns to idle', () => {
		const modules = new ModuleInfoStore()
		runInAction(() => modules.storeRefreshProgress.set(PROGRESS_KEY, { percent: 0, failed: false }))

		renderRefresh(modules)
		expect(screen.getByLabelText('Refreshing module info 0%')).toBeInTheDocument()

		// Complete the refresh
		act(() => {
			runInAction(() => modules.storeRefreshProgress.set(PROGRESS_KEY, { percent: 1, failed: false }))
		})
		expect(screen.getByLabelText('Module versions refreshed')).toBeInTheDocument()
		expect(screen.queryByLabelText('Refresh module versions')).not.toBeInTheDocument()

		// After the timeout it reverts to the idle refresh control
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(screen.getByLabelText('Refresh module versions')).toBeInTheDocument()
		expect(screen.queryByLabelText('Module versions refreshed')).not.toBeInTheDocument()
	})

	it('briefly shows a cross when a refresh completes with a failure', () => {
		const modules = new ModuleInfoStore()
		runInAction(() => modules.storeRefreshProgress.set(PROGRESS_KEY, { percent: 0, failed: false }))

		renderRefresh(modules)
		expect(screen.getByLabelText('Refreshing module info 0%')).toBeInTheDocument()

		// Complete the refresh with a failure
		act(() => {
			runInAction(() => modules.storeRefreshProgress.set(PROGRESS_KEY, { percent: 1, failed: true }))
		})
		expect(screen.getByLabelText('Failed to refresh module versions')).toBeInTheDocument()
		expect(screen.queryByLabelText('Module versions refreshed')).not.toBeInTheDocument()

		// After the timeout it reverts to the idle refresh control
		act(() => {
			vi.advanceTimersByTime(2000)
		})
		expect(screen.getByLabelText('Refresh module versions')).toBeInTheDocument()
		expect(screen.queryByLabelText('Failed to refresh module versions')).not.toBeInTheDocument()
	})

	it('does not show a checkmark on first render when never refreshing', () => {
		renderRefresh(new ModuleInfoStore())

		expect(screen.queryByLabelText('Module versions refreshed')).not.toBeInTheDocument()
	})

	it('requests a refresh for this module when clicked', () => {
		renderRefresh(new ModuleInfoStore())

		fireEvent.click(screen.getByRole('button', { name: 'Refresh module versions' }))

		expect(mutateAsync).toHaveBeenCalledTimes(1)
		expect(mutateAsync).toHaveBeenCalledWith({ moduleType: ModuleInstanceType.Surface, moduleId: MODULE_ID })
	})

	it.each(['Enter', ' '])('requests a refresh when activated with the %s key', (key) => {
		renderRefresh(new ModuleInfoStore())

		fireEvent.keyDown(screen.getByRole('button', { name: 'Refresh module versions' }), { key })

		expect(mutateAsync).toHaveBeenCalledTimes(1)
		expect(mutateAsync).toHaveBeenCalledWith({ moduleType: ModuleInstanceType.Surface, moduleId: MODULE_ID })
	})

	it('ignores other keys', () => {
		renderRefresh(new ModuleInfoStore())

		fireEvent.keyDown(screen.getByRole('button', { name: 'Refresh module versions' }), { key: 'a' })

		expect(mutateAsync).not.toHaveBeenCalled()
	})

	it('renders the idle control but does not refresh when there is no module', () => {
		renderRefresh(new ModuleInfoStore(), null)

		const button = screen.getByRole('button', { name: 'Refresh module versions' })
		fireEvent.click(button)

		expect(mutateAsync).not.toHaveBeenCalled()
	})
})
