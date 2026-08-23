import { render, type RenderResult } from '@testing-library/react'
import { vi } from 'vitest'
import type { ControlLocation } from '@companion-app/shared/Model/Common.js'
import { ButtonGridStore } from '../ButtonGridStore.js'
import { ButtonGridViewProvider, type ButtonGridView } from '../ButtonGridViewContext.js'
import type { GridToolActions } from '../GridTools/index.js'

/** A location, written the way the grid reads: row then column */
export function at(row: number, column: number, pageNumber = 1): ControlLocation {
	return { pageNumber, row, column }
}

/**
 * The things a tool can make happen, all stubbed.
 *
 * Defaults describe a grid where every cell holds a button and everything fits, which is the least
 * interesting case - a test that cares about either says so.
 */
export function makeGridActions(overrides: Partial<GridToolActions> = {}): GridToolActions {
	return {
		openEditor: vi.fn(),
		press: vi.fn(),
		// The real one asks before replacing anything, and only reports back once it has happened
		transfer: vi.fn((_operation, _pairs, onApplied: () => void) => onApplied()),
		clearButtons: vi.fn(),
		isOccupied: vi.fn(() => true),
		pasteAt: vi.fn(),
		fitsOnGrid: vi.fn(() => true),
		...overrides,
	}
}

export interface GridViewHarness extends ButtonGridView {
	store: ButtonGridStore
	actions: GridToolActions
}

/** A real store with stubbed actions - the class under test with mocked collaborators */
export function makeGridView(overrides: Partial<GridToolActions> = {}): GridViewHarness {
	return { store: new ButtonGridStore(), actions: makeGridActions(overrides), onContextMenu: vi.fn() }
}

export function renderInGridView(ui: React.ReactNode, view: ButtonGridView): RenderResult {
	return render(<ButtonGridViewProvider value={view}>{ui}</ButtonGridViewProvider>)
}
