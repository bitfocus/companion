import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import type { ClientTriggerData } from '@companion-app/shared/Model/TriggerModel.js'
import { RootAppStoreContext, type RootAppStore } from '~/Stores/RootAppStore.js'
import { TriggersListStore } from '~/Stores/TriggersListStore.js'
import { TriggerPicker } from '../TriggerPicker.js'

test.each(['replace', 'append'] as const)('%s preserves the trigger control ID from the store', async (mode) => {
	const triggersList = new TriggersListStore()
	const controlId = 'trigger:_aBEKOIlAlz7YD0liSn4h'
	triggersList.updateTriggers({
		type: 'init',
		triggers: { [controlId]: { name: 'Destination trigger' } as ClientTriggerData },
	})
	const selectControl = vi.fn()
	render(
		<RootAppStoreContext.Provider value={{ triggersList } as RootAppStore}>
			<TriggerPicker selectControl={selectControl} />
		</RootAppStoreContext.Provider>
	)
	await userEvent.setup().click(
		screen.getByRole('button', {
			name: mode === 'replace' ? 'Replace all the actions on the trigger' : 'Append to the existing actions',
		})
	)
	expect(selectControl).toHaveBeenCalledWith(controlId, '', 0, mode)
})
