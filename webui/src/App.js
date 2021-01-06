import React from 'react'
import {CNavbar, CNavbarBrand, CHeader, CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand, CContainer, CRow, CCol, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink} from '@coreui/react'
import {faBug, faCalendarAlt, faClock, faCog, faComments, faDollarSign, faGamepad, faInfo, faMousePointer, faPlug, faTabletAlt, faUserNinja, faUsers} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import { CompanionContext, socketEmit } from './util'
import { ErrorBoundary } from 'react-error-boundary'

import { HelpModal } from './ModuleHelp'
import { Instances } from './Instances'
import { InstanceConfig } from './InstanceConfig'

export default class App extends React.Component {
  constructor(props) {
    super(props)

    console.log('init')

    this.state = {
      connected: false,

      // modules
      modules: {},

      activeTab1: 'instances',

      instances: {},
      configureInstanceId: null,

      // help text to show
      helpContent: null
    }

    this.configureInstance = this.configureInstance.bind(this)
    this.updateInstancesInfo = this.updateInstancesInfo.bind(this)
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

    this.socket.on('instances_get:result', this.updateInstancesInfo)
    this.socket.emit('instances_get')
  }

  componentWillUnmount() {
      this.socket.off('instances_get:result', this.updateInstancesInfo)
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

  configureInstance(id) {
    console.log('configureInstance', id)
    this.setState({
      configureInstanceId: id,
      activeTab1: !id && this.state.activeTab1 === 'instanceConfig' ? 'instances' : 'instanceConfig' 
    })
  }

  updateInstancesInfo(db) {
    this.setState({
        instances: db,
    })
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
            <CHeader>
              <CNavbar fixed="top" light={false} color='danger'>

                <CNavbarBrand>
                  <span style={{fontWeight: 'bold'}}>Bitfocus</span> Companion
                </CNavbarBrand>
              </CNavbar>
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
                          <CNavItem><CNavLink data-tab="settings"><FontAwesomeIcon icon={faUserNinja} /> Settings</CNavLink></CNavItem>
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
                                ? <InstanceConfig instanceId={this.state.configureInstanceId} key={this.state.configureInstanceId} showHelp={this.showHelp} />
                                : 'No instance specified'
                              }
                            </ErrorBoundary>
                          </CTabPane>
                          <CTabPane data-tab="triggers">t</CTabPane>
                        </CTabContent>
                      </CTabs>
                    </CCol>

                    <CCol xs={12} xl={6}>
                      <CTabs>
                        <CNav variant="tabs">
                        <CNavItem><CNavLink>Link</CNavLink></CNavItem>
                          <CNavItem><CNavLink>Link2</CNavLink></CNavItem>
                        </CNav>
                        <CTabContent fade={false}>
                          <CTabPane>bb</CTabPane>
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
