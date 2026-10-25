import { stringifyError } from '@companion-app/shared/Stringify.js'
import { DataStoreTableViewBase } from './TableViewBase.js'

type ValueIfJsonEncodable<T> = T extends number | { [key: string]: any } ? T : never

export class DataStoreTableView<TableContent extends Record<string, any>> extends DataStoreTableViewBase {
	/**
	 * Get all rows from the table
	 */
	all(): TableContent {
		// TODO - how to make this safe for json vs string?

		const out: Record<string, unknown> = {}

		for (const [id, value] of Object.entries(this.allRaw())) {
			try {
				out[id] = JSON.parse(value)
			} catch (_e) {
				out[id] = value
			}
		}

		return out as TableContent
	}

	/**
	 * Get a value from the table
	 * @param id - the key to be retrieved
	 */
	get<T extends keyof TableContent>(id: T): ValueIfJsonEncodable<TableContent[T]> | undefined {
		this.validateKey(id)

		const value = this.getRaw(id)
		if (!value) return undefined

		try {
			return JSON.parse(value)
		} catch (e) {
			this.logger.warn(`Error parsing ${id}: ${stringifyError(e)}`)
			return undefined
		}
	}

	/**
	 * Get a value from the table or set a default value
	 * @param id - the key to be retrieved
	 * @param defaultValue - the default value to store if the key doesn't exist
	 */
	getOrDefault<T extends keyof TableContent>(
		id: T,
		defaultValue: ValueIfJsonEncodable<TableContent[T]>
	): ValueIfJsonEncodable<TableContent[T]> {
		this.validateKey(id)

		const value = this.getRaw(id)
		if (value === undefined) {
			this.setRaw(id, JSON.stringify(defaultValue))
			return defaultValue
		}

		try {
			return JSON.parse(value)
		} catch (e) {
			this.logger.warn(`Error parsing ${String(id)}: ${stringifyError(e)}`)
			return defaultValue
		}
	}

	/**
	 * Set a value in the table
	 * @param id - the key to be set
	 * @param value - the value to be set
	 * @returns whether the value was written
	 */
	set<T extends keyof TableContent>(id: T, value: ValueIfJsonEncodable<TableContent[T]>): boolean {
		this.validateKey(id)

		return this.setRaw(id, JSON.stringify(value))
	}

	/**
	 * Delete a value from the table
	 * @param id - the key to be deleted
	 */
	delete(id: keyof TableContent): void {
		this.validateKey(id)

		this.deleteRaw(id)
	}
}
