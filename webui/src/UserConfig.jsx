import React from 'react'
import { CAlert, CButton, CForm, CFormGroup, CInput, CInputCheckbox, CLabel, CModal, CModalBody, CModalFooter, CModalHeader, CSelect } from '@coreui/react'
import { CompanionContext, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFileImport } from '@fortawesome/free-solid-svg-icons'

export class UserConfig extends React.Component {
    static contextType = CompanionContext

    constructor(props) {
        super(props)

        this.state = {
            config: {},
            // devices: [],

            // configureDeviceId: null,
            // configureDeviceConfig: null,

            // scanning: false,
            // errorMsg: null,
        }
    }

    componentDidMount() {
        this.context.socket.on('set_userconfig_key', this.updateConfigValue)
        socketEmit(this.context.socket, 'get_userconfig_all', []).then(([config]) => {
            this.setState({ config: config })
        }).catch((e) => {
            console.error('Failed to load user config', e)
        })
    }

    componentWillUnmount() {
        this.context.socket.off('set_userconfig_key', this.updateConfigValue)
    }

    updateConfigValue = (key, value) => {
        console.log('got key', key, value)
        this.setState({
            config: {
                ...this.state.config,
                [key]: value,
            }
        })
    }

    setValue = (key, value) => {
        console.log('set ', key, value)
        this.context.socket.emit('set_userconfig_key', key, value)
    }

    render() {
        const config = this.state.config
        return (
            <div>
                <h4>User settings</h4>
                <p>Settings applies instantaneously, don't worry about it!</p>

                <table className='table'>
                    <tbody>
                        <td colspan="2" className="settings-category">Navigation Buttons</td>

                        <tr>
                            <td>Flip counting direction on page up/down</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_page_direction_flipped"
                                        checked={config.page_direction_flipped}
                                        onChange={(e) => this.setValue('page_direction_flipped', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_page_direction_flipped">Enabled</label>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>Show + and - instead of arrows on page buttons</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_page_plusminus"
                                        checked={config.page_plusminus}
                                        onChange={(e) => this.setValue('page_plusminus', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_page_plusminus">Enabled</label>
                                </div>
                            </td>
                        </tr>
                        <td colspan="2" className="settings-category">Devices</td>
                        <tr>
                            <td>Enable emulator control for Logitec R400/Mastercue/dSan</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_emulator_control_enable"
                                        checked={config.emulator_control_enable}
                                        onChange={(e) => this.setValue('emulator_control_enable', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_emulator_control_enable">Enabled</label>
                                </div>
                            </td>
                        </tr>
                        <td colspan="2" className="settings-category">PIN Lockout</td>

                        <tr>
                            <td>Enable Pin Codes</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_pin_enable"
                                        checked={config.pin_enable}
                                        onChange={(e) => this.setValue('pin_enable', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_pin_enable">Enabled</label>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>Link Lockouts</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_link_lockouts"
                                        checked={config.link_lockouts}
                                        onChange={(e) => this.setValue('link_lockouts', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_link_lockouts">Enabled</label>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>Pin Code</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInput
                                        type="text"
                                        value={config.pin}
                                        onChange={(e) => this.setValue('pin', e.currentTarget.value)}
                                    />
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>Pin Timeout (seconds, 0 to turn off)</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInput
                                        type="number"
                                        value={config.pin_timeout}
                                        onChange={(e) => this.setValue('pin_timeout', e.currentTarget.value)}
                                    />
                                </div>
                            </td>
                        </tr>
                        <td colspan="2" className="settings-category">RossTalk</td>

                        <tr>
                            <td>RossTalk Listener</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_rosstalk_enabled"
                                        checked={config.rosstalk_enabled}
                                        onChange={(e) => this.setValue('rosstalk_enabled', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_rosstalk_enabled">Enabled</label>
                                </div>
                            </td>
                        </tr>

                        <td colspan="2" className="settings-category">Artnet Listener</td>
                        <tr>
                            <td>Artnet Listener</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInputCheckbox
                                        id="userconfig_artnet_enabled"
                                        checked={config.artnet_enabled}
                                        onChange={(e) => this.setValue('artnet_enabled', e.currentTarget.checked)}
                                    />
                                    <label className="form-check-label" for="userconfig_artnet_enabled">Enabled</label>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>Artnet Universe (first is 0)</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInput
                                        type="number"
                                        value={config.artnet_universe}
                                        onChange={(e) => this.setValue('artnet_universe', e.currentTarget.value)}
                                    />
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td>Artnet Channel</td>
                            <td>
                                <div className="form-check form-check-inline mr-1">
                                    <CInput
                                        type="number"
                                        value={config.artnet_channel}
                                        onChange={(e) => this.setValue('artnet_channel', e.currentTarget.value)}
                                    />
                                </div>
                            </td>
                        </tr>



                    </tbody>
                </table>

                <RemoteControlInfo />
            </div>
        )
    }
}

function RemoteControlInfo(props) {
    return <>
        <h4>TCP/UDP Remote control</h4>
        <p>Remote triggering can be done by sending TCP (port <code>51234</code>) or UDP (port <code>51235</code>) commands.</p>
        <p><strong>Commands:</strong>
            <ul>
                <li>
                    <code>PAGE-SET</code> &lt;page number&gt; &lt;surface id&gt;
                    <br />
                    <i>Make device go to a specific page</i>
                </li>
                <li>
                    <code>PAGE-UP</code> &lt;surface id&gt;
                    <br />
                    <i>Page up on a specific device</i>
                </li>
                <li>
                    <code>PAGE-DOWN</code> &lt;surface id&gt;
                    <br />
                    <i>Page down on a specific surface</i>
                </li>
                <li>
                    <code>BANK-PRESS</code> &lt;page&gt; &lt;bank&gt;
                    <br />
                    <i>Press and release a button (run both down and up actions)</i>
                </li>
                <li>
                    <code>BANK-DOWN</code> &lt;page&gt; &lt;bank&gt;
                    <br />
                    <i>Press the button (run down actions)</i>
                </li>
                <li>
                    <code>BANK-UP</code> &lt;page&gt; &lt;bank&gt;
                    <br />
                    <i>Release the button (run up actions)</i>
                </li>
            </ul>
        </p>

        <p>
            <strong>Examples</strong>
        </p>

        <p>
            Set the emulator surface to page 23
            <br />
            <code>PAGE-SET 23 emulator</code>
        </p>

        <p>
            Press page 1 bank 2
            <br />
            <code>BANK-PRESS 1 2</code>
        </p>

        <h4>OSC Remote control</h4>
        <p>Remote triggering can be done by sending OSC commands to port <code>12321</code>.</p>
        <p><strong>Commands:</strong>
            <ul>
                <li>
                    <code>/press/bank/</code>&lt;page&gt; &lt;bank&gt;
                    <br />
                    <i>Press and release a button (run both down and up actions)</i>
                </li>
                <li>
                    <code>/press/bank/</code> &lt;page&gt; &lt;bank&gt; &lt;1&gt;
                    <br />
                    <i>Press the button (run down actions and hold)</i>
                </li>
                <li>
                    <code>/press/bank/</code> &lt;page&gt; &lt;bank&gt; &lt;0&gt;
                    <br />
                    <i>Release the button (run up actions)</i>
                </li>
                <li>
                    <code>/style/bgcolor/</code> &lt;page&gt; &lt;bank&gt; &lt;red 0-255&gt; &lt;green 0-255&gt; &lt;blue 0-255&gt;
                    <br />
                    <i>Change background color of button</i>
                </li>
                <li>
                    <code>/style/color/</code> &lt;page&gt; &lt;bank&gt; &lt;red 0-255&gt; &lt;green 0-255&gt; &lt;blue 0-255&gt;
                    <br />
                    <i>Change color of text on button</i>
                </li>
                <li>
                    <code>/style/text/</code> &lt;page&gt; &lt;bank&gt;  &lt;text&gt;
                    <br />
                    <i>Change text on a button</i>
                </li>
            </ul>
        </p>

        <p>
            <strong>Examples</strong>
        </p>

        <p>
            Press button 5 on page 1 down and hold
            <br />
            <code>/press/bank/1/5 1</code>
        </p>

        <p>
            Change button background color of button 5 on page 1 to red
            <br />
            <code>/style/bgcolor/1/5 255 0 0</code>
        </p>

        <p>
            Change the text of button 5 on page 1 to ONLINE
            <br />
            <code>/style/text/1/5 ONLINE</code>
        </p>

        <br />
        <p>
            <CButton color='success' href="/bitfocus@companion_v2.0@00.xml" target="_new">
                <FontAwesomeIcon icon={faFileImport} /> Download GrandMA2 Fixture file (v2.0)
            </CButton>
        </p>
        <p>
            <CButton color='success' href="/Bitfocus Companion Fixture.v3f" target="_new">
            <FontAwesomeIcon icon={faFileImport} /> Download Vista Fixture file (v2.0)
            </CButton>
        </p>

        <h4>RossTalk</h4>
        <p>Remote triggering can be done by sending RossTalk commands to port <code>7788</code>.</p>
        <p>
            <strong>Commands:</strong>
            <ul>

                <li>
                    <code>CC</code> &lt;page&gt;:&lt;button&gt;
                    <br />
                    <i>Press and release button</i>
                </li>
            </ul>
        </p>
        <p>
            <strong>Examples</strong>
        </p>

        <p>
            Press and release button 5 on page 2
            <br />
            <code>CC 2:5</code>
        </p>
    </>
}
