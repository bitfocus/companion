/**
 * Only some env vars should be forwarded to child processes
 */
export function PreserveEnvVars(): Record<string, string> {
	const preserveNames = [
		// Ensure proxy settings are preserved
		'HTTP_PROXY',
		'HTTPS_PROXY',
		'NO_PROXY',
		'http_proxy',
		'https_proxy',
		'no_proxy',

		// Preserve some standard paths
		'XDG_RUNTIME_DIR',
		'HOME',
		'USERPROFILE',
		'TMP',
		'TEMP',
		'TMPDIR',

		// Companion settings that are relevant to modules
		'DISABLE_IPV6',
	]

	const preservedEnvVars: Record<string, string> = {}
	for (const name of preserveNames) {
		const value = process.env[name]
		if (value !== undefined) {
			preservedEnvVars[name] = value
		}
	}

	return preservedEnvVars
}
