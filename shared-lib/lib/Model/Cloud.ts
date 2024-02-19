export interface CloudControllerState {
	uuid: string // the machine UUID
	authenticating: boolean // is the cloud authenticating
	authenticated: boolean // is the cloud authenticated
	authenticatedAs: string | undefined // the cloud username
	ping: boolean // is someone watching ping info?
	regions: string[] // the cloud regions
	error: null | string // the error message
	cloudActive: boolean // is the cloud active
	canActivate: boolean // can the cloud be activated
}

export interface CloudRegionState {
	connected: boolean
	enabled: boolean
	error: string | null
	name: string
	pingResults: number
}
