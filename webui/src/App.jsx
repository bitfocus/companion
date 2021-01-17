import React, { Suspense } from 'react'
import { CContainer, CRow, CCol, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink } from '@coreui/react'
import { faCalculator, faCalendarAlt, faClipboardList, faClock, faCog, faFileImport, faGamepad, faGift, faPlug, faUserNinja } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import { ErrorBoundary } from 'react-error-boundary'
import shortid from 'shortid'

import { CompanionContext, socketEmit } from './util'
import { HelpModal } from './Components/HelpModal'
import { Instances } from './Instances'
import { InstanceConfig } from './InstanceConfig'
import { Buttons } from './Buttons'
import { Surfaces } from './Surfaces'
import { UserConfig } from './UserConfig'
import { LogPanel } from './LogPanel'
import { InstancePresets } from './Presets'
import { useTranslation } from 'react-i18next'
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { MySidebar } from './Layout/Sidebar'
import { MyHeader } from './Layout/Header'
import { EditButton } from './EditButton'

export default class App extends React.Component {
	constructor(props) {
		super(props)

		console.log('init')

		this.state = {
			connected: false,

			// modules
			modules: {},

			activeTab1: 'instances',
			activeTab2: 'log',
			activePresetToken: shortid(),

			instances: {},
			configureInstanceId: null,
			configureInstanceToken: null,

			hotPress: false,
			selectedButton: null,

			// help text to show
			helpContent: null,

			variableDefinitions: {},
			variableValues: {},

			actions: {},
		}
	}

	componentDidMount() {
		this.socket = new io('http://localhost:8000');
		this.socket.on('connect', () => {
			this.setState({ connected: true })

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

		document.addEventListener('keydown', this.handleKeyDown);
		document.addEventListener('keyup', this.handleKeyUp);
	}

	componentWillUnmount() {
		this.socket.off('instances_get:result', this.updateInstancesInfo)
		this.socket.off('variable_instance_definitions_set', this.updateVariableDefinitions)
		this.socket.off('variable_set', this.updateVariableValue)
		this.socket.off('actions', this.updateActions)

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

	showHelp = (name) => {
		socketEmit(this.socket, 'instance_get_help', [name]).then(([err, result]) => {
			if (err) {
				alert('Error getting help text');
				return;
			}
			if (result) {
				this.setState({
					helpContent: [name, result]
				})
			}
		})
	}

	configureInstance = (id) => {
		console.log('configureInstance', id)
		this.setState({
			configureInstanceId: id,
			configureInstanceToken: shortid(),
			activeTab1: !id && this.state.activeTab1 === 'instanceConfig' ? 'instances' : 'instanceConfig'
		})
	}

	updateInstancesInfo = (db) => {
		this.setState({
			instances: db,
		})
	}

	buttonGridClick = (page, bank, isDown) => {
		if (this.state.hotPress) {
			this.socket.emit('hot_press', page, bank, isDown);
		} else {
			this.setState({
				activeTab2: 'edit',
				selectedButton: [page, bank],
			})
		}
	}

	render() {
		const showInstanceConfig = this.state.configureInstanceId && this.state.instances[this.state.configureInstanceId]

		const contextValue = {
			socket: this.socket,
			instances: this.state.instances,
			modules: this.state.modules,
			variableDefinitions: this.state.variableDefinitions,
			variableValues: this.state.variableValues,
			actions: this.state.actions,
		}

		return (
			<CompanionContext.Provider value={contextValue} >
				<Suspense fallback={<Spinner />}>
					<DndProvider backend={HTML5Backend}>
						<div className="c-app">
							<HelpModal content={this.state.helpContent} hide={() => this.setState({ helpContent: null })} />

							<MySidebar />
							<div className="c-wrapper">
								<MyHeader />
								<div className="c-body">
									<CContainer fluid className="animated fadeIn">
										{
											this.socket && this.state.connected ?
												<CRow>

													<CCol xs={12} xl={6}>
														<CTabs activeTab={this.state.activeTab1} onActiveTabChange={(a) => this.setState({ activeTab1: a })}>
															<CNav variant="tabs">
																<CNavItem><CNavLink data-tab="instances"><FontAwesomeIcon icon={faPlug} /> Instances</CNavLink></CNavItem>
																<CNavItem hidden={!showInstanceConfig}><CNavLink data-tab="instanceConfig"><FontAwesomeIcon icon={faCog} /> Config</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="buttons"><FontAwesomeIcon icon={faCalendarAlt} /> Buttons</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="surfaces"><FontAwesomeIcon icon={faGamepad} /> Surfaces</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="triggers"><FontAwesomeIcon icon={faClock} /> Triggers</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="userconfig"><FontAwesomeIcon icon={faUserNinja} /> Settings</CNavLink></CNavItem>
															</CNav>
															<CTabContent fade={false}>
																<CTabPane data-tab="instances">
																	<ErrorBoundary>
																		<Instances configureInstance={this.configureInstance} showHelp={this.showHelp} />
																	</ErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="instanceConfig">
																	<ErrorBoundary>
																		{
																			this.state.configureInstanceId
																				? <InstanceConfig
																					key={this.state.configureInstanceToken}
																					instanceId={this.state.configureInstanceId}
																					showHelp={this.showHelp}
																				/>
																				: 'No instance specified'
																		}
																	</ErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="buttons">
																	<Buttons buttonGridClick={this.buttonGridClick} isHot={this.state.hotPress} selectedButton={this.state.selectedButton} />
																</CTabPane>
																<CTabPane data-tab="surfaces">
																	<Surfaces />
																</CTabPane>
																<CTabPane data-tab="triggers">t</CTabPane>
																<CTabPane data-tab="userconfig">
																	<UserConfig />
																</CTabPane>
															</CTabContent>
														</CTabs>
													</CCol>

													<CCol xs={12} xl={6}>
														<CTabs activeTab={this.state.activeTab2} onActiveTabChange={(a) => a !== this.state.activeTab2 && this.setState({ activeTab2: a, selectedButton: null })}>
															<CNav variant="tabs">
																<CNavItem><CNavLink data-tab="log"><FontAwesomeIcon icon={faClipboardList} /> Log</CNavLink></CNavItem>
																<CNavItem hidden={!this.state.selectedButton}><CNavLink data-tab="edit"><FontAwesomeIcon icon={faCalculator} /> Edit Button { this.state.selectedButton ? `${this.state.selectedButton[0]}.${this.state.selectedButton[1]}` : '?' }</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="presets" onClick={(a) => this.setState({ activePresetToken: shortid() })}><FontAwesomeIcon icon={faGift} /> Presets</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="importexport"><FontAwesomeIcon icon={faFileImport} /> Import / Export</CNavLink></CNavItem>
															</CNav>
															<CTabContent fade={false}>
																<CTabPane data-tab="log">
																	<LogPanel />
																</CTabPane>
																<CTabPane data-tab="edit">
																	{ this.state.selectedButton ? <EditButton key={`${this.state.selectedButton[0]}.${this.state.selectedButton[1]}`} page={this.state.selectedButton[0]} bank={this.state.selectedButton[1]} /> : '' }
																</CTabPane>
																<CTabPane data-tab="presets">
																	<InstancePresets token={this.state.activePresetToken} />
																</CTabPane>
															</CTabContent>
														</CTabs>
													</CCol>

												</CRow>
												: 'Connecting'
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
