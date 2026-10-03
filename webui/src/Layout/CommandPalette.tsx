import type { IconDefinition } from '@fortawesome/fontawesome-svg-core'
import {
	faArrowRight,
	faBorderAll,
	faClock,
	faDollarSign,
	faDownload,
	faMagnifyingGlass,
	faPlug,
	faRotate,
	faSearch,
	faTableCells,
	faTrash,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { useNavigate } from '@tanstack/react-router'
import copy from 'copy-to-clipboard'
import fuzzysort from 'fuzzysort'
import { observer } from 'mobx-react-lite'
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { GenericConfirmModal, type GenericConfirmModalRef } from '~/Components/GenericConfirmModal.js'
import { Modal } from '~/Components/Modal'
import { trpc, useMutationExt } from '~/Resources/TRPC.js'
import { makeAbsolutePath } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { commandPaletteOpen } from './CommandPaletteState.js'
import { ALL_NAV_PAGES } from './navRegistry.js'
import { pageMatrixOpen } from './PageMatrixState.js'

interface CommandItem {
	id: string
	category: 'Navigation' | 'Connections' | 'Variables' | 'Quick Actions'
	title: string
	subtitle?: string
	icon: IconDefinition
	badge?: string
	onSelect: () => void
}

export const CommandPalette = observer(function CommandPalette() {
	const isOpen = commandPaletteOpen.get()

	// Global shortcut listener for Cmd+K / Ctrl+K and /
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
				e.preventDefault()
				commandPaletteOpen.set(!commandPaletteOpen.get())
			} else if (e.key === '/' && !commandPaletteOpen.get()) {
				const tag = (document.activeElement?.tagName || '').toLowerCase()
				if (tag !== 'input' && tag !== 'textarea' && !document.activeElement?.hasAttribute('contenteditable')) {
					e.preventDefault()
					commandPaletteOpen.set(true)
				}
			}
		}

		window.addEventListener('keydown', handleKeyDown)
		return () => window.removeEventListener('keydown', handleKeyDown)
	}, [])

	// Only build the (large) command catalog while the palette is actually open
	if (!isOpen) return null

	return <CommandPaletteContents />
})

const CommandPaletteContents = observer(function CommandPaletteContents() {
	const { pages, connections, triggersList, variablesStore, notifier } = useContext(RootAppStoreContext)
	const navigate = useNavigate()

	const [query, setQuery] = useState('')
	const [selectedIndex, setSelectedIndex] = useState(0)

	const rescanUsbMutation = useMutationExt(trpc.surfaces.rescanUsb.mutationOptions())
	const clearLogMutation = useMutationExt(trpc.logs.clear.mutationOptions())

	// The mutation objects are recreated each render, so keep the catalog independent of their identity
	const rescanUsbRef = useRef(rescanUsbMutation)
	rescanUsbRef.current = rescanUsbMutation
	const clearLogRef = useRef(clearLogMutation)
	clearLogRef.current = clearLogMutation
	const clearLogConfirmRef = useRef<GenericConfirmModalRef>(null)

	const closePalette = useCallback(() => {
		commandPaletteOpen.set(false)
		setQuery('')
		setSelectedIndex(0)
	}, [])

	// Build the complete searchable catalog
	const allItems = useMemo((): CommandItem[] => {
		const items: CommandItem[] = []

		// 1. Navigation — every page the sidebar and section tabs can reach
		for (const nav of ALL_NAV_PAGES) {
			items.push({
				id: `nav:${nav.path}`,
				category: 'Navigation',
				title: nav.label,
				subtitle: `Go to ${nav.path}`,
				icon: nav.icon,
				onSelect: () => {
					void navigate({ to: nav.path })
					closePalette()
				},
			})
		}

		// 2. Quick Actions
		items.push({
			id: 'action:page-matrix',
			category: 'Quick Actions',
			title: 'Page Matrix Overview',
			subtitle: 'Visual overview of every page',
			icon: faTableCells,
			onSelect: () => {
				void navigate({ to: '/buttons' })
				pageMatrixOpen.set(true)
				closePalette()
			},
		})

		items.push({
			id: 'action:rescan-usb',
			category: 'Quick Actions',
			title: 'Rescan USB Surfaces',
			subtitle: 'Detect connected Stream Decks and controllers',
			icon: faRotate,
			onSelect: () => {
				rescanUsbRef.current
					.mutateAsync()
					.then(() => notifier.show('USB Rescan', 'Surfaces rescanned successfully', 5000))
					.catch((err) => notifier.show('USB Rescan Failed', String(err), 5000))
				closePalette()
			},
		})

		items.push({
			id: 'action:clear-log',
			category: 'Quick Actions',
			title: 'Clear System Log',
			subtitle: 'Empty the current system log history',
			icon: faTrash,
			onSelect: () => {
				clearLogConfirmRef.current?.show(
					'Clear System Log',
					'This permanently removes the current system log history.',
					'Clear Log',
					() => {
						clearLogRef.current
							.mutateAsync()
							.then(() => notifier.show('Log Cleared', 'System log cleared', 5000))
							.catch((err) => notifier.show('Clear Log Failed', String(err), 5000))
						closePalette()
					}
				)
			},
		})

		items.push({
			id: 'action:quick-backup',
			category: 'Quick Actions',
			title: 'Quick Backup Configuration',
			subtitle: 'Download a full snapshot backup file',
			icon: faDownload,
			onSelect: () => {
				window.location.href = makeAbsolutePath('/int/export/full')
				closePalette()
			},
		})

		// 3. Connections
		if (connections?.connections) {
			for (const [id, conn] of connections.connections.entries()) {
				items.push({
					id: `conn:${id}`,
					category: 'Connections',
					title: conn.label,
					subtitle: `Module: ${conn.moduleId || 'Integration'}`,
					badge: conn.enabled ? 'Enabled' : 'Disabled',
					icon: faPlug,
					onSelect: () => {
						void navigate({ to: '/connections/$connectionId', params: { connectionId: id } })
						closePalette()
					},
				})
			}
		}

		// 4. Triggers
		if (triggersList?.triggers) {
			for (const [id, trigger] of triggersList.triggers.entries()) {
				items.push({
					id: `trigger:${id}`,
					category: 'Quick Actions',
					title: trigger.name || `Trigger ${id}`,
					subtitle: trigger.description || 'Trigger action',
					badge: trigger.enabled ? 'Active' : 'Disabled',
					icon: faClock,
					onSelect: () => {
						void navigate({ to: '/triggers/$controlId', params: { controlId: id } })
						closePalette()
					},
				})
			}
		}

		// 5. Pages
		if (pages?.data) {
			pages.data.forEach((page, index) => {
				const pageNumber = index + 1
				const pageName = page?.name ? `Page ${pageNumber} (${page.name})` : `Page ${pageNumber}`

				items.push({
					id: `page:${pageNumber}`,
					category: 'Navigation',
					title: pageName,
					subtitle: `Jump to buttons on ${pageName}`,
					badge: `P${pageNumber}`,
					icon: faBorderAll,
					onSelect: () => {
						void navigate({ to: `/buttons/${pageNumber}` as any })
						closePalette()
					},
				})
			})
		}

		// 6. Variables (Custom & Module)
		if (variablesStore?.allVariableDefinitions) {
			const allVariables = variablesStore.allVariableDefinitions.get() || []
			for (const v of allVariables) {
				const varSyntax = `$(${v.connectionLabel}:${v.name})`
				items.push({
					id: `var:${v.connectionLabel}:${v.name}`,
					category: 'Variables',
					title: varSyntax,
					subtitle: v.description || `${v.connectionLabel} variable`,
					badge: 'Copy',
					icon: faDollarSign,
					onSelect: () => {
						void copy(varSyntax)
						notifier.show('Copied to Clipboard', `Copied "${varSyntax}" to clipboard`, 3000)
						closePalette()
					},
				})
			}
		}

		return items
	}, [pages, connections, triggersList, variablesStore, navigate, closePalette, notifier])

	// Fuzzy-filter items based on query
	const filteredItems = useMemo(() => {
		const cleanQuery = query.trim()
		if (!cleanQuery) {
			return allItems.slice(0, 40)
		}

		const results = fuzzysort.go(cleanQuery, allItems, {
			keys: ['title', 'subtitle', 'category'],
			threshold: -10000,
			limit: 40,
		})

		return results.map((res) => res.obj)
	}, [allItems, query])

	// Reset selected index on query change
	useEffect(() => {
		setSelectedIndex(0)
	}, [query])

	const listRef = useRef<HTMLDivElement>(null)

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'ArrowDown') {
			e.preventDefault()
			setSelectedIndex((i) => (i + 1) % Math.max(1, filteredItems.length))
		} else if (e.key === 'ArrowUp') {
			e.preventDefault()
			setSelectedIndex((i) => (i - 1 + filteredItems.length) % Math.max(1, filteredItems.length))
		} else if (e.key === 'Enter') {
			e.preventDefault()
			if (filteredItems[selectedIndex]) {
				filteredItems[selectedIndex].onSelect()
			}
		} else if (e.key === 'Escape') {
			e.preventDefault()
			closePalette()
		}
	}

	// Scroll active item into view
	useEffect(() => {
		if (listRef.current) {
			const activeEl = listRef.current.querySelector<HTMLElement>(`[data-index="${selectedIndex}"]`)
			if (activeEl) {
				activeEl.scrollIntoView({ block: 'nearest' })
			}
		}
	}, [selectedIndex])

	return (
		<>
			<GenericConfirmModal ref={clearLogConfirmRef} />
			<Modal.Root open onOpenChange={(open) => !open && closePalette()}>
				<Modal.Portal>
					<Modal.Backdrop
						className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
						style={{ zIndex: 1300 }}
					/>
					<Modal.Viewport
						className="fixed inset-0 flex items-start justify-center pt-16 sm:pt-24 p-4 overflow-y-auto"
						style={{ zIndex: 1300 }}
					>
						<Modal.Popup className="w-full max-w-2xl bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col dialog-max-h animate-in fade-in zoom-in-95 duration-150">
							{/* Search Input Header */}
							<div className="flex items-center px-4 py-3.5 border-b border-border/70 gap-3 bg-surface">
								<FontAwesomeIcon icon={faMagnifyingGlass} className="text-muted text-base shrink-0" />
								<input
									type="text"
									value={query}
									onChange={(e) => setQuery(e.target.value)}
									onKeyDown={handleKeyDown}
									placeholder="Search buttons, connections, variables, or actions..."
									className="w-full bg-transparent border-none outline-none text-sm text-body placeholder:text-muted/70 font-medium"
									autoFocus
								/>
								<kbd className="hidden sm:inline-flex items-center px-2 py-0.5 text-3xs font-semibold text-muted bg-surface-muted border border-border/70 rounded-md">
									ESC
								</kbd>
							</div>

							{/* Results List */}
							<div ref={listRef} className="overflow-y-auto flex-1 p-2 space-y-1 divide-y divide-transparent">
								{filteredItems.length === 0 ? (
									<div className="py-12 text-center text-muted">
										<FontAwesomeIcon icon={faSearch} className="text-2xl mb-2 opacity-40" />
										<p className="text-xs mb-0">No results found for "{query}"</p>
									</div>
								) : (
									filteredItems.map((item, index) => {
										const isSelected = index === selectedIndex
										return (
											<div
												key={item.id}
												data-index={index}
												onClick={() => item.onSelect()}
												onMouseEnter={() => setSelectedIndex(index)}
												className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
													isSelected
														? 'bg-primary/10 text-primary border border-primary/20'
														: 'hover:bg-surface-hover/70 text-body border border-transparent'
												}`}
											>
												<div className="flex items-center gap-3 min-w-0 flex-1">
													<div
														className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs ${
															isSelected ? 'bg-primary text-white' : 'bg-surface-muted text-muted'
														}`}
													>
														<FontAwesomeIcon icon={item.icon} />
													</div>
													<div className="min-w-0 flex-1">
														<div className="flex items-center gap-2">
															<span className="font-semibold text-xs truncate text-body">{item.title}</span>
															{item.badge && (
																<span className="px-1.5 py-0.5 rounded text-3xs font-medium bg-surface-muted text-muted border border-border/70 shrink-0">
																	{item.badge}
																</span>
															)}
														</div>
														{item.subtitle && (
															<p className="text-2xs text-muted truncate mb-0 mt-0.5">{item.subtitle}</p>
														)}
													</div>
												</div>

												<div className="flex items-center gap-2 shrink-0">
													<span className="text-3xs font-semibold text-muted/70 uppercase tracking-wider hidden sm:inline">
														{item.category}
													</span>
													<FontAwesomeIcon
														icon={faArrowRight}
														className={`text-2xs ${isSelected ? 'opacity-100' : 'opacity-0'}`}
													/>
												</div>
											</div>
										)
									})
								)}
							</div>

							{/* Footer hint */}
							<div className="p-2.5 px-4 bg-surface-muted/50 border-t border-border/70 flex items-center justify-between text-3xs text-muted">
								<div className="flex items-center gap-3">
									<span>
										<kbd className="font-sans px-1 py-0.5 bg-surface border border-border/70 rounded">↑</kbd>{' '}
										<kbd className="font-sans px-1 py-0.5 bg-surface border border-border/70 rounded">↓</kbd> to
										navigate
									</span>
									<span>
										<kbd className="font-sans px-1.5 py-0.5 bg-surface border border-border/70 rounded">↵</kbd> to
										select
									</span>
								</div>
								<span>
									Press <kbd className="font-sans px-1.5 py-0.5 bg-surface border border-border/70 rounded">ESC</kbd> to
									close
								</span>
							</div>
						</Modal.Popup>
					</Modal.Viewport>
				</Modal.Portal>
			</Modal.Root>
		</>
	)
})
