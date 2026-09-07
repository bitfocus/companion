import { DragDropProvider } from '@dnd-kit/react'
import './App.css'
import { faBars } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Outlet } from '@tanstack/react-router'
import { observer } from 'mobx-react-lite'
import { Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { useIdleTimer } from 'react-idle-timer'
import { Grid } from '~/Components/Grid'
import { useEvictDeadCollapseState } from '~/Helpers/useEvictDeadCollapseState.js'
import { useMountEffect } from '~/Resources/util.js'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { Button } from './Components/Button.js'
import { Form, InputGroup } from './Components/Form.js'
import { ProgressBar } from './Components/ProgressBar.js'
import { SecretTextInputField } from './Components/SecretTextInputField.js'
import { ContextData } from './ContextData.js'
import { EntityDragLayer } from './Controls/Components/EntityDragLayer.js'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from './Hooks/useTRPCConnectionStatus.js'
import { AdminLockContext } from './Layout/AdminLockContext.js'
import { CommandPalette } from './Layout/CommandPalette.js'
import { ConfigImportingOverlay, ConnectionLostOverlay } from './Layout/ConnectionLostOverlay.js'
import { MySidebar, SidebarStateProvider, useSidebarState } from './Layout/Sidebar.js'
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
					<MySidebar />
					<CommandPalette />
					<AppWrapper
						connected={connected}
						loadingComplete={loadingComplete}
						loadingProgress={loadingProgress}
						canLock={canLock}
						unlocked={unlocked}
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
	canLock: boolean
	unlocked: boolean
	setUnlockedInner: () => void
}

function AppWrapper({
	connected,
	loadingComplete,
	loadingProgress,
	canLock,
	unlocked,
	setUnlockedInner,
}: AppWrapperProps) {
	const { mobileMode, handleShowSidebar } = useSidebarState()

	return (
		<div className="wrapper flex flex-col min-h-screen bg-app-frame-bg relative">
			{mobileMode && (
				<button
					type="button"
					className="sidebar-mobile-toggle block-collapse"
					onClick={handleShowSidebar}
					title="Show Sidebar"
				>
					<FontAwesomeIcon icon={faBars} className="w-5 h-5" />
				</button>
			)}
			<div className="body grow">
				{connected && loadingComplete ? (
					!canLock || unlocked ? (
						<AppContent />
					) : (
						<AppAuthWrapper setUnlocked={setUnlockedInner} />
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

interface AppLoadingProps {
	progress: number
	connected: boolean
}

function AppLoading({ progress, connected }: AppLoadingProps) {
	return (
		<div className="flex flex-col items-center justify-center page-empty-state p-6 select-none">
			<div className="bg-surface text-body border border-border/80 rounded-2xl shadow-xl p-8 sm:p-10 max-w-sm w-full flex flex-col items-center text-center">
				<div className="w-16 h-16 rounded-2xl bg-surface-muted/80 border border-border/70 p-2.5 flex items-center justify-center mb-5 shadow-xs">
					<img
						src="/img/icons/128x128.png"
						alt="Bitfocus Companion"
						className="w-full h-full object-contain rounded-xl"
					/>
				</div>

				<h3 className="text-lg font-bold text-body mb-1">
					{connected ? 'Syncing Configuration' : 'Connecting to Companion'}
				</h3>

				<p className="text-xs text-muted mb-6 leading-relaxed">
					{connected ? 'Loading surfaces, modules, and controls…' : 'Establishing real-time connection…'}
				</p>

				{connected ? (
					<div className="w-full space-y-2">
						<ProgressBar className="h-2 rounded-full overflow-hidden" value={progress} />
						<div className="flex justify-between text-2xs text-muted font-mono font-medium px-0.5">
							<span>Loading workspace</span>
							<span>{Math.round(progress)}%</span>
						</div>
					</div>
				) : (
					<div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-muted/60 border border-border/70 text-xs text-muted font-medium shadow-xs">
						<span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
						<span>Locating server…</span>
					</div>
				)}
			</div>
		</div>
	)
}

interface AppAuthWrapperProps {
	setUnlocked: () => void
}

const AppAuthWrapper = observer(function AppAuthWrapper({ setUnlocked }: AppAuthWrapperProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const [password, setPassword] = useState('')
	const [showError, setShowError] = useState(false)

	const passwordChanged = useCallback((newValue: string) => {
		setPassword(newValue)
		setShowError(false)
	}, [])

	const tryLogin = useCallback(
		(e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault()

			setPassword((currentPassword) => {
				if (currentPassword === userConfig.properties?.admin_password) {
					setShowError(false)
					setUnlocked()
					return ''
				} else {
					setShowError(true)
					// preserve current entered value
					return currentPassword
				}
			})

			return false
		},
		[userConfig, setUnlocked]
	)

	return (
		<Grid.Container className="fadeIn loading">
			<Grid.Row>
				<Grid.Col xxl={4} md={3} sm={2} xs={1}></Grid.Col>
				<Grid.Col xxl={4} md={6} sm={8} xs={10}>
					<h3>Companion is locked</h3>
					<Form onSubmit={tryLogin}>
						<InputGroup>
							<SecretTextInputField
								id={undefined}
								value={password}
								setValue={passwordChanged}
								checkValid={showError ? false : undefined}
								immediateValue
							/>
							<Button type="submit" color="primary">
								Unlock
							</Button>
						</InputGroup>
					</Form>
				</Grid.Col>
			</Grid.Row>
		</Grid.Container>
	)
})

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
