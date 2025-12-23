import { Buffer } from 'buffer'

// Hack for csv library which needs a global 'Buffer'
window.Buffer = Buffer

export const PRIMARY_COLOR: string = '#d50215'

export const VARIABLE_UNKNOWN_VALUE = '$NA'
