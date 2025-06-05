export interface GroupBase<T> {
	id: string
	label: string
	sortOrder: number
	children: GroupBase<T>[]
	metaData: T
}
