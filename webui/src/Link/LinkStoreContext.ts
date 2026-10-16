import { createContext, useContext } from 'react'
import type { LinkStore } from './LinkStore.js'

export const LinkStoreContext = createContext<LinkStore | null>(null)

export function useLinkStore(): LinkStore {
	const store = useContext(LinkStoreContext)
	if (!store) throw new Error('useLinkStore must be used inside a LinkStoreProvider')
	return store
}
