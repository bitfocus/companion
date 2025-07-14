export interface ClientLogLine {
	time: number
	source: string
	level: string
	message: string
}

export type ClientLogUpdate = ClientLogUpdateLines | ClientLogUpdateClear

export interface ClientLogUpdateClear {
	type: 'clear'
}
export interface ClientLogUpdateLines {
	type: 'lines'
	lines: ClientLogLine[]
}
