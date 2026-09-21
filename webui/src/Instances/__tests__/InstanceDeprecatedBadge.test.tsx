import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleStoreListCacheEntry } from '@companion-app/shared/Model/ModulesStore.js'
import { InstanceDeprecatedBadge } from '~/Instances/List/InstanceDeprecatedBadge'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore'

function renderWithStoreInfo(storeInfo: Partial<ModuleStoreListCacheEntry> | undefined) {
	const mockStore = {
		modules: {
			getStoreInfo: () => storeInfo,
		},
	} as unknown as RootAppStore

	return render(
		<RootAppStoreContext.Provider value={mockStore}>
			<InstanceDeprecatedBadge
				moduleType={ModuleInstanceType.Connection}
				moduleId="some-module"
				className={undefined}
			/>
		</RootAppStoreContext.Provider>
	)
}

describe('InstanceDeprecatedBadge', () => {
	it('renders nothing when the module is not in the store', () => {
		renderWithStoreInfo(undefined)
		expect(screen.queryByText('Deprecated')).not.toBeInTheDocument()
	})

	it('renders nothing when the module is not deprecated', () => {
		renderWithStoreInfo({ deprecationReason: null })
		expect(screen.queryByText('Deprecated')).not.toBeInTheDocument()
	})

	it('renders the badge when the module is deprecated', () => {
		renderWithStoreInfo({ deprecationReason: 'Use some-other-module instead.' })
		expect(screen.getByText('Deprecated')).toHaveClass('badge-pill-warning')
	})

	it('puts the deprecation reason in the tooltip', async () => {
		const user = userEvent.setup()
		renderWithStoreInfo({ deprecationReason: 'Use some-other-module instead.' })
		await user.hover(screen.getByText('Deprecated'))
		await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument(), { timeout: 1000 })
		expect(screen.getByRole('tooltip')).toHaveTextContent('Use some-other-module instead.')
	})
})
