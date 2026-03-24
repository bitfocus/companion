// fix processing of hashes in url
// without this fix, clicking on a button to /user-guide/config/settings#surfaces, for example,
// will open the page but not scroll to `#surfaces`, apparently because the page hasn't hydrated in time to
// find the hash tag. This little function waits for rendering to complete and then tries again.
let scrollInterval = null
let scrollTimeout = null

export function onRouteDidUpdate({ location }) {
	// Clear any in-flight scroll attempt from a previous navigation
	clearInterval(scrollInterval)
	clearTimeout(scrollTimeout)

	if (location.hash) {
		let id = location.hash.substring(1)
		try {
			id = decodeURIComponent(id)
		} catch {
			// do nothing. we'll keep the undecoded version
		}

		const tryScroll = () => {
			const el = document.getElementById(id)
			if (el) {
				const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
				el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
				return true
			}
			return false
		}

		if (!tryScroll()) {
			let timeoutId = null
			const intervalId = setInterval(() => {
				if (tryScroll()) {
					clearInterval(intervalId)
					if (timeoutId) clearTimeout(timeoutId)
				}
			}, 50)
			timeoutId = setTimeout(() => clearInterval(intervalId), 2000)

			scrollInterval = intervalId
			scrollTimeout = timeoutId
		}
	}
}
