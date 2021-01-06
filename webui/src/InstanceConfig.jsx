import React from 'react'
import { CompanionContext, socketEmit } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

export class InstanceConfig extends React.Component {
    static contextType = CompanionContext

    state = {
        loaded: false,

        helpContent: null,

        configFields: [],
        instanceConfig: {},
    }

    // TODO - any changes made by another client will not be shown, and will be lost if this presses save

    componentDidMount() {
        socketEmit(this.context.socket, 'instance_edit', [this.props.instanceId]).then(([_instanceId, configFields, instanceConfig]) => {
            //
            this.setState({
                loaded: true,
                configFields: configFields,
                instanceConfig: instanceConfig
            })
        }).catch((e) => {
            console.error('Failed to load instance edit info:', e)
        })
    }


    render() {
        if (!this.state.loaded) {
            return <>
                <p>Loading...</p>
            </>
        }

        const instanceConfig = this.state.instanceConfig
        const moduleInfo = this.context.modules[instanceConfig.instance_type]

        return <>
            <h4 style={{ textTransform: 'capitalize' }}>
                {
                    moduleInfo?.help ? <div className="instance_help" onClick={() => this.props.showHelp(instanceConfig.instance_type)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : ''
                }
                { moduleInfo?.shortname ?? instanceConfig.instance_type} configuration
            </h4>
            <div id='instanceConfigFields' class="row"></div>
            <div id='instanceConfigButtons'></div>
            <hr />
            <div id='instanceConfigVariables' class="row col-lg-12">
                <h4>List of dynamic variables</h4>
                <table class="table table-responsive-sm">
                    <thead>
                        <tr>
                            <th>Variable</th>
                            <th>Description</th>
                            <th>Current value</th>
                        </tr>
                    </thead>
                    <tbody id="instanceConfigVariableList"></tbody>
                </table>
            </div>
        </>
    }
}