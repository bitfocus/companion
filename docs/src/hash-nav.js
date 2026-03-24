// fix processing of hashess in url
// without this being installed in the docusaurus config, clicking on a button to /user-guide/config/settings#surfaces,
// for example, will open the page but not scroll to #surfaces, apparently because the page hasn't hydrated in time to
// find the hash tag. This little function waits for rendering to complete and then tries again.
export function onRouteDidUpdate({ location }) {
	if (location.hash) {
		const id = decodeURIComponent(location.hash.substring(1))

		const tryScroll = () => {
			const el = document.getElementById(id)
			if (el) {
				el.scrollIntoView({ behavior: 'smooth', block: 'start' })
				return true
			}
			return false
		}

		if (!tryScroll()) {
			const interval = setInterval(() => {
				if (tryScroll()) clearInterval(interval)
			}, 50)
			setTimeout(() => clearInterval(interval), 2000)
		}
	}
}
