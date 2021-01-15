import React, { useContext, useEffect, useState } from 'react'
import { CAlert, CButton, CCol, CRow } from '@coreui/react'
import { CompanionContext, socketEmit } from './util'
import { BankPreview, dataToButtonImage } from './Buttons'
import { useDrag } from 'react-dnd'

export class InstancePresets extends React.Component {
    static contextType = CompanionContext

    constructor(props) {
        super(props)

        this.state = {
            presets: {},

            selectedInstanceId: null,
            selectedCategory: null,
        }
    }

    componentDidMount() {
        socketEmit(this.context.socket, 'get_presets', []).then(([data]) => {
            this.setState({ presets: data })
        }).catch((e) => {
            console.error('Failed to load presets')
        })
        this.context.socket.on('presets_update', this.updatePresets)
        this.context.socket.on('presets_delete', this.removePresets)
    }
    componentWillUnmount() {
        this.context.socket.off('presets_update', this.updatePresets)
        this.context.socket.off('presets_delete', this.removePresets)
    }

    componentDidUpdate(prevProps) {
        if (this.props.token !== prevProps.token) {
            this.setInstanceAndCategory(null, null)
        }
    }

    updatePresets = (id, presets) => {
        this.setState({
            presets: {
                ...this.state.presets,
                [id]: presets,
            }
        })
    }
    removePresets = (id) => {
        const newPresets = { ...this.state.presets }
        delete newPresets[id]
        this.setState({ presets: newPresets })
    }

    setInstanceAndCategory = (instance, category) => {
        this.setState({
            selectedInstanceId: instance,
            selectedCategory: category,
        })
    }

    renderInstancesList() {
        const keys = Object.keys(this.state.presets)
        if (keys.length === 0) {
            return <CAlert color='primary'>You have no instances that support presets at the moment. More and more modules will support presets in the future.</CAlert>
        } else {
            return keys.map((id) => {
                const instance = this.context.instances[id]
                const module = instance ? this.context.modules[instance.instance_type] : undefined
    
                return <div key={id}>
                    <CButton color='primary' className="choose_instance" onClick={() => this.setInstanceAndCategory(id, null)}>
                        { module?.label ?? '?' } ({ instance?.label ?? id })
                    </CButton>
                    <br /><br />
                    </div>
            })
        }
    }

    renderCategoryList() {
        const presets = this.state.presets[this.state.selectedInstanceId] ?? []
        const categories = new Set()
        for (const preset of presets) {
            categories.add(preset.category)
        }

        if (categories.size === 0) {
            return <CAlert color='primary'>Instance has no categories.</CAlert>
        } else {
            return <CRow>
                {
                    Array.from(categories).map((category) => {
                    return <CCol key={category} md={3} className="margbot">
                            <CButton color="primary" block onClick={() => this.setInstanceAndCategory(this.state.selectedInstanceId, category)}>{ category }</CButton>
                        </CCol>
                    })
                }
                </CRow>
        }
    }

    render() {
        if (this.state.selectedInstanceId) {
            const instance = this.context.instances[this.state.selectedInstanceId]
            const module = instance ? this.context.modules[instance.instance_type] : undefined

            const presets = this.state.presets[this.state.selectedInstanceId] ?? []

            if (this.state.selectedCategory) {
                const options = presets.filter(p => p.category === this.state.selectedCategory)

                return <div>
                    <CButton color='primary' className="pull-right back_main" onClick={() => this.setInstanceAndCategory(this.state.selectedInstanceId, null)}>Back</CButton>
                    <h4>Presets for { this.state.selectedCategory }</h4>
                    <p>Drag and drop the preset buttons below into your buttons-configuration.</p>

                    {
                        options.map((preset, i) => {
                            return <BankTemplatePreview key={i} instanceId={this.state.selectedInstanceId} onClick={() => null} preset={preset} alt={preset.label} />
                        })
                    }
                    <div className="presetbank buttonbankwidth" data-drawn="no" data-instance="' + instance + '" title="' + preset.label + '" data-key="' + key + '">
                        <canvas width="72" style={{cursor:'pointer'}} height="72"></canvas>
                    </div>

                    <br style={{clear: 'both'}} />
                </div>
            } else {
                const categories = new Set()
                for (const preset of presets) {
                    categories.add(preset.category)
                }

                return <div>
                    <CButton color='primary' className="pull-right back_main" onClick={() => this.setInstanceAndCategory(null, null)}>Back</CButton>
                    <h4>Preset categories for  { module?.label ?? '?' } ({ instance?.label ?? this.state.selectedInstanceId })</h4>

                    { this.renderCategoryList() }
                </div>
            }
        } else {
        return <div>
            <h4>Available instance presets</h4>
           
           { this.renderInstancesList() }
        </div>
        }
    }
}

function BankTemplatePreview({ preset, instanceId, ...childProps }) {
    const context = useContext(CompanionContext)
    const [previewImage, setPreviewImage] = useState(null)

    const [{}, drag] = useDrag({
        item: { 
            type: 'preset',
            instanceId: instanceId,
            preset: preset,
        },
      })

    useEffect(() => {
        socketEmit(context.socket, 'graphics_preview_generate', [preset.bank]).then(([img]) => {
            setPreviewImage(dataToButtonImage(img))
        }).catch(e => {
            console.error('Failed to preview bank')
        })
    }, [preset.bank, context.socket])

    return (
        <BankPreview fixedSize dragRef={drag} {...childProps} preview={previewImage} />
    )
}
