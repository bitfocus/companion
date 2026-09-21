import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import type { ModuleStoreModuleInfoVersion } from '@companion-app/shared/Model/ModulesStore.js'
import { InstanceVersionDeprecatedBadge } from '~/Instances/List/InstanceVersionDeprecatedBadge'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore'

function renderWithVersions(versions: Partial<ModuleStoreModuleInfoVersion>[], moduleVersionId: string | null) {
	const mockStore = {
		modules: {
			storeVersions: {
				subscribeToModuleStoreVersions: () => () => {},
				getModuleStoreVersions: () => ({ versions }),
			},
		},
	} as unknown as RootAppStore

	return render(
		<RootAppStoreContext.Provider value={mockStore}>
			<InstanceVersionDeprecatedBadge
				moduleType={ModuleInstanceType.Connection}
				moduleId="some-module"
				moduleVersionId={moduleVersionId}
				labelStr="connection"
				className={undefined}
			/>
		</RootAppStoreContext.Provider>
	)
}

describe('InstanceVersionDeprecatedBadge', () => {
	it('renders nothing when the installed version is not deprecated', () => {
		renderWithVersions([{ id: '1.2.0', deprecationReason: null }], '1.2.0')
		expect(screen.queryByText('Deprecated')).not.toBeInTheDocument()
	})

	it('renders nothing when another version is the deprecated one', () => {
		renderWithVersions(
			[
				{ id: '1.1.0', deprecationReason: 'Sends the wrong command.' },
				{ id: '1.2.0', deprecationReason: null },
			],
			'1.2.0'
		)
		expect(screen.queryByText('Deprecated')).not.toBeInTheDocument()
	})

	it('renders nothing for a version which does not come from the store', () => {
		renderWithVersions([{ id: '1.2.0', deprecationReason: 'Sends the wrong command.' }], 'dev')
		expect(screen.queryByText('Deprecated')).not.toBeInTheDocument()
	})

	it('renders nothing when the instance has no version', () => {
		renderWithVersions([{ id: '1.2.0', deprecationReason: 'Sends the wrong command.' }], null)
		expect(screen.queryByText('Deprecated')).not.toBeInTheDocument()
	})

	it('renders the badge when the installed version is deprecated', () => {
		renderWithVersions([{ id: '1.2.0', deprecationReason: 'Sends the wrong command.' }], '1.2.0')
		expect(screen.getByText('Deprecated')).toHaveClass('badge-pill-danger')
	})

	it('tells the user what is wrong and what to do', async () => {
		const user = userEvent.setup()
		renderWithVersions([{ id: '1.2.0', deprecationReason: 'Sends the wrong command.' }], '1.2.0')
		await user.hover(screen.getByText('Deprecated'))
		await waitFor(() => expect(screen.getByRole('tooltip')).toBeInTheDocument(), { timeout: 1000 })
		expect(screen.getByRole('tooltip')).toHaveTextContent(
			'This version has a known problem and should not be used: Sends the wrong command. Change this connection to a different version.'
		)
	})
})
