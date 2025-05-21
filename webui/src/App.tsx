import React, { Suspense, useCallback, useContext, useEffect, useRef, useState } from 'react'
import {
	CContainer,
	CTabContent,
	CTabPane,
	CNav,
	CNavItem,
	CNavLink,
	CRow,
	CCol,
	CProgress,
	CFormInput,
	CForm,
	CButton,
} from '@coreui/react'
import {
	faClipboardList,
	faClock,
	faCloud,
	faGamepad,
	faPlug,
	faCog,
	faFileImport,
	faDollarSign,
	faTh,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { MyErrorBoundary, useMountEffect, SocketContext } from './util.js'
import { SURFACES_PAGE_PREFIX, SurfacesPage } from './Surfaces/index.js'
import { UserConfig } from './UserConfig/index.js'
import { LogPanel } from './LogPanel.js'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MySidebar } from './Layout/Sidebar.js'
import { MyHeader } from './Layout/Header.js'
import { Triggers, TRIGGERS_PAGE_PREFIX } from './Triggers/index.js'
import { ConnectionsPage } from './Connections/index.js'
import { BUTTONS_PAGE_PREFIX, ButtonsPage } from './Buttons/index.js'
import { ContextData } from './ContextData.js'
import { CloudPage } from './Cloud/index.js'
import { WizardModal, WIZARD_CURRENT_VERSION, WizardModalRef } from './Wizard/index.js'
import { NavLink, Navigate, useLocation } from 'react-router-dom'
import { useIdleTimer } from 'react-idle-timer'
import { ImportExport } from './ImportExport/index.js'
import { RootAppStoreContext } from './Stores/RootAppStore.js'
import { observer } from 'mobx-react-lite'
import { ConnectionVariables } from './Variables/index.js'
import { SurfacesTabNotifyIcon } from './Surfaces/TabNotifyIcon.js'

const useTouchBackend = window.localStorage.getItem('test_touch_backend') === '1'
const showCloudTab = window.localStorage.getItem('show_companion_cloud') === '1'

export default function App() {
	const socket = useContext(SocketContext)
	const [connected, setConnected] = useState(false)
	const [wasConnected, setWasConnected] = useState(false)
	const [buttonGridHotPress, setButtonGridHotPress] = useState(false)
	const [currentImportTask, setCurrentImportTask] = useState<'reset' | 'import' | null>(null)

	useEffect(() => {
		const onConnected = () => {
			setWasConnected((wasConnected0) => {
				if (wasConnected0) {
					window.location.reload()
				} else {
					setConnected(true)
				}
				return wasConnected0
			})
		}
		const onDisconnected = () => {
			setConnected((val) => {
				setWasConnected(val)
				return false
			})
		}

		const unsubConnect = socket.onConnect(onConnected)
		const unsubDisconnect = socket.onDisconnect(onDisconnected)

		const unsubTask = socket.on('load-save:task', setCurrentImportTask)

		if (socket.connected) onConnected()

		return () => {
			unsubConnect()
			unsubDisconnect()

			unsubTask()
		}
	}, [socket])

	const handleWindowBlur = useCallback(() => {
		setButtonGridHotPress(false)
	}, [])

	const handleKeyDown = useCallback((e: KeyboardEvent) => {
		if (e.key === 'Shift') {
			setButtonGridHotPress(true)
		}
	}, [])
	const handleKeyUp = useCallback((e: KeyboardEvent) => {
		if (e.key === 'Shift') {
			setButtonGridHotPress(false)
		}
	}, [])

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
					<Suspense fallback={<AppLoading progress={loadingProgress} connected={connected} />}>
						<DndProvider
							backend={useTouchBackend ? TouchBackend : HTML5Backend}
							options={useTouchBackend ? { enableMouseEvents: true } : {}}
						>
							<AppMain
								connected={connected}
								loadingComplete={loadingComplete}
								loadingProgress={loadingProgress}
								buttonGridHotPress={buttonGridHotPress}
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
	buttonGridHotPress: boolean
}

const AppMain = observer(function AppMain({
	connected,
	loadingComplete,
	loadingProgress,
	buttonGridHotPress,
}: AppMainProps) {
	const { userConfig } = useContext(RootAppStoreContext)

	const [showSidebar, setShowSidebar] = useState(true)
	const [unlocked, setUnlocked] = useState(false)

	const toggleSidebar = useCallback(() => {
		setShowSidebar((oldVal) => !oldVal)
	}, [])
	const canLock = !!userConfig.properties?.admin_lockout
	const setLocked = useCallback(() => {
		if (canLock) {
			setUnlocked(false)
		}
	}, [canLock])

	const wizardModal = useRef<WizardModalRef>(null)
	const showWizard = useCallback(() => {
		if (unlocked) {
			wizardModal.current?.show()
		}
	}, [unlocked])

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
			{canLock && unlocked && (userConfig.properties?.admin_timeout ?? 0) > 0 ? (
				<IdleTimerWrapper setLocked={setLocked} timeoutMinutes={userConfig.properties?.admin_timeout} />
			) : (
				''
			)}
			<WizardModal ref={wizardModal} />
			<MySidebar sidebarShow={showSidebar} showWizard={showWizard} />
			<div className="wrapper d-flex flex-column min-vh-100 bg-body-tertiary">
				<MyHeader toggleSidebar={toggleSidebar} setLocked={setLocked} canLock={canLock && unlocked} />
				<div className="body flex-grow-1">
					{connected && loadingComplete ? (
						unlocked ? (
							<AppContent buttonGridHotPress={buttonGridHotPress} />
						) : (
							<AppAuthWrapper setUnlocked={setUnlockedInner} />
						)
					) : (
						<AppLoading progress={loadingProgress} connected={connected} />
					)}
				</div>
			</div>
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
		<CContainer fluid className="fadeIn loading">
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

interface AppContentProps {
	buttonGridHotPress: boolean
}

const AppContent = observer(function AppContent({ buttonGridHotPress }: AppContentProps) {
	const routerLocation = useLocation()
	let hasMatchedPane = false
	const getClassForPane = (prefix: string) => {
		// Require the path to be the same, or to be a prefix with a sub-route

		const paneBaseClass = 'pane-baseclass'

		if (routerLocation.pathname.startsWith(prefix + '/') || routerLocation.pathname === prefix) {
			hasMatchedPane = true
			return paneBaseClass + ' active show'
		} else {
			return paneBaseClass
		}
	}

	const { userConfig } = useContext(RootAppStoreContext)

	useEffect(() => {
		document.title =
			userConfig.properties?.installName && userConfig.properties?.installName.length > 0
				? `${userConfig.properties?.installName} - Admin (Bitfocus Companion)`
				: 'Bitfocus Companion - Admin'
	}, [userConfig.properties?.installName])

	return (
		<CContainer fluid className="fadeIn">
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink to="/connections" as={NavLink}>
						<FontAwesomeIcon icon={faPlug} /> Connections
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to={BUTTONS_PAGE_PREFIX} as={NavLink}>
						<FontAwesomeIcon icon={faTh} /> Buttons
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to={SURFACES_PAGE_PREFIX} as={NavLink}>
						<FontAwesomeIcon icon={faGamepad} /> Surfaces <SurfacesTabNotifyIcon />
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to={TRIGGERS_PAGE_PREFIX} as={NavLink}>
						<FontAwesomeIcon icon={faClock} /> Triggers
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/variables" as={NavLink}>
						<FontAwesomeIcon icon={faDollarSign} /> Variables
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/settings" as={NavLink}>
						<FontAwesomeIcon icon={faCog} /> Settings
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/import-export" as={NavLink}>
						<FontAwesomeIcon icon={faFileImport} /> Import / Export
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/log" as={NavLink}>
						<FontAwesomeIcon icon={faClipboardList} /> Log
					</CNavLink>
				</CNavItem>
				{showCloudTab && (
					<CNavItem>
						<CNavLink to="/cloud" as={NavLink}>
							<FontAwesomeIcon icon={faCloud} /> Cloud
						</CNavLink>
					</CNavItem>
				)}
			</CNav>
			<CTabContent>
				<CTabPane className={getClassForPane('/connections')}>
					<MyErrorBoundary>
						<ConnectionsPage />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane(BUTTONS_PAGE_PREFIX)}>
					<MyErrorBoundary>
						<ButtonsPage hotPress={buttonGridHotPress} />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane(SURFACES_PAGE_PREFIX)}>
					<MyErrorBoundary>
						<SurfacesPage />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane(TRIGGERS_PAGE_PREFIX)}>
					<MyErrorBoundary>
						<Triggers />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/variables')}>
					<MyErrorBoundary>
						<ConnectionVariables />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/settings')}>
					<MyErrorBoundary>
						<UserConfig />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/import-export')}>
					<MyErrorBoundary>
						<ImportExport />
					</MyErrorBoundary>
				</CTabPane>
				{getClassForPane('/log') !== '' && (
					<CTabPane className={getClassForPane('/log')}>
						<MyErrorBoundary>
							<LogPanel />
						</MyErrorBoundary>
					</CTabPane>
				)}
				{getClassForPane('/cloud') !== '' && (
					// We want the cloud panel to only load when it it needs to
					<CTabPane className={getClassForPane('/cloud')}>
						<MyErrorBoundary>
							<CloudPage />
						</MyErrorBoundary>
					</CTabPane>
				)}
				{!hasMatchedPane ? (
					// If no pane was matched, then redirect to the default
					<Navigate
						to={{
							pathname: '/connections',
						}}
						replace
					/>
				) : (
					''
				)}
			</CTabContent>
		</CContainer>
	)
})
