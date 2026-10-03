import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { InstanceVersionUpdatePolicy, ModuleInstanceType } from '@companion-app/shared/Model/Instance.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import type { ClientConnectionConfigWithId } from '../ConnectionList.js'
import { ConnectionListContextProvider, type ConnectionListContextType } from '../ConnectionListContext.js'
import { ConnectionsTableRow } from '../ConnectionsTableRow.js'

const mutationMocks = vi.hoisted(() => ({
	delete: vi.fn(),
	duplicate: vi.fn(),
	setEnabled: vi.fn(),
}))

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: {
		instances: {
			connections: {
				delete: { mutationOptions: () => 'delete' },
				duplicate: { mutationOptions: () => 'duplicate' },
				setEnabled: { mutationOptions: () => 'setEnabled' },
			},
		},
	},
	useMutationExt: (mutation: keyof typeof mutationMocks) => ({ mutateAsync: mutationMocks[mutation] }),
}))

vi.mock('~/Components/Popover.js', () => ({
	Popover: {
		Item: ({ children, ...props }: { children: ReactNode; onClick: () => void; title: string; disabled?: boolean }) => (
			<button {...props}>{children}</button>
		),
	},
}))

vi.mock('~/Instances/List/InstancesListTableRow.js', () => ({
	InstancesListTableRow: ({ extraMenuItems }: { extraMenuItems: ReactNode }) => <div>{extraMenuItems}</div>,
}))

const connection: ClientConnectionConfigWithId = {
	id: 'source-connection',
	label: 'camera',
	moduleType: ModuleInstanceType.Connection,
	moduleId: 'test-camera',
	moduleVersionId: '1.2.3',
	updatePolicy: InstanceVersionUpdatePolicy.Stable,
	enabled: true,
	sortOrder: 0,
	collectionId: null,
	hasRecordActionsHandler: false,
	status: undefined,
}

function renderRow(configureConnection: ConnectionListContextType['configureConnection']) {
	const rootStore = {
		connections: {},
		variablesStore: { variables: new Map() },
	} as unknown as RootAppStore

	render(
		<RootAppStoreContext.Provider value={rootStore}>
			<ConnectionListContextProvider
				visibleConnections={{} as ConnectionListContextType['visibleConnections']}
				showVariables={vi.fn()}
				deleteModalRef={{ current: null }}
				configureConnection={configureConnection}
			>
				<ConnectionsTableRow connection={connection} isSelected={false} />
			</ConnectionListContextProvider>
		</RootAppStoreContext.Provider>
	)
}

describe('ConnectionsTableRow duplicate', () => {
	it('duplicates the connection and opens the new connection', async () => {
		const user = userEvent.setup()
		const configureConnection = vi.fn()
		mutationMocks.duplicate.mockResolvedValueOnce('duplicated-connection')
		renderRow(configureConnection)

		await user.click(screen.getByRole('button', { name: 'Duplicate' }))

		expect(mutationMocks.duplicate).toHaveBeenCalledWith({ connectionId: 'source-connection' })
		await waitFor(() => expect(configureConnection).toHaveBeenCalledWith('duplicated-connection'))
	})
})
