import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ClientBonjourService, DropdownChoiceId } from '@companion-app/shared/Model/Common.js'
import { BonjourDeviceInputField } from '../BonjourDeviceInputField.js'
import { MenuPortalContext } from '../MenuPortalContext.js'

// Must be created with vi.hoisted so it is accessible inside vi.mock factories,
// which are also hoisted and therefore run before import statements.
type BonjourCbs = { onStarted?: () => void; onData?: (d: unknown) => void }
const bonjourMock = vi.hoisted(() => {
	let cbs: BonjourCbs = {}
	let lastInput: unknown
	return {
		capture: (input: unknown, incoming: BonjourCbs) => {
			lastInput = input
			cbs = incoming
			return {} as never
		},
		start: () => cbs.onStarted?.(),
		emit: (data: unknown) => cbs.onData?.(data),
		getLastInput: () => lastInput,
		reset: () => {
			cbs = {}
			lastInput = undefined
		},
	}
})

vi.mock('@trpc/tanstack-react-query', () => ({ useSubscription: vi.fn() }))

vi.mock('~/Resources/TRPC.js', () => ({
	trpc: {
		bonjour: {
			watchQuery: {
				subscriptionOptions: (input: unknown, callbacks: BonjourCbs) => bonjourMock.capture(input, callbacks),
			},
		},
	},
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
	bonjourMock.reset()
})

function makeService(
	name: string,
	fqdn: string,
	addresses: string[],
	port: number,
	subId = fqdn
): ClientBonjourService {
	return { name, fqdn, addresses, port, subId }
}

function ControlledField({
	initialValue,
	onSetValue,
	connectionId = 'conn1',
	queryId = 'query1',
}: {
	initialValue: string | null
	onSetValue?: (v: DropdownChoiceId | null) => void
	connectionId?: string
	queryId?: string
}) {
	const [value, setValue] = useState<string | null>(initialValue)
	return (
		<MenuPortalContext.Provider value={document.body}>
			<BonjourDeviceInputField
				id={undefined}
				value={value}
				setValue={(v) => {
					setValue(v !== null ? String(v) : null)
					onSetValue?.(v)
				}}
				connectionId={connectionId}
				queryId={queryId}
			/>
		</MenuPortalContext.Provider>
	)
}

function renderField({
	initialValue = null,
	onSetValue,
	connectionId = 'conn1',
	queryId = 'query1',
}: {
	initialValue?: string | null
	onSetValue?: (v: DropdownChoiceId | null) => void
	connectionId?: string
	queryId?: string
} = {}) {
	const setValue = onSetValue ?? vi.fn()
	const user = userEvent.setup()
	const utils = render(
		<ControlledField initialValue={initialValue} onSetValue={setValue} connectionId={connectionId} queryId={queryId} />
	)
	const input = utils.getByRole('combobox')
	return { ...utils, input, setValue, user }
}

async function openDropdown(user: ReturnType<typeof userEvent.setup>, input: HTMLElement) {
	await user.click(input)
	return screen.getByRole('listbox')
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('BonjourDeviceInputField', () => {
	// -------------------------------------------------------------------------
	// Initial rendering
	// -------------------------------------------------------------------------

	describe('initial rendering', () => {
		it('shows "Manual" when value is null', () => {
			const { input } = renderField({ initialValue: null })
			expect(input).toHaveValue('Manual')
		})

		it('shows "*Unavailable*" for an unrecognised address', () => {
			const { input } = renderField({ initialValue: '192.168.1.1:8080' })
			expect(input).toHaveValue('*Unavailable* (192.168.1.1:8080)')
		})

		it('shows the device label once the matching service is discovered', () => {
			const svc = makeService('My Camera', 'mycam.local', ['192.168.1.50'], 8080)
			const { input } = renderField({ initialValue: '192.168.1.50:8080' })

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			expect(input).toHaveValue('My Camera (192.168.1.50:8080)')
		})
	})

	// -------------------------------------------------------------------------
	// Subscription wiring
	// -------------------------------------------------------------------------

	describe('subscription wiring', () => {
		it('passes connectionId and queryId to the subscription', () => {
			renderField({ connectionId: 'myConn', queryId: 'myQuery' })
			expect(bonjourMock.getLastInput()).toEqual({ connectionId: 'myConn', queryId: 'myQuery' })
		})

		it('clears discovered services when the subscription restarts (onStarted)', async () => {
			const svc = makeService('Switch', 'switch.local', ['10.0.0.1'], 9000)
			const { user, input } = renderField()

			// Discover a service then restart the subscription
			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})
			act(() => {
				bonjourMock.start()
			})

			const listbox = await openDropdown(user, input)
			expect(within(listbox).queryByText('Switch (10.0.0.1:9000)')).toBeNull()
		})
	})

	// -------------------------------------------------------------------------
	// Service discovery
	// -------------------------------------------------------------------------

	describe('service discovery', () => {
		it('adds a discovered service to the choices on "up" event', async () => {
			const svc = makeService('My Mixer', 'mixer.local', ['10.0.1.5'], 3000)
			const { user, input } = renderField()

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			const listbox = await openDropdown(user, input)
			expect(within(listbox).getByText('My Mixer (10.0.1.5:3000)')).toBeInTheDocument()
		})

		it('removes a service from the choices on "down" event', async () => {
			const svc = makeService('My Mixer', 'mixer.local', ['10.0.1.5'], 3000)
			const { user, input } = renderField()

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
				bonjourMock.emit({ type: 'down', fqdn: 'mixer.local' })
			})

			const listbox = await openDropdown(user, input)
			expect(within(listbox).queryByText('My Mixer (10.0.1.5:3000)')).toBeNull()
		})

		it('creates one choice per address for a multi-address service', async () => {
			const svc = makeService('Camera', 'cam.local', ['10.0.0.1', '10.0.0.2'], 1234)
			const { user, input } = renderField()

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			const listbox = await openDropdown(user, input)
			expect(within(listbox).getByText('Camera (10.0.0.1:1234)')).toBeInTheDocument()
			expect(within(listbox).getByText('Camera (10.0.0.2:1234)')).toBeInTheDocument()
		})

		it('always shows "Manual" as the first choice', async () => {
			const svc = makeService('Device', 'dev.local', ['10.0.0.5'], 80)
			const { user, input } = renderField()

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			const listbox = await openDropdown(user, input)
			const options = within(listbox).getAllByRole('option')
			expect(options[0]).toHaveTextContent('Manual')
		})

		it('shows "*Unavailable*" entry while no matching service is discovered', async () => {
			const { user, input } = renderField({ initialValue: '10.0.0.99:5000' })

			const listbox = await openDropdown(user, input)
			expect(within(listbox).getByText('*Unavailable* (10.0.0.99:5000)')).toBeInTheDocument()
		})

		it('replaces the "*Unavailable*" entry once the matching service is discovered', async () => {
			const svc = makeService('Deck', 'deck.local', ['10.0.0.99'], 5000)
			const { user, input } = renderField({ initialValue: '10.0.0.99:5000' })

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			const listbox = await openDropdown(user, input)
			expect(within(listbox).queryByText('*Unavailable* (10.0.0.99:5000)')).toBeNull()
			expect(within(listbox).getByText('Deck (10.0.0.99:5000)')).toBeInTheDocument()
		})
	})

	// -------------------------------------------------------------------------
	// Value selection
	// -------------------------------------------------------------------------

	describe('value selection', () => {
		it('calls setValue(null) when "Manual" is selected', async () => {
			const onSetValue = vi.fn()
			const { user, input } = renderField({ initialValue: '192.168.1.1:8080', onSetValue })

			const listbox = await openDropdown(user, input)
			await user.click(within(listbox).getByText('Manual'))

			expect(onSetValue).toHaveBeenCalledWith(null)
		})

		it('calls setValue with the address string when a device is selected', async () => {
			const svc = makeService('Mixer', 'mixer.local', ['10.1.2.3'], 4567)
			const onSetValue = vi.fn()
			const { user, input } = renderField({ onSetValue })

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			const listbox = await openDropdown(user, input)
			await user.click(within(listbox).getByText('Mixer (10.1.2.3:4567)'))

			expect(onSetValue).toHaveBeenCalledWith('10.1.2.3:4567')
		})

		it('does not call setValue with null for a non-manual selection', async () => {
			const svc = makeService('Mixer', 'mixer.local', ['10.1.2.3'], 4567)
			const onSetValue = vi.fn()
			const { user, input } = renderField({ onSetValue })

			act(() => {
				bonjourMock.emit({ type: 'up', service: svc })
			})

			const listbox = await openDropdown(user, input)
			await user.click(within(listbox).getByText('Mixer (10.1.2.3:4567)'))

			expect(onSetValue).not.toHaveBeenCalledWith(null)
		})
	})
})
