import type {
	RecordSessionListInfo,
	RecordSessionInfo,
	RecordSessionUpdate,
} from '@companion-app/shared/Model/ActionRecorderModel.js'
import { observable, runInAction, action } from 'mobx'
import { applyJsonPatchInPlace } from '~/Stores/ApplyDiffToMap'
import { assertNever } from '~/util'

export class ActionRecorderSessionStore {
	#sessions = observable.map<string, RecordSessionListInfo>()
	#selectedSessionId = observable.box<string | null>(null)
	#selectedSessionInfo = observable.box<RecordSessionInfo | null>(null)
	#isFinishing = observable.box(false)

	get selectedSessionId(): string | null {
		return this.#selectedSessionId.get()
	}

	get selectedSessionInfo(): RecordSessionInfo | null {
		return this.#selectedSessionInfo.get()
	}

	get isFinishing(): boolean {
		return this.#isFinishing.get()
	}
	set isFinishing(value: boolean) {
		runInAction(() => {
			this.#isFinishing.set(value)
		})
	}

	updateSessionInfo = action((update: RecordSessionUpdate) => {
		switch (update.type) {
			case 'init':
				this.#selectedSessionInfo.set(update.session)
				break
			case 'patch': {
				const existingSession = this.#selectedSessionInfo.get()
				if (!existingSession) {
					console.warn('Received patch for session, but no session is selected')
					return
				}
				applyJsonPatchInPlace(existingSession, update.patch)
				break
			}
			case 'remove':
				this.#selectedSessionInfo.set(null)
				break
			default:
				assertNever(update)
				break
		}
	})

	updateSessionList = action((update: Record<string, RecordSessionListInfo>) => {
		this.#sessions.replace(update)

		// Ensure the selected session ID is valid
		const selectedSessionId = this.#selectedSessionId.get()
		if (!selectedSessionId || !this.#sessions.has(selectedSessionId)) {
			this.#selectedSessionId.set(this.#sessions.keys().next().value || null)
			this.#selectedSessionInfo.set(null)
			this.#isFinishing.set(false)
		}
	})
}
