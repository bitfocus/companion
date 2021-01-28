import React, { Suspense } from 'react'
import { CContainer, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink } from '@coreui/react'
import { faCalendarAlt, faClipboardList, faClock, faGamepad, faPlug, faUserNinja } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import shortid from 'shortid'

import { MyErrorBoundary } from './util'
import { Surfaces } from './Surfaces'
import { UserConfig } from './UserConfig'
import { LogPanel } from './LogPanel'
import { useTranslation } from 'react-i18next'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { MySidebar } from './Layout/Sidebar'
import { MyHeader } from './Layout/Header'
import { Scheduler } from './Scheduler'
import { InstancesPage } from './Instances'
import { ButtonsPage } from './Buttons'
import { ContextData } from './ContextData'

const serverUrl = window.SERVER_URL === '%REACT_APP_SERVER_URL%' ? undefined : window.SERVER_URL

export default class App extends React.Component {
	constructor(props) {
		super(props)

		console.log('init')

		this.state = {
			connected: false,
			was_connected: false,

			activeRootTab: 'instances',
			activeRootTabToken: shortid(),

			buttonGridHotPress: false,

			showSidebar: true,
		}
	}

	componentDidMount() {
		this.socket = new io(serverUrl);
		this.socket.on('connect', () => {
			if (this.state.was_connected) {
				window.location.reload(true);
			} else {
				this.setState({
					connected: true
				})
			}
		});
		// this.socket.on('event', function(data){console.log('event', data)});
		this.socket.on('disconnect', () => {
			this.setState({
				connected: false,
				was_connected: this.state.connected
			})
		});

		document.addEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keyup', this.handleKeyUp);
	}

	componentWillUnmount() {
		document.removeEventListener('keydown', this.handleKeyDown);
		document.removeEventListener('keyup', this.handleKeyUp);
	}

	handleKeyDown = (e) => {
		if (e.key === 'Shift') {
			this.setState({ buttonGridHotPress: true })
		}
	}
	handleKeyUp = (e) => {
		if (e.key === 'Shift') {
			this.setState({ buttonGridHotPress: false })
		}
	}

	toggleSidebar = () => {
		this.setState({ showSidebar: !this.state.showSidebar })
	}

	render() {
		return (
			<ContextData socket={this.socket}>
				<div id="error-container" className={this.state.was_connected ? "show-error" : ''}>
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
				<Suspense fallback={<Spinner />}>
					<DndProvider backend={HTML5Backend}>
						<div className="c-app">

							<MySidebar show={this.state.showSidebar} />
							<div className="c-wrapper">
								<MyHeader toggleSidebar={this.toggleSidebar} />
								<div className="c-body">
									<CContainer fluid className="animated fadeIn">
										{
											this.socket && this.state.connected ?
												<CTabs activeTab={this.state.activeRootTab} onActiveTabChange={(a) => this.setState({ activeRootTab: a, activeRootTabToken: shortid() })}>
													<CNav variant="tabs">
														<CNavItem><CNavLink data-tab="instances"><FontAwesomeIcon icon={faPlug} /> Instances</CNavLink></CNavItem>
														<CNavItem><CNavLink data-tab="buttons"><FontAwesomeIcon icon={faCalendarAlt} /> Buttons</CNavLink></CNavItem>
														<CNavItem><CNavLink data-tab="surfaces"><FontAwesomeIcon icon={faGamepad} /> Surfaces</CNavLink></CNavItem>
														<CNavItem><CNavLink data-tab="triggers"><FontAwesomeIcon icon={faClock} /> Triggers</CNavLink></CNavItem>
														<CNavItem><CNavLink data-tab="userconfig"><FontAwesomeIcon icon={faUserNinja} /> Settings</CNavLink></CNavItem>
														<CNavItem><CNavLink data-tab="log"><FontAwesomeIcon icon={faClipboardList} /> Log</CNavLink></CNavItem>
													</CNav>
													<CTabContent fade={false}>
														<CTabPane data-tab="instances">
															<MyErrorBoundary>
																<InstancesPage resetToken={this.state.activeRootTabToken} />
															</MyErrorBoundary>
														</CTabPane>
														<CTabPane data-tab="buttons">
															<MyErrorBoundary>
																<ButtonsPage hotPress={this.state.buttonGridHotPress} />
															</MyErrorBoundary>
														</CTabPane>
														<CTabPane data-tab="surfaces">
															<MyErrorBoundary>
																<Surfaces />
															</MyErrorBoundary>
														</CTabPane>
														<CTabPane data-tab="triggers">
															<MyErrorBoundary>
																<Scheduler />
															</MyErrorBoundary>
														</CTabPane>
														<CTabPane data-tab="userconfig">
															<MyErrorBoundary>
																<UserConfig />
															</MyErrorBoundary>
														</CTabPane>
														<CTabPane data-tab="log">
															<MyErrorBoundary>
																<LogPanel />
															</MyErrorBoundary>
														</CTabPane>
													</CTabContent>
												</CTabs>
												: ''
										}
									</CContainer>
								</div>
							</div>
						</div>
					</DndProvider>
				</Suspense>
			</ContextData>
		);
	}
}

function Spinner() {
	return <p>Loading</p>
}
