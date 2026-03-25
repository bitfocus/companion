// fix processing of hashes in url
// without this fix, clicking on a button to /user-guide/config/settings#surfaces, for example,
// will open the page but not scroll to `#surfaces`, apparently because the page hasn't hydrated in time to
// find the hash tag. This little function waits for rendering to complete and then tries again.
export function onRouteDidUpdate({ location }) {
	if (location.hash) {
		let id = location.hash.substring(1)
		try {
			id = decodeURIComponent(id)
		} catch {
			// do nothing. we'll keep the undecoded version
		}
		document.getElementById(id)?.scrollIntoView()
	}
}
