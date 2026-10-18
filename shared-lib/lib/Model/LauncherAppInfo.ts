/**
 * The state of the Companion web server, as reported by the Companion process to the desktop launcher
 */
export type LauncherAppStatus = 'starting' | 'running' | 'error'

export interface LauncherHttpStatus {
	appStatus: LauncherAppStatus
	/** Detail shown under the status, eg why binding failed */
	appMessage: string | null
	/** The url to open the GUI at, only set while running */
	appLaunch: string | null
}

export interface LauncherAppInfo extends LauncherHttpStatus {
	appVersion: string
}

/** Shown when this OS version will not be supported by the next major release of Companion */
export interface LauncherVersionWarning {
	platform: 'macos'
	/** The OS version needed to keep receiving updates */
	minimumVersion: string
}

/** Sent over IPC from the Companion process whenever the http server binds or fails to bind */
export interface LauncherHttpStatusMessage extends LauncherHttpStatus {
	messageType: 'http-bind-status'
}
