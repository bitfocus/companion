import {CNavbar, CNavbarBrand, CHeader, CSidebar, CSidebarNav, CSidebarNavItem, CSidebarBrand, CContainer,CRow, CCol} from '@coreui/react'
import {faBug, faComments, faDollarSign, faGamepad, faInfo, faMousePointer, faTabletAlt, faUsers} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'

function App() {
  return (
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
          <CNavbar fixed={true} light={false} color='danger'>

            <CNavbarBrand>
              <span style={{fontWeight: 'bold'}}>Bitfocus</span> Companion
            </CNavbarBrand>
          </CNavbar>
        </CHeader>
        <div className="c-body">
          <CContainer fluid className="animated fadeIn">
            <CRow>
              <CCol xs={12} xl={6}>

                

              <p>Hi</p>
              </CCol>

            </CRow>

          </CContainer>
        </div>
      </div>
    </div>
  );
}

export default App;
