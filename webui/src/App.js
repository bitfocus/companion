import React from 'react'
import {CNavbar, CNavbarBrand, CHeader, CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand, CContainer, CRow, CCol, CTabs, CTabContent, CTabPane, CNav, CNavItem, CNavLink} from '@coreui/react'
import {faBug, faCalendarAlt, faClock, faCog, faComments, faDollarSign, faGamepad, faInfo, faMousePointer, faPlug, faTabletAlt, faUserNinja, faUsers} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import io from 'socket.io-client'
import { CompanionContext } from './util'
import { ErrorBoundary } from 'react-error-boundary'

import {Instances} from './Instances'

export default class App extends React.Component {
  constructor(props) {
    super(props)

    console.log('init')

    this.state = {
      connected: false,
    }
  }

  componentDidMount() {
    this.socket = new io('http://localhost:8000');
    this.socket.on('connect', () => this.setState({ connected: true }));
    // this.socket.on('event', function(data){console.log('event', data)});
    this.socket.on('disconnect', () => this.setState({ connected: false }));
  }

  render() {
    return (
      <CompanionContext.Provider value={{ socket: this.socket }} >
        <div className="c-app">
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
                      <CTabs>
                        <CNav variant="tabs">
                          <CNavItem><CNavLink><FontAwesomeIcon icon={faPlug} /> Instances</CNavLink></CNavItem>
                          <CNavItem><CNavLink><FontAwesomeIcon icon={faCog} /> Config</CNavLink></CNavItem>
                          <CNavItem><CNavLink><FontAwesomeIcon icon={faCalendarAlt} /> Buttons</CNavLink></CNavItem>
                          <CNavItem><CNavLink><FontAwesomeIcon icon={faGamepad} /> Surfaces</CNavLink></CNavItem>
                          <CNavItem><CNavLink><FontAwesomeIcon icon={faClock} /> Triggers</CNavLink></CNavItem>
                          <CNavItem><CNavLink><FontAwesomeIcon icon={faUserNinja} /> Settings</CNavLink></CNavItem>
                        </CNav>
                        <CTabContent fade={false}>
                          <CTabPane>
                            <ErrorBoundary>
                              <Instances />
                            </ErrorBoundary>
                          </CTabPane>
                          <CTabPane>c</CTabPane>
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
