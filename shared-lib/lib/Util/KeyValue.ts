/** A change to one property of a `T`. Checking `key` narrows `value` to that property's type */
export type KeyValueChange<T> = {
	[K in keyof T]-?: { key: K; value: T[K] }
}[keyof T]
