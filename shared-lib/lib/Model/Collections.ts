export interface CollectionBase<T> {
	id: string
	label: string
	sortOrder: number
	children: CollectionBase<T>[]
	metaData: T
}
