// Setup the env for DEBUG

if (process.env.DEVELOPER !== undefined && process.env.DEBUG === undefined) {
	process.env['DEBUG'] = '*,-websocket*,-express*,-engine*,-socket.io*,-send*,-db,-NRC*,-follow-redirects'
}
