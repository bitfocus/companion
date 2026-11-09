import { DragDropProvider } from '@dnd-kit/react'
import { Outlet } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { useIdleTimer } from 'react-idle-timer'
import { Grid } from '~/Components/Grid'
import { useEvictDeadCollapseState } from '~/Helpers/useEvictDeadCollapseState.js'
import { useMountEffect } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { ContextData } from './ContextData.js'
import { EntityDragLayer } from './Controls/Components/EntityDragLayer.js'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from './Hooks/useTRPCConnectionStatus.js'
import { AdminLockContext } from './Layout/AdminLockContext.js'
import { AppAuthWrapper, AppLoading } from './Layout/AppSplash.js'
import { CommandPalette } from './Layout/CommandPalette.js'
import { ConfigImportingOverlay, ConnectionLostOverlay } from './Layout/ConnectionLostOverlay.js'
import { MySidebar, SidebarStateProvider } from './Layout/Sidebar.js'
import { TopBar } from './Layout/TopBar.js'
import { TopBarPageContext, type TopBarPage } from './Layout/TopBarContext.js'
import { MyErrorBoundary } from './Resources/Error.js'
import { MonacoLoader } from './Resources/MonacoLoader.js'
import { SortableHysteresis } from './Resources/SortableHysteresis.js'
import { shouldAutoOpenWizard } from './Wizard/Constants.js'
import { WizardModal } from './Wizard/index.js'

export default function App(): React.JSX.Element {
	const trpcStatus = useTRPCConnectionStatus()

	const connected = trpcStatus.status === TRPCConnectionStatus.Connected
	const wasConnected = trpcStatus.wasConnected
	const shouldReload = connected && wasConnected

	useEffect(() => {
		if (shouldReload) {
			console.log('Reloading page after TRPC reconnect')
			// Reload the page to ensure that the UI is up-to-date and we don't have any stale data
			window.location.reload()
		}
	}, [shouldReload])

	return (
		<ContextData>
			{(loadingProgress, loadingComplete) => (
				<>
					{wasConnected && <ConnectionLostOverlay />}
					<ImportTaskOverlay wasConnected={wasConnected} />
					<Suspense fallback={<AppLoading progress={loadingProgress} connected={connected} />}>
						<MonacoLoader />
						{/*
						 * Single global dnd-kit provider for all drag and drop. Each feature subscribes to its
						 * own drags via useDragDropMonitor() and filters by drag `type`, so handlers stay scoped
						 * while dragging between different parts of the UI remains possible (one shared manager).
						 * Feedback mode is configured per-draggable where needed (e.g. presets drag a clone with
						 * no drop animation - see PresetIconPreview); everything else uses the defaults.
						 */}
						<DragDropProvider>
							<SortableHysteresis />
							<EntityDragLayer />
							<AppMain
								connected={connected && !shouldReload}
								loadingComplete={loadingComplete}
								loadingProgress={loadingProgress}
							/>
						</DragDropProvider>
					</Suspense>
				</>
			)}
		</ContextData>
	)
}

// Reads the shared import/reset task status (driven by useImportTaskStatusSubscription) and shows the
// blocking overlay on still-connected clients while a task runs. A dropped client sees the
// disconnect screen instead, and reloads on reconnect.
const ImportTaskOverlay = observer(function ImportTaskOverlay({ wasConnected }: { wasConnected: boolean }) {
	const { importTaskStatus } = useContext(RootAppStoreContext)
	const taskRunning = importTaskStatus.get()?.status === 'running'

	if (wasConnected || !taskRunning) return null

	return <ConfigImportingOverlay />
})

interface AppMainProps {
	connected: boolean
	loadingComplete: boolean
	loadingProgress: number
}

const AppMain = observer(function AppMain({ connected, loadingComplete, loadingProgress }: AppMainProps) {
	const { userConfig, wizardOpen } = useContext(RootAppStoreContext)

	// Once everything has loaded, prune collapse-state keys for controls/connections that no longer exist
	useEvictDeadCollapseState(loadingComplete)

	const [unlocked, setUnlocked] = useState(false)

	const canLock = !!userConfig.properties?.admin_lockout
	const locked = canLock && !unlocked
	const setLocked = useCallback(() => {
		if (canLock) {
			setUnlocked(false)
		}
	}, [canLock])

	// const wizardModal = useRef<WizardModalRef>(null)
	// const showWizard = useCallback(() => {
	// 	if (unlocked) {

	// 		wizardModal.current?.show()
	// 	}
	// }, [unlocked])

	const setup_wizard = userConfig.properties?.setup_wizard
	const setUnlockedInner = useCallback(() => {
		setUnlocked(true)
		if (shouldAutoOpenWizard(setup_wizard)) {
			wizardOpen.set(true)
		}
	}, [setup_wizard, wizardOpen])

	// If lockout is disabled, then we are logged in
	const admin_lockout = userConfig.properties && !userConfig.properties?.admin_lockout
	useEffect(() => {
		if (admin_lockout) {
			setUnlocked(true)
			if (shouldAutoOpenWizard(setup_wizard)) {
				wizardOpen.set(true)
			}
		}
	}, [admin_lockout, setup_wizard, wizardOpen])

	return (
		<div className="c-app">
			<AdminLockContext.Provider value={{ canLock: canLock && unlocked, setLocked }}>
				<SidebarStateProvider>
					{canLock && unlocked && (userConfig.properties?.admin_timeout ?? 0) > 0 ? (
						<IdleTimerWrapper setLocked={setLocked} timeoutMinutes={userConfig.properties?.admin_timeout} />
					) : (
						''
					)}
					{!locked && (
						<>
							<MySidebar />
							<CommandPalette />
						</>
					)}
					<AppWrapper
						connected={connected}
						loadingComplete={loadingComplete}
						loadingProgress={loadingProgress}
						locked={locked}
						setUnlockedInner={setUnlockedInner}
					/>
				</SidebarStateProvider>
			</AdminLockContext.Provider>
		</div>
	)
})

interface AppWrapperProps {
	connected: boolean
	loadingComplete: boolean
	loadingProgress: number
	locked: boolean
	setUnlockedInner: () => void
}

function AppWrapper({ connected, loadingComplete, loadingProgress, locked, setUnlockedInner }: AppWrapperProps) {
	const [topBarPage, setTopBarPage] = useState<TopBarPage | null>(null)

	return (
		<div className="wrapper flex flex-col min-h-dvh bg-app-frame-bg relative">
			{connected && loadingComplete && !locked && <TopBar page={topBarPage} />}
			<div className="body grow">
				{connected && loadingComplete ? (
					locked ? (
						<AppAuthWrapper setUnlocked={setUnlockedInner} />
					) : (
						<TopBarPageContext.Provider value={setTopBarPage}>
							<AppContent />
						</TopBarPageContext.Provider>
					)
				) : (
					<AppLoading progress={loadingProgress} connected={connected} />
				)}
			</div>
		</div>
	)
}

interface IdleTimerWrapperProps {
	setLocked: () => void
	timeoutMinutes: number
}

/** Wrap the idle timer in its own component, as it invalidates every second */
function IdleTimerWrapper({ setLocked, timeoutMinutes }: IdleTimerWrapperProps) {
	const { notifier } = useContext(RootAppStoreContext)

	const [, setIdleTimeout] = useState<NodeJS.Timeout | null>(null)

	const TOAST_ID = 'SESSION_TIMEOUT_TOAST'
	const TOAST_DURATION = 45 * 1000

	const handleOnActive = () => {
		// user is now active, abort the lock
		setIdleTimeout((v) => {
			if (v) {
				clearTimeout(v)
			}

			// close toast
			notifier.close(TOAST_ID)

			return null
		})
	}
	const handleAction = () => {
		// setShouldShowIdleWarning(false)
	}

	const handleIdle = () => {
		notifier.show(
			'Session timeout',
			'Your session is about to timeout, and Companion will be locked',
			undefined,
			TOAST_ID
		)

		setIdleTimeout((v) => {
			if (!v) {
				return setTimeout(() => {
					// close toast
					notifier.close(TOAST_ID)

					setLocked()
				}, TOAST_DURATION)
			}

			return v
		})
	}

	const cappedTimeout = Math.min(timeoutMinutes, 24 * 60) // cap to 24 hours

	useIdleTimer({
		timeout: cappedTimeout * 60 * 1000 - TOAST_DURATION,
		onIdle: handleIdle,
		onActive: handleOnActive,
		onAction: handleAction,
		debounce: 500,
	})

	useMountEffect(() => {
		return () => {
			setIdleTimeout((v) => {
				if (v) {
					clearTimeout(v)
				}
				return null
			})

			// close toast
			notifier.close(TOAST_ID)
		}
	})

	return null
}

const AppContent = observer(function AppContent() {
	const { userConfig } = useContext(RootAppStoreContext)

	useEffect(() => {
		document.title =
			userConfig.properties?.installName && userConfig.properties?.installName.length > 0
				? `${userConfig.properties?.installName} - Admin (Bitfocus Companion)`
				: 'Bitfocus Companion - Admin'
	}, [userConfig.properties?.installName])

	return (
		<Grid.Container className="fadeIn">
			<WizardModal />

			<MyErrorBoundary>
				<Outlet />
			</MyErrorBoundary>
		</Grid.Container>
	)
})
