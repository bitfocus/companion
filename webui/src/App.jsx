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
	CFormGroup,
	CProgress,
	CInput,
	CForm,
	CButton,
} from '@coreui/react'
import {
	faCalendarAlt,
	faClipboardList,
	faClock,
	faCloud,
	faGamepad,
	faPlug,
	faCog,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import '@fontsource/fira-code'
import { MyErrorBoundary, useMountEffect, UserConfigContext, SocketContext, NotifierContext } from './util'
import { SurfacesPage } from './Surfaces'
import { UserConfig } from './UserConfig'
import { LogPanel } from './LogPanel'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { TouchBackend } from 'react-dnd-touch-backend'
import { MySidebar } from './Layout/Sidebar'
import { MyHeader } from './Layout/Header'
import { Triggers } from './Triggers'
import { InstancesPage } from './Instances'
import { ButtonsPage } from './Buttons'
import { ContextData } from './ContextData'
import { CloudPage } from './CloudPage'
import { WizardModal, WIZARD_CURRENT_VERSION } from './Wizard'
import { Navigate, useLocation } from 'react-router-dom'
import { useIdleTimer } from 'react-idle-timer'
import { UnstableWarningModal } from './UnstableWarning'

const useTouchBackend = window.localStorage.getItem('test_touch_backend') === '1'
const showCloudTab = window.localStorage.getItem('show_companion_cloud') === '1'

export default function App() {
	const socket = useContext(SocketContext)
	const [connected, setConnected] = useState(false)
	const [wasConnected, setWasConnected] = useState(false)
	const [buttonGridHotPress, setButtonGridHotPress] = useState(false)

	useEffect(() => {
		const onConnected = () => {
			setWasConnected((wasConnected0) => {
				if (wasConnected0) {
					window.location.reload(true)
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
		socket.on('connect', onConnected)
		socket.on('disconnect', onDisconnected)

		if (socket.connected) onConnected()

		return () => {
			socket.off('connect', onConnected)
			socket.off('disconnect', onDisconnected)
		}
	}, [socket])

	const handleWindowBlur = useCallback(() => {
		setButtonGridHotPress(false)
	}, [])

	const handleKeyDown = useCallback((e) => {
		if (e.key === 'Shift') {
			setButtonGridHotPress(true)
		}
	}, [])
	const handleKeyUp = useCallback((e) => {
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
					<UnstableWarningModal />
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

function AppMain({ connected, loadingComplete, loadingProgress, buttonGridHotPress }) {
	const config = useContext(UserConfigContext)

	const [showSidebar, setShowSidebar] = useState(true)
	const [unlocked, setUnlocked] = useState(false)

	const toggleSidebar = useCallback(() => {
		setShowSidebar((oldVal) => !oldVal)
	}, [])
	const canLock = !!config?.admin_lockout
	const setLocked = useCallback(() => {
		if (canLock) {
			setUnlocked(false)
		}
	}, [canLock])

	const wizardModal = useRef()
	const showWizard = useCallback(() => {
		if (unlocked) {
			wizardModal.current.show()
		}
	}, [unlocked])

	const setUnlockedInner = useCallback(() => {
		setUnlocked(true)
		if (config && config?.setup_wizard < WIZARD_CURRENT_VERSION) {
			showWizard()
		}
	}, [config, showWizard])

	// If lockout is disabled, then we are logged in
	useEffect(() => {
		if (config && !config?.admin_lockout) {
			setUnlocked(true)
			if (config?.setup_wizard < WIZARD_CURRENT_VERSION) {
				showWizard()
			}
		}
	}, [config, showWizard])

	return (
		<div className="c-app">
			{canLock && unlocked && (config.admin_timeout ?? 0) > 0 ? (
				<IdleTimerWrapper setLocked={setLocked} timeoutMinutes={config.admin_timeout} />
			) : (
				''
			)}
			<WizardModal ref={wizardModal} />
			<MySidebar show={showSidebar} showWizard={showWizard} />
			<div className="c-wrapper">
				<MyHeader toggleSidebar={toggleSidebar} setLocked={setLocked} canLock={canLock && unlocked} />
				<div className="c-body">
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
}

/** Wrap the idle timer in its own component, as it invalidates every second */
function IdleTimerWrapper({ setLocked, timeoutMinutes }) {
	const notifier = useContext(NotifierContext)

	const [, setIdleTimeout] = useState(null)

	const TOAST_ID = 'SESSION_TIMEOUT_TOAST'
	const TOAST_DURATION = 45 * 1000

	const handleOnActive = (event) => {
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
	const handleAction = (event) => {
		// setShouldShowIdleWarning(false)
	}

	const handleIdle = () => {
		notifier.current.show(
			'Session timeout',
			'Your session is about to timeout, and Companion will be locked',
			null,
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

	useIdleTimer({
		timeout: timeoutMinutes * 60 * 1000 - TOAST_DURATION,
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

	return ''
}

function AppLoading({ progress, connected }) {
	const message = connected ? 'Syncing' : 'Connecting'
	return (
		<CContainer fluid className="fadeIn loading">
			<CRow>
				<CCol xxl={4} md={3} sm={2} xs={1}></CCol>
				<CCol xxl={4} md={6} sm={8} xs={10}>
					<CFormGroup>
						<h3>{message}</h3>
						<CProgress min={0} max={100} value={connected ? progress : 0} />
					</CFormGroup>
				</CCol>
			</CRow>
		</CContainer>
	)
}

function AppAuthWrapper({ setUnlocked }) {
	const config = useContext(UserConfigContext)

	const [password, setPassword] = useState('')
	const [showError, setShowError] = useState(false)

	const passwordChanged = useCallback((newValue) => {
		setPassword(newValue)
		setShowError(false)
	}, [])

	const tryLogin = useCallback(
		(e) => {
			e.preventDefault()

			setPassword((currentPassword) => {
				if (currentPassword === config.admin_password) {
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
		[config.admin_password, setUnlocked]
	)

	return (
		<CContainer fluid className="fadeIn loading">
			<CRow>
				<CCol xxl={4} md={3} sm={2} xs={1}></CCol>
				<CCol xxl={4} md={6} sm={8} xs={10}>
					<h3>Companion is locked</h3>
					<CForm onSubmit={tryLogin}>
						<div className="login-form">
							<CInput
								type="password"
								value={password}
								onChange={(e) => passwordChanged(e.currentTarget.value)}
								invalid={showError}
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
}

function AppContent({ buttonGridHotPress }) {
	const routerLocation = useLocation()
	let hasMatchedPane = false
	const getClassForPane = (prefix) => {
		// Require the path to be the same, or to be a prefix with a sub-route
		if (routerLocation.pathname.startsWith(prefix + '/') || routerLocation.pathname === prefix) {
			hasMatchedPane = true
			return 'active show'
		} else {
			return ''
		}
	}

	return (
		<CContainer fluid className="fadeIn">
			<CNav variant="tabs">
				<CNavItem>
					<CNavLink to="/connections">
						<FontAwesomeIcon icon={faPlug} /> Connections
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/buttons">
						<FontAwesomeIcon icon={faCalendarAlt} /> Buttons
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/surfaces">
						<FontAwesomeIcon icon={faGamepad} /> Surfaces
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/triggers">
						<FontAwesomeIcon icon={faClock} /> Triggers
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/settings">
						<FontAwesomeIcon icon={faCog} /> Settings
					</CNavLink>
				</CNavItem>
				<CNavItem>
					<CNavLink to="/log">
						<FontAwesomeIcon icon={faClipboardList} /> Log
					</CNavLink>
				</CNavItem>
				{showCloudTab && (
					<CNavItem>
						<CNavLink to="/cloud">
							<FontAwesomeIcon icon={faCloud} /> Cloud
						</CNavLink>
					</CNavItem>
				)}
			</CNav>
			<CTabContent fade={false}>
				<CTabPane className={getClassForPane('/connections')}>
					<MyErrorBoundary>
						<InstancesPage />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/buttons')}>
					<MyErrorBoundary>
						<ButtonsPage hotPress={buttonGridHotPress} />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/surfaces')}>
					<MyErrorBoundary>
						<SurfacesPage />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/triggers')}>
					<MyErrorBoundary>
						<Triggers />
					</MyErrorBoundary>
				</CTabPane>
				<CTabPane className={getClassForPane('/settings')}>
					<MyErrorBoundary>
						<UserConfig />
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
}
