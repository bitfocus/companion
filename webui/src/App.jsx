import React, { Suspense } from 'react'
import { CContainer, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink } from '@coreui/react'
import { faCalendarAlt, faClipboardList, faClock, faGamepad, faPlug, faUserNinja } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import shortid from 'shortid'

import { CompanionContext, MyErrorBoundary, socketEmit } from './util'
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

const serverUrl = window.SERVER_URL === '%REACT_APP_SERVER_URL%' ? undefined : window.SERVER_URL

export default class App extends React.Component {
	constructor(props) {
		super(props)

		console.log('init')

		this.state = {
			connected: false,
			has_connected: false,

			// modules
			modules: {},
			instances: {},

			activeRootTab: 'instances',
			activeRootTabToken: shortid(),

			hotPress: false,

			variableDefinitions: {},
			variableValues: {},

			actions: {},
			feedbacks: {},

			showSidebar: true,
		}
	}

	componentDidMount() {
		this.socket = new io(serverUrl);
		this.socket.on('connect', () => {
			if (this.state.has_connected) {
				window.location.reload(true);
			} else {
				this.setState({
					connected: true,
					has_connected: true
				})
			}
		});
		// this.socket.on('event', function(data){console.log('event', data)});
		this.socket.on('disconnect', () => this.setState({ connected: false }));

		socketEmit(this.socket, 'modules_get', []).then(([res]) => {
			const modulesObj = {}
			for (const mod of res.modules) {
				modulesObj[mod.name] = mod
			}
			this.setState({
				// ...res,
				modules: modulesObj,
			})
		}).catch((e) => {
			console.error('Failed to load modules list', e)
		})
		socketEmit(this.socket, 'variable_instance_definitions_get', []).then(([data]) => {
			this.setState({
				variableDefinitions: data || {},
			})
		}).catch((e) => {
			console.error('Failed to load variable definitions list', e)
		})
		socketEmit(this.socket, 'variables_get', []).then(([data]) => {
			this.setState({
				variableValues: data || {},
			})
		}).catch((e) => {
			console.error('Failed to load variable values list', e)
		})

		this.socket.on('instances_get:result', this.updateInstancesInfo)
		this.socket.emit('instances_get')

		this.socket.on('variable_instance_definitions_set', this.updateVariableDefinitions)
		this.socket.on('variable_set', this.updateVariableValue)

		this.socket.on('actions', this.updateActions)
		this.socket.emit('get_actions')

		this.socket.on('feedback_get_definitions:result', this.updateFeedbacks)
		this.socket.emit('feedback_get_definitions')

		document.addEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keyup', this.handleKeyUp);
	}

	componentWillUnmount() {
		this.socket.off('instances_get:result', this.updateInstancesInfo)
		this.socket.off('variable_instance_definitions_set', this.updateVariableDefinitions)
		this.socket.off('variable_set', this.updateVariableValue)
		this.socket.off('actions', this.updateActions)
		this.socket.off('feedback_get_definitions:result', this.updateFeedbacks)

		document.removeEventListener('keydown', this.handleKeyDown);
		document.removeEventListener('keyup', this.handleKeyUp);
	}

	handleKeyDown = (e) => {
		if (e.key === 'Shift') {
			this.setState({ hotPress: true })
		}
	}
	handleKeyUp = (e) => {
		if (e.key === 'Shift') {
			this.setState({ hotPress: false })
		}
	}

	updateActions = (actions) => {
		this.setState({
			actions: actions,
		})
	}

	updateFeedbacks = (feedbacks) => {
		this.setState({
			feedbacks: feedbacks
		})
	}

	updateVariableDefinitions = (label, variables) => {
		this.setState({
			variableDefinitions: {
				...this.state.variableDefinitions,
				[label]: variables
			}
		})
	}

	updateVariableValue = (key, value) => {
		this.setState({
			variableValues: {
				...this.state.variableValues,
				[key]: value
			}
		})
	}

	updateInstancesInfo = (db) => {
		this.setState({
			instances: db,
		})
	}

	toggleSidebar = () => {
		this.setState({ showSidebar: !this.state.showSidebar })
	}

	render() {
		const contextValue = {
			socket: this.socket,
			instances: this.state.instances,
			modules: this.state.modules,
			variableDefinitions: this.state.variableDefinitions,
			variableValues: this.state.variableValues,
			actions: this.state.actions,
			feedbacks: this.state.feedbacks,
		}

		return (
			<CompanionContext.Provider value={contextValue} >
				<div id="error-container" className={this.state.has_connected && !this.state.connected ? "show-error" : ''}>
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
																<ButtonsPage hotPress={this.state.hotPress} />
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
			</CompanionContext.Provider>
		);
	}
}

function Spinner() {
	return <p>Loading</p>
}
