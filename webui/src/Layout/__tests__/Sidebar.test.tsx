import { act, fireEvent, render, screen } from '@testing-library/react'
import type { MouseEvent, ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MySidebar, SidebarStateProvider, useSidebarState } from '../Sidebar'

const { layoutMode, routeSelection } = vi.hoisted(() => ({
	layoutMode: { mobile: false },
	routeSelection: vi.fn(),
}))

vi.mock('@tanstack/react-router', async () => {
	const { forwardRef } = await import('react')

	return {
		Link: forwardRef<
			HTMLAnchorElement,
			{
				children: ReactNode
				className?: string
				onClick?: (event: MouseEvent<HTMLAnchorElement>) => void
				target?: string
				title?: string
				to: string
			}
		>(({ children, onClick, to, ...props }, ref) => (
			<a
				{...props}
				ref={ref}
				href={to}
				onClick={(event) => {
					onClick?.(event)
					if (!event.defaultPrevented) routeSelection(to)
				}}
			>
				{children}
			</a>
		)),
		useMatchRoute: () => () => false,
	}
})

vi.mock('~/Hooks/useLayoutMode', () => ({
	useMobileMode: () => layoutMode.mobile,
}))

vi.mock('~/Stores/RootAppStore.js', async () => {
	const { createContext } = await import('react')

	return {
		RootAppStoreContext: createContext({
			connections: { rootCollections: () => [] },
			modules: { getModuleFriendlyName: () => '' },
			whatsNewModal: { current: null },
			wizardOpen: { set: vi.fn() },
		}),
	}
})

vi.mock('~/Stores/Util.js', () => ({
	useSortedConnectionsThatHaveVariables: () => [],
}))

vi.mock('~/Surfaces/TabNotifyIcon.js', () => ({
	ConnectionsTabNotifyIcon: () => null,
	SurfacesTabNotifyIcon: () => null,
}))

vi.mock('~/Components/ContextMenu', () => ({
	ContextMenu: () => null,
}))

vi.mock('~/Components/useContextMenuProps', () => ({
	MenuSeparator: {},
	useContextMenuState: () => ({ onContextMenu: vi.fn() }),
}))

vi.mock('~/Components/Tooltip.js', () => ({
	Tooltip: {
		Root: ({ children }: { children: ReactNode }) => children,
		Trigger: ({ render }: { render: ReactNode }) => render,
		Popup: ({ children }: { children: ReactNode }) => children,
	},
}))

vi.mock('../SidebarHeader', () => ({
	SidebarHeader: () => null,
	SidebarFooter: () => (
		<div className="sidebar-footer2">
			<button type="button">Footer control</button>
		</div>
	),
}))

function ShowSidebarButton() {
	const { handleShowSidebar } = useSidebarState()
	return (
		<button type="button" onClick={handleShowSidebar}>
			Show sidebar
		</button>
	)
}

function renderSidebar({ mobile = false }: { mobile?: boolean } = {}) {
	layoutMode.mobile = mobile
	window.localStorage.setItem('sidebar_foldable', 'true')
	window.localStorage.setItem('sidebar_narrow_mode', 'false')

	const result = render(
		<SidebarStateProvider>
			<ShowSidebarButton />
			<MySidebar />
		</SidebarStateProvider>
	)

	return {
		...result,
		sidebar: result.container.querySelector('.sidebar') as HTMLElement,
	}
}

function finishDeferredFold() {
	act(() => vi.runAllTimers())
}

describe('Sidebar folding pointer interactions', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		window.localStorage.clear()
		routeSelection.mockClear()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('folds after a primary touch selection without interfering with navigation', () => {
		const { sidebar } = renderSidebar()
		const link = screen.getByRole('link', { name: 'Connections' })

		fireEvent.pointerUp(link, { button: 0, pointerType: 'touch' })
		fireEvent.click(link)

		expect(routeSelection).toHaveBeenCalledWith('/connections')
		expect(sidebar).not.toHaveClass('sidebar-narrow')

		finishDeferredFold()
		expect(sidebar).toHaveClass('sidebar-narrow')
	})

	it('expands a temporarily narrowed sidebar for a later touch and folds after that selection', () => {
		const { sidebar } = renderSidebar()
		const firstLink = screen.getByRole('link', { name: 'Connections' })
		const secondLink = screen.getByRole('link', { name: 'Image Library' })

		fireEvent.pointerUp(firstLink, { button: 0, pointerType: 'touch' })
		finishDeferredFold()
		expect(sidebar).toHaveClass('sidebar-narrow')

		fireEvent.pointerEnter(sidebar, { pointerType: 'touch' })
		expect(sidebar).not.toHaveClass('sidebar-narrow')

		fireEvent.pointerUp(secondLink, { button: 0, pointerType: 'touch' })
		expect(sidebar).not.toHaveClass('sidebar-narrow')
		finishDeferredFold()
		expect(sidebar).toHaveClass('sidebar-narrow')
	})

	it.each(['mouse', 'pen'])('folds after a primary %s pointer selection', (pointerType) => {
		const { sidebar } = renderSidebar()
		const link = screen.getByRole('link', { name: 'Connections' })

		fireEvent.pointerUp(link, { button: 0, pointerType })
		finishDeferredFold()

		expect(sidebar).toHaveClass('sidebar-narrow')
	})

	it('does not fold for secondary buttons, group toggles, footer controls, or blank areas', () => {
		const { sidebar } = renderSidebar()
		const link = screen.getByRole('link', { name: 'Connections' })
		const groupToggle = screen.getAllByText('Surfaces')[0].closest('.nav-group-toggle') as HTMLElement

		fireEvent.pointerUp(link, { button: 2, pointerType: 'mouse' })
		fireEvent.pointerUp(groupToggle, { button: 0, pointerType: 'touch' })
		fireEvent.pointerUp(screen.getByRole('button', { name: 'Footer control' }), {
			button: 0,
			pointerType: 'touch',
		})
		fireEvent.pointerUp(sidebar, { button: 0, pointerType: 'touch' })
		finishDeferredFold()

		expect(sidebar).not.toHaveClass('sidebar-narrow')
	})

	it('dismisses the mobile sidebar after selecting a link without applying desktop narrow state', () => {
		const { sidebar } = renderSidebar({ mobile: true })
		fireEvent.click(screen.getByRole('button', { name: 'Show sidebar' }))
		expect(sidebar).toHaveClass('show')

		const link = screen.getByRole('link', { name: 'Connections' })
		fireEvent.pointerUp(link, { button: 0, pointerType: 'touch' })
		fireEvent.click(link)

		expect(sidebar).not.toHaveClass('show')
		finishDeferredFold()
		expect(sidebar).not.toHaveClass('sidebar-narrow')
		expect(routeSelection).toHaveBeenCalledWith('/connections')
	})
})
