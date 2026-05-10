import type { Tabs } from '@base-ui/react/tabs'
import { useLocation, useNavigate } from '@tanstack/react-router'
import React from 'react'
import type { TabAreaRootProps } from './TabArea.js'

/**
 * Syncs the active tab with the URL path. The segment immediately following
 * `basePath` is used as the tab value, and changing tabs navigates to that path.
 *
 * Returns `{ value, onValueChange }` suitable for spreading onto `<TabArea.Root>`.
 *
 * @param basePath     The path prefix before the tab segment, e.g. `'/settings/protocols'`
 * @param defaultValue Fallback value when the URL has no tab segment
 *
 * @example
 * const tabSync = useTabPath('/settings/protocols', 'tcp-udp')
 * <TabArea.Root {...tabSync}>...</TabArea.Root>
 * // /settings/protocols/tcp-udp  →  value = 'tcp-udp'
 */
export function useTabPath(basePath: string, defaultValue?: string): Pick<TabAreaRootProps, 'value' | 'onValueChange'> {
	const { pathname } = useLocation()
	const navigate = useNavigate()

	const normalized = basePath.endsWith('/') ? basePath.slice(0, -1) : basePath
	const rest = pathname.startsWith(normalized) ? pathname.slice(normalized.length) : ''
	const segment = rest.replace(/^\//, '').split('/')[0]
	const value: string | undefined = segment || defaultValue

	const onValueChange = React.useCallback(
		(newValue: Tabs.Tab.Value) => {
			void navigate({ to: `${normalized}/${String(newValue)}` })
		},
		[navigate, normalized]
	)

	return { value, onValueChange }
}
