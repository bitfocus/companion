import React from 'react'
import {CHeader, CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand, CContainer, CRow, CCol, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink, CNavbarNav, CCollapse, CHeaderBrand, CHeaderNavItem, CHeaderNav, CHeaderNavLink} from '@coreui/react'
import {faBug, faCalculator, faCalendarAlt, faClipboardList, faClock, faCog, faComments, faDollarSign, faFileImport, faGamepad, faGift, faInfo, faMousePointer, faPlug, faTabletAlt, faUserNinja, faUsers} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import { ErrorBoundary } from 'react-error-boundary'
import shortid from 'shortid'

import { CompanionContext, socketEmit } from './util'
import { HelpModal } from './ModuleHelp'
import { Instances } from './Instances'
import { InstanceConfig } from './InstanceConfig'
import { Buttons } from './Buttons'
import { Surfaces } from './Surfaces'
import { UserConfig } from './UserConfig'
import { LogPanel } from './LogPanel'

export default class App extends React.Component {
  constructor(props) {
    super(props)

    console.log('init')

    this.state = {
      connected: false,

      versionInfo: null,
      updateData: null,

      // modules
      modules: {},

      activeTab1: 'instances',

      instances: {},
      configureInstanceId: null,
      configureInstanceToken: null,

      hotPress: false,

      // help text to show
      helpContent: null,

      variableDefinitions: {},
      variableValues: {},
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
    this.socket.on('skeleton-info', this.versionInfo)
    this.socket.on('update_data', this.updateData)
    this.socket.emit('update_data')

    document.addEventListener('keydown', this.handleKeyDown);
    document.addEventListener('keyup', this.handleKeyUp);
  }

  componentWillUnmount() {
      this.socket.off('instances_get:result', this.updateInstancesInfo)
      this.socket.off('variable_instance_definitions_set', this.updateVariableDefinitions)
      this.socket.off('variable_set', this.updateVariableValue)
      this.socket.off('skeleton-info', this.versionInfo)
      this.socket.off('update_data', this.updateData)

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

  updateData = (data) => {
    this.setState({ updateData: data })
  }

  versionInfo = (info) => {
    this.setState({ versionInfo: info })
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
      console.log('TODO', 'edit', page, bank)
    }
  }

  getVersionString() {
    const info = this.state.versionInfo
    if (info) {
      return `${info.appVersion} (${info.appBuild.replace("master-","").replace(info.appVersion + "-", "")})`
    } else {
      return '?'
    }
  }

  render() {
    const showInstanceConfig = this.state.configureInstanceId && this.state.instances[this.state.configureInstanceId]

    return (
      <CompanionContext.Provider value={{ socket: this.socket, instances: this.state.instances, modules:this.state.modules  }} >
        <div className="c-app">
          <HelpModal content={this.state.helpContent} hide={() => this.setState({ helpContent: null })} />

          <CSidebar>
            <CSidebarNav>
              <CSidebarBrand></CSidebarBrand>

              <CSidebarNavItem target="_new" href="/emulator.html" icon={<FontAwesomeIcon icon={faGamepad} />} name="Emulator" />
              <CSidebarNavItem target="_new" href="/tablet.html" icon={<FontAwesomeIcon icon={faMousePointer} />} name="Web buttons" />
              <CSidebarNavItem target="_new" href="/tablet2.html" icon={<FontAwesomeIcon icon={faTabletAlt} />} name="Mobile buttons" />

              <CSidebarNavItem target="_new" href="https://github.com/bitfocus/companion/issues" icon={<FontAwesomeIcon icon={faBug} />} name="Bugs &amp; Features" />
              <CSidebarNavItem target="_new" href="https://www.facebook.com/groups/companion/" icon={<FontAwesomeIcon icon={faUsers} />} name="Facebook" />
              <CSidebarNavItem target="_new" href="https://join.slack.com/t/bitfocusio/shared_invite/enQtODk4NTYzNTkzMjU1LTMzZDY1Njc2MmE3MzVlNmJhMTBkMzFjNTQ2NzZlYzQyZWIzZTJkZWIyNmJlY2U0NzM1NGEzNzNlZWY3OWJlNGE" icon={<FontAwesomeIcon icon={faComments} />} name="Slack Chat" />
              <CSidebarNavItem target="_new" href="https://donorbox.org/bitfocus-opensource" icon={<FontAwesomeIcon icon={faDollarSign} />} name="Donate" />

              <CSidebarNavItem target="_new" href="/help.html" icon={<FontAwesomeIcon icon={faInfo} />} name="Getting Started" />
            </CSidebarNav>
          </CSidebar>
          <div className="c-wrapper">
            <CHeader colorScheme="dark">
              {/* <CNavbar fixed="top" light={false} color='danger'> */}

                <CHeaderBrand>
                  <span style={{fontWeight: 'bold'}}>Bitfocus</span> Companion
                </CHeaderBrand>

                <CHeaderNav>
                  <CHeaderNavItem>
                    <CHeaderNavLink target="_new" title="Version Number" href="https://bitfocus.io/companion/">
                        { this.getVersionString() }
                    </CHeaderNavLink>
                  </CHeaderNavItem>

                  <CHeaderNavItem>
                    <CHeaderNavLink target="_new" href={this.state.updateData?.link || "https://bitfocus.io/companion/"}>
                      { this.state.updateData?.message || '' }
                    </CHeaderNavLink>
                  </CHeaderNavItem>
                </CHeaderNav>
              {/* </CNavbar> */}
            </CHeader>
            <div className="c-body">
              <CContainer fluid className="animated fadeIn">
                {
                  this.socket && this.state.connected ? 
                  <CRow>

                    <CCol xs={12} xl={6}>
                      <CTabs activeTab={this.state.activeTab1} onActiveTabChange={(a) => this.setState({ activeTab1: a})}>
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
                                    variableDefinitions={this.state.variableDefinitions}
                                    variableValues={this.state.variableValues}
                                  />
                                : 'No instance specified'
                              }
                            </ErrorBoundary>
                          </CTabPane>
                          <CTabPane data-tab="buttons">
                            <Buttons buttonGridClick={this.buttonGridClick} isHot={this.state.hotPress} />
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
                      <CTabs>
                        <CNav variant="tabs">
                          <CNavItem><CNavLink data-tab="log"><FontAwesomeIcon icon={faClipboardList} /> Log</CNavLink></CNavItem>
                          <CNavItem><CNavLink data-tab="edit"><FontAwesomeIcon icon={faCalculator} /> Edit Button</CNavLink></CNavItem>
                          <CNavItem><CNavLink data-tab="presets"><FontAwesomeIcon icon={faGift} /> Presets</CNavLink></CNavItem>
                          <CNavItem><CNavLink data-tab="importexport"><FontAwesomeIcon icon={faFileImport} /> Import / Export</CNavLink></CNavItem>
                        </CNav>
                        <CTabContent fade={false}>
                          <CTabPane data-tab="log">
                            <LogPanel />
                          </CTabPane>
                          <CTabPane>c</CTabPane>
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
      </CompanionContext.Provider>
    );
  }
}
