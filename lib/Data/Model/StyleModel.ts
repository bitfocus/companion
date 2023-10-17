import type { CompanionAlignment } from "@companion-module/base"

export type DrawStyleModel = {
    style: 'pageup' | 'pagedown' | 'pagenum'
} | DrawStyleButtonModel

export interface DrawStyleButtonModel {
    style: 'button'

    show_topbar: boolean | 'default' | undefined
    alignment: CompanionAlignment | undefined
    pngalignment: CompanionAlignment | undefined

    size: number | 'small' | 'large'
    text: string

    bgcolor: string | number
    color: string | number

    png64: string | undefined
    imageBuffers: DrawImageBuffer[]

    pushed: boolean
    step_cycle: number | undefined
    cloud: boolean | undefined
    bank_status: 'error' | 'warning' | 'ok' | undefined
    action_running: boolean | undefined
}

export interface DrawImageBuffer {
    buffer: Buffer | undefined
    x: number | undefined
    y: number | undefined
    width: number | undefined
    height: number | undefined
}