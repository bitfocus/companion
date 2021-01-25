import React, { Suspense } from 'react'
import { CContainer, CRow, CCol, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink } from '@coreui/react'
import { faCalculator, faCalendarAlt, faClipboardList, faClock, faCog, faFileImport, faGamepad, faGift, faPlug, faUserNinja } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import shortid from 'shortid'

import { CompanionContext, MyErrorBoundary, socketEmit } from './util'
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
import { ImportExport } from './ImportExport'
import { Scheduler } from './Scheduler'

export default class App extends React.Component {
	constructor(props) {
		super(props)

		console.log('init')

		this.state = {
			connected: false,
			has_connected: false,

			// modules
			modules: {},

			activeTab1: 'instances',
			activeTab2: 'log',
			activePresetToken: shortid(),
			importExportToken: shortid(),
			editBankToken: shortid(),

			instances: {},
			configureInstanceId: null,
			configureInstanceToken: null,

			hotPress: false,
			pageNumber: 1,
			selectedButton: null,
			copyFromButton: null,

			// help text to show
			helpContent: null,

			variableDefinitions: {},
			variableValues: {},

			actions: {},
			feedbacks: {},
		}
	}

	componentDidMount() {
		this.socket = new io('http://localhost:8000');
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

	updatePage = (pageNumber) => {
		this.setState({
			pageNumber: pageNumber,
		})
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
				editBankToken: shortid(),
			})
		}
	}

	onKeyUp = (e) => {
		if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
			if (this.state.selectedButton) {
				// keyup with button selected

				if (!e.ctrlKey && !e.metaKey && !e.altKey && (e.key === 'Backspace' || e.key === 'Delete')) {
					if (window.confirm('Clear button ' + this.state.selectedButton[0] + '.' + this.state.selectedButton[1] + '?')) {
						this.socket.emit('bank_reset', this.state.selectedButton[0], this.state.selectedButton[1]);
						
						// Invalidate the ui component to cause a reload
						this.setState({ editBankToken: shortid() })
					}
				}
				if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'c') {
					console.log('prepare copy', this.state.selectedButton)
					this.setState({
						copyFromButton: [...this.state.selectedButton, 'copy']
					})
				}
				if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'x') {
					console.log('prepare cut', this.state.selectedButton)
					this.setState({
						copyFromButton: [...this.state.selectedButton, 'cut']
					})
				}
				if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key === 'v' && this.state.copyFromButton) {
					console.log('do paste', this.state.copyFromButton, this.state.selectedButton)

					if (this.state.copyFromButton[2] === 'copy') {
						this.socket.emit('bank_copy', this.state.copyFromButton[0], this.state.copyFromButton[1], this.state.selectedButton[0], this.state.selectedButton[1]);
						this.setState({
							editBankToken: shortid(),
						})
					} else if (this.state.copyFromButton[2] === 'cut') {
						this.socket.emit('bank_move', this.state.copyFromButton[0], this.state.copyFromButton[1], this.state.selectedButton[0], this.state.selectedButton[1]);
						this.setState({
							copyFromButton: null,
							editBankToken: shortid(),
						})
					} else {
						console.error('unknown paste operation:', this.state.copyFromButton[2])
					}
				}
			}
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
																	<MyErrorBoundary>
																		<Instances configureInstance={this.configureInstance} showHelp={this.showHelp} />
																	</MyErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="instanceConfig">
																	<MyErrorBoundary>
																		{
																			this.state.configureInstanceId
																				? <InstanceConfig
																					key={this.state.configureInstanceToken}
																					instanceId={this.state.configureInstanceId}
																					showHelp={this.showHelp}
																				/>
																				: 'No instance specified'
																		}
																	</MyErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="buttons">
																	<MyErrorBoundary>
																		<Buttons
																			buttonGridClick={this.buttonGridClick}
																			isHot={this.state.hotPress}
																			selectedButton={this.state.selectedButton}
																			pageNumber={this.state.pageNumber}
																			changePage={this.updatePage}
																			onKeyUp={this.onKeyUp}
																			/>
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
															</CTabContent>
														</CTabs>
													</CCol>

													<CCol xs={12} xl={6}>
														<CTabs activeTab={this.state.activeTab2} onActiveTabChange={(a) => a !== this.state.activeTab2 && this.setState({ activeTab2: a, selectedButton: null })}>
															<CNav variant="tabs">
																<CNavItem><CNavLink data-tab="log"><FontAwesomeIcon icon={faClipboardList} /> Log</CNavLink></CNavItem>
																<CNavItem hidden={!this.state.selectedButton}><CNavLink data-tab="edit"><FontAwesomeIcon icon={faCalculator} /> Edit Button { this.state.selectedButton ? `${this.state.selectedButton[0]}.${this.state.selectedButton[1]}` : '?' }</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="presets" onClick={(a) => this.setState({ activePresetToken: shortid() })}><FontAwesomeIcon icon={faGift} /> Presets</CNavLink></CNavItem>
																<CNavItem><CNavLink data-tab="importexport"onClick={(a) => this.setState({ importExportToken: shortid() })}><FontAwesomeIcon icon={faFileImport} /> Import / Export</CNavLink></CNavItem>
															</CNav>
															<CTabContent fade={false}>
																<CTabPane data-tab="log">
																	<MyErrorBoundary>
																		<LogPanel />
																	</MyErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="edit">
																	<MyErrorBoundary>
																		{
																			this.state.selectedButton
																			? <EditButton
																				key={`${this.state.selectedButton[0]}.${this.state.selectedButton[1]}.${this.state.editBankToken}`}
																				page={this.state.selectedButton[0]}
																				bank={this.state.selectedButton[1]}
																				onKeyUp={this.onKeyUp}
																				/>
																			: ''
																		}
																	</MyErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="presets">
																	<MyErrorBoundary>
																		<InstancePresets token={this.state.activePresetToken} />
																	</MyErrorBoundary>
																</CTabPane>
																<CTabPane data-tab="importexport">
																	<MyErrorBoundary>
																		<ImportExport key={this.state.importExportToken} pageNumber={this.state.pageNumber} />
																	</MyErrorBoundary>
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
