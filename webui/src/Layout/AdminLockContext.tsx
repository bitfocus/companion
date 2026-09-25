import { createContext, useContext } from 'react'

export interface AdminLockContextType {
	canLock: boolean
	setLocked: () => void
}

export const AdminLockContext = createContext<AdminLockContextType>({
	canLock: false,
	setLocked: () => {},
})

export function useAdminLock(): AdminLockContextType {
	return useContext(AdminLockContext)
}
