import React from 'react'
import { CButton, CRow } from '@coreui/react'
import { CompanionContext } from './util'
import shortid from 'shortid'
import moment from 'moment'


export class LogPanel extends React.Component {
    static contextType = CompanionContext

    constructor(props) {
        super(props)

        let config = {
            debug: false,
            info: false,
            warn: true
        }

        try {
            const rawConfig = window.localStorage.getItem("debug_config");
            config = JSON.parse(rawConfig)
        } catch (e) {
            // use defaults
            window.localStorage.setItem("debug_config", JSON.stringify(config));
        }

        this.state = {
            config,
            history: []
        }
    }

    componentDidMount() {
        this.context.socket.emit('log_catchup')
        this.context.socket.on('log', this.logRecv)
    }
    componentWillUnmount() {
        this.context.socket.off('log', this.logRecv)
    }

    logRecv = (time, source, level, message) => {
        const item = {
            id: shortid(),
            time,
            source,
            level,
            message
        }

        this.setState({
            history: [
                item,
                ...this.state.history,
            ].slice(0, 500)
        })
    }

    clearLog = () => {
        this.context.socket.emit('log_clear')
        this.getClearLog()
    }

    getClearLog = () => {
        this.setState({
            history: [],
        })
    }

    updateForLevel = (level, state) => {
        this.setState({
            config: {
                ...this.state.config,
                [level]: state,
            }
        }, () => {
            window.localStorage.setItem("debug_config", JSON.stringify(this.state.config));
        })
    }

    render() {
        return <div>
            <CRow>
            <div className='col-lg-12 logbuttons'>
                <CButton color="warning" size="sm" onClick={() => this.updateForLevel('warn', !this.state.config.warn)} style={{ opacity: this.state.config.warn ? 1 : 0.2 }}>Warning</CButton>
                <CButton color="info" size="sm" onClick={() => this.updateForLevel('info', !this.state.config.info)} style={{ opacity: this.state.config.info ? 1 : 0.2 }}>Info</CButton>
                <CButton color="debug" size="sm" onClick={() => this.updateForLevel('debug', !this.state.config.debug)} style={{ opacity: this.state.config.debug ? 1 : 0.2 }}>Debug</CButton>
                <CButton color="danger" size="sm" className="float-right" onClick={this.clearLog} style={{ opacity: this.state.history.length > 0 ? 1 : 0.2 }}>Clear log</CButton>
            </div>
            </CRow>
            
            <div>
                {
                    this.state.history.map(h => {
                        // console.log(h)
                        if (h.level === 'error' || this.state.config[h.level]) {
                            const time_format = moment(h.time).format('DD. HH:mm:ss')
                            return <div key={h.id} className={`log-line log-type-${h.level}`}>
                                {time_format} <strong>{h.source}</strong>: {h.message}
                            </div>
                        } else {
                            return ''
                        }
                    })
                }
            </div>
        </div>
    }
}

