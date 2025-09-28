import React, { Suspense, useCallback, useContext, useEffect, useState } from 'react'
import { CContainer, CRow, CCol, CProgress, CFormInput, CForm, CButton } from '@coreui/react'
import { useMountEffect } from '~/Resources/util.js'
import { MyErrorBoundary } from './Resources/Error.js'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MySidebar, SidebarStateProvider } from './Layout/Sidebar.js'
import { MyHeader } from './Layout/Header.js'
import { ContextData } from './ContextData.js'
import { WizardModal } from './Wizard/index.js'
import { WIZARD_CURRENT_VERSION } from './Wizard/Constants.js'
import { useIdleTimer } from 'react-idle-timer'
import { RootAppStoreContext } from '~/Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { Outlet } from '@tanstack/react-router'
import { useSubscription } from '@trpc/tanstack-react-query'
import { trpc } from './Resources/TRPC.js'
import { TRPCConnectionStatus, useTRPCConnectionStatus } from './Hooks/useTRPCConnectionStatus.js'

const useTouchBackend = window.localStorage.getItem('test_touch_backend') === '1'

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

	const [currentImportTask, setCurrentImportTask] = useState<'reset' | 'import' | null>(null)
	useSubscription(
		trpc.importExport.importExportTaskStatus.subscriptionOptions(undefined, {
			onStarted: () => {
				setCurrentImportTask(null)
			},
			onData: (data) => {
				setCurrentImportTask(data)
			},
			onError: (error) => {
				console.error('Error in importExportTaskStatus subscription:', error)
				setCurrentImportTask(null)
			},
		})
	)

	return (
		<ContextData>
			{(loadingProgress, loadingComplete) => (
				<>
					<div id="error-container" className={wasConnected ? 'show-error' : ''}>
						<div className="row justify-content-center">
							<div className="col-md-6">
								<div className="clearfix">
									<h4 className="pt-3">Houston, we have a problem!</h4>
									<p className="text-muted">It seems that we have lost connection to the companion app.</p>
									<p className="text-muted">
										<li className="text-muted">Check that the application is still running</li>
										<li className="text-muted">If you're using the Admin GUI over a network - check your connection</li>
									</p>
								</div>
							</div>
						</div>
					</div>
					<div id="current-import-container" className={!wasConnected && currentImportTask ? 'show-error' : ''}>
						<div className="row justify-content-center">
							<div className="col-md-6">
								<div className="clearfix">
									<h4 className="pt-3">Stand by, the config is being updated!</h4>
									{/* <p className="text-muted">It seems that we have lost connection to the companion app.</p> */}
								</div>
							</div>
						</div>
					</div>
					<Suspense fallback={<AppLoading progress={loadingProgress} connected={connected && !shouldReload} />}>
						<DndProvider
							backend={useTouchBackend ? TouchBackend : HTML5Backend}
							options={useTouchBackend ? { enableMouseEvents: true } : {}}
						>
							<AppMain
								connected={connected && !shouldReload}
								loadingComplete={loadingComplete}
								loadingProgress={loadingProgress}
							/>
						</DndProvider>
					</Suspense>
				</>
			)}
		</ContextData>
	)
}

interface AppMainProps {
	connected: boolean
	loadingComplete: boolean
	loadingProgress: number
}

const AppMain = observer(function AppMain({ connected, loadingComplete, loadingProgress }: AppMainProps) {
	const { userConfig, showWizard } = useContext(RootAppStoreContext)

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
		if (setup_wizard !== undefined && setup_wizard < WIZARD_CURRENT_VERSION) {
			showWizard()
		}
	}, [setup_wizard, showWizard])

	// If lockout is disabled, then we are logged in
	const admin_lockout = userConfig.properties && !userConfig.properties?.admin_lockout
	useEffect(() => {
		if (admin_lockout) {
			setUnlocked(true)
			if (setup_wizard !== undefined && setup_wizard < WIZARD_CURRENT_VERSION) {
				showWizard()
			}
		}
	}, [admin_lockout, setup_wizard, showWizard])

	return (
		<div className="c-app">
			<SidebarStateProvider>
				{canLock && unlocked && (userConfig.properties?.admin_timeout ?? 0) > 0 ? (
					<IdleTimerWrapper setLocked={setLocked} timeoutMinutes={userConfig.properties?.admin_timeout} />
				) : (
					''
				)}
				<MySidebar />
				<div className="wrapper d-flex flex-column min-vh-100 bg-body-tertiary">
					<MyHeader setLocked={setLocked} canLock={canLock && unlocked} />
					<div className="body flex-grow-1">
						{connected && loadingComplete ? (
							unlocked ? (
								<AppContent />
							) : (
								<AppAuthWrapper setUnlocked={setUnlockedInner} />
							)
						) : (
							<AppLoading progress={loadingProgress} connected={connected} />
						)}
					</div>
				</div>
			</SidebarStateProvider>
		</div>
	)
})

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
			if (notifier.current) {
				notifier.current.close(TOAST_ID)
			}

			return null
		})
	}
	const handleAction = () => {
		// setShouldShowIdleWarning(false)
	}

	const handleIdle = () => {
		notifier.current?.show(
			'Session timeout',
			'Your session is about to timeout, and Companion will be locked',
			undefined,
			TOAST_ID
		)

		setIdleTimeout((v) => {
			if (!v) {
				return setTimeout(() => {
					// close toast
					if (notifier.current) {
						notifier.current.close(TOAST_ID)
					}

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
			if (notifier.current) {
				notifier.current.close(TOAST_ID)
			}
		}
	})

	return null
}

interface AppLoadingProps {
	progress: number
	connected: boolean
}

function AppLoading({ progress, connected }: AppLoadingProps) {
	const message = connected ? 'Syncing' : 'Connecting'
	return (
		<CContainer fluid className="fadeIn loading app-loading">
			<CRow>
				<CCol xxl={4} md={3} sm={2} xs={1}></CCol>
				<CCol xxl={4} md={6} sm={8} xs={10}>
					<h3>{message}</h3>
					<CProgress value={connected ? progress : 0} />
				</CCol>
			</CRow>
		</CContainer>
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
		<CContainer fluid className="fadeIn loading">
			<CRow>
				<CCol xxl={4} md={3} sm={2} xs={1}></CCol>
				<CCol xxl={4} md={6} sm={8} xs={10}>
					<h3>Companion is locked</h3>
					<CForm onSubmit={tryLogin}>
						<div className="login-form">
							<CFormInput
								type="password"
								value={password}
								onChange={(e) => passwordChanged(e.currentTarget.value)}
								invalid={showError}
								readOnly={!userConfig.properties}
							/>
							<CButton type="submit" color="primary">
								Unlock
							</CButton>
						</div>
					</CForm>
				</CCol>
			</CRow>
		</CContainer>
	)
})

const AppContent = observer(function AppContent() {
	const { userConfig, viewControl } = useContext(RootAppStoreContext)

	const handleWindowBlur = useCallback(() => {
		viewControl.setButtonGridHotPress(false)
	}, [viewControl])

	const handleKeyDown = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Shift') {
				viewControl.setButtonGridHotPress(true)
			}
		},
		[viewControl]
	)
	const handleKeyUp = useCallback(
		(e: KeyboardEvent) => {
			if (e.key === 'Shift') {
				viewControl.setButtonGridHotPress(false)
			}
		},
		[viewControl]
	)

	useMountEffect(() => {
		document.addEventListener('keydown', handleKeyDown)
		document.addEventListener('keyup', handleKeyUp)

		window.addEventListener('blur', handleWindowBlur)

		return () => {
			document.removeEventListener('keydown', handleKeyDown)
			document.removeEventListener('keyup', handleKeyUp)

			window.removeEventListener('blur', handleWindowBlur)
		}
	})

	useEffect(() => {
		document.title =
			userConfig.properties?.installName && userConfig.properties?.installName.length > 0
				? `${userConfig.properties?.installName} - Admin (Bitfocus Companion)`
				: 'Bitfocus Companion - Admin'
	}, [userConfig.properties?.installName])

	return (
		<CContainer fluid className="fadeIn">
			<WizardModal />

			<MyErrorBoundary>
				<Outlet />
			</MyErrorBoundary>
		</CContainer>
	)
})
