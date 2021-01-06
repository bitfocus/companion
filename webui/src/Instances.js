import React from 'react'
import {CButton} from '@coreui/react'
import { socketEmit, CompanionContext } from './util'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQuestionCircle } from '@fortawesome/free-solid-svg-icons'

import { HelpModal } from './ModuleHelp'

export class Instances extends React.Component {
    static contextType = CompanionContext

    constructor(props) {
        super(props)

        this.state = {
            // modules
            name: {},
            category: {},
            manufacturer: {},
            modules: {},

            // instances
            instances: {},
            instanceStatus: {},

            // help text to show
            helpContent: null
        }

        this.updateInstancesInfo = this.updateInstancesInfo.bind(this)
        this.updateInstancesStatus = this.updateInstancesStatus.bind(this)
    }

    updateInstancesInfo(db) {
        this.setState({
            instances: db,
        })
    }

    updateInstancesStatus(status) {
        this.setState({
            instanceStatus: status
        })
    }

    componentDidMount() {
        socketEmit(this.context.socket, 'modules_get', []).then(([res]) => {
            const modulesObj = {}
            for (const mod of res.modules) {
                modulesObj[mod.name] = mod
            }
            this.setState({
                ...res,
                modules: modulesObj,
            })
        }).catch((e) => {
            console.error('Failed to load modules list', e)
        })
        
        this.context.socket.on('instances_get:result', this.updateInstancesInfo)
        this.context.socket.emit('instances_get')

        this.context.socket.on('instance_status', this.updateInstancesStatus)
        this.context.socket.emit('instance_status_get')
    }

    componentWillUnmount() {
        this.context.socket.off('instances_get:result', this.updateInstancesInfo)
        this.context.socket.off('instance_status', this.updateInstancesStatus)
    }

    showHelp(name) {
        socketEmit(this.context.socket, 'instance_get_help', [name]).then(([err, result]) => {
            if (err) {
                alert('Error getting help text');
                return;
            }
            if (result) {
                this.setState({
                    helpContent: [name, result]
                })
                // var $helpModal = $('#helpModal');
                // $helpModal.find('.modal-title').html('Help for ' + name);
                // $helpModal.find('.modal-body').html(result);
                // $helpModal.modal();
            }
        })
    }

    renderInstancesTable() {
        return Object.entries(this.state.instances).filter(i => i[1].instance_type !== 'bitfocus-companion').map(([id, instance]) => {
            const moduleInfo = this.state.modules[instance.instance_type]

            const status = this.state.instanceStatus[id]
            let statusClassName = ''
            let statusText = ''
            let statusTitle = ''

            if (status) {
                switch(status[0]) {
                    case -1:
                        statusText = 'Disabled'
                        statusClassName = 'instance-status-disabled'
                        break
                    case 0:
                        statusText = 'OK'
                        statusTitle = status[1] ?? ''
                        statusClassName = 'instance-status-ok'
                        break
                    case 1:
                        statusText = status[1] ?? ''
                        statusTitle = status[1] ?? ''
                        statusClassName = 'instance-status-warn'
                        break
                    case 2:
                        statusText = 'ERROR'
                        statusTitle = status[1] ?? ''
                        statusClassName = 'instance-status-error'
                        break
                    case null:
                        statusText = status[1] ?? ''
                        statusTitle = status[1] ?? ''
                        statusClassName = 'instance-status-warn'
                        break
                    default: break
                }
            }

            return <tr key={id}>
                <td>
                    {
                        moduleInfo
                        ? <>
                            {
                                moduleInfo?.help ? <div className="instance_help" onClick={() => this.showHelp(instance.instance_type)}><FontAwesomeIcon icon={faQuestionCircle} /></div> : ''
                            }
                            <b>{ moduleInfo?.shortname ?? '' }</b>
                            <br/>
                            { moduleInfo?.manufacturer ?? '' }
                        </>
                        : instance.instance_type
                    }
                </td>
                <td>{ instance.label }</td>
                <td className={statusClassName} title={statusTitle}>{statusText}</td>
                <td>
                    <CButton onClick={null} variant='ghost' color='danger'>delete</CButton>
                    {
                        instance.enabled
                        ? <CButton onClick={() => this.context.socket.emit('instance_enable', id, false)} variant='ghost' color='warning'>disable</CButton>
                        : <CButton onClick={() => this.context.socket.emit('instance_enable', id, true)} variant='ghost' color='success'>enable</CButton>
                    }
                    {
                        instance.enabled
                        ? <CButton onClick={null} color='primary'>edit</CButton>
                        : ''
                    }
                </td>
            </tr>
        })

		// 	$button_delete.click(function() {
		// 		if (confirm('Delete instance?')) {
		// 			var id = $(this).data('id');
		// 			$("#instanceConfigTab").hide();
		// 			socket.emit('instance_delete', id);
		// 			$(this).parent().parent().remove();
		// 		}
		// 	});

		// 	$button_edit.click(function() {
		// 		var id = $(this).data('id');
		// 		socket.emit('instance_edit', id);
		// 	});


		// 	(function (name) {
		// 		$tr.find('.instance_help').click(function () {
		// 			show_module_help(name);
		// 		});
		// 	})(list[n].instance_type);
    }

    render() {
        return (
            <div>
                <h4>Connections / Instances</h4>
                <p>Instances are the connections companion makes to other devices and software in order to control them.</p>

                <HelpModal content={this.state.helpContent} hide={() => this.setState({ helpContent: null })} />

                <table className="table table-responsive-sm">
                    <thead>
                        <tr>
                            <th>Module</th>
                            <th>Label</th>
                            <th>Status</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {this.renderInstancesTable()}
                    </tbody>
                </table>

                {/* <div class="dropdown" style="float:left">
                    <a id="dLabel" role="button" data-toggle="dropdown" class="btn btn-primary add-instance-button" data-target="#">
                            Add by category</span>
                    </a>
                    <ul class="dropdown-menu multi-level add-instance-ul" id="addInstance" role="menu" aria-labelledby="dropdownMenu">
                    </ul>
                </div>

                <div class="dropdown" style="float:left">&nbsp;
                    <a id="dLabelByManufacturer" role="button" data-toggle="dropdown" class="btn btn-primary add-instance-button" data-target="#">
                            Add by manufacturer</span>
                    </a>
                    <ul class="dropdown-menu multi-level add-instance-ul" id="addInstanceByManufacturer" role="menu" aria-labelledby="dropdownMenu">
                    </ul>
                </div>

                    <p></p>
                <div style='clear:both'>
                    <br>
                    <input type="text" class="form-control" placeholder="Add by search.." id='instance_add_search_field'>
                    <div id='instance_add_search_results'>
                    </div>
                </div> */}
            </div>
        )
    }
}