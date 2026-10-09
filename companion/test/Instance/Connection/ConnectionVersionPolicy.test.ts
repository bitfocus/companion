import { expect, test, vi } from 'vitest'
import { InstanceVersionUpdatePolicy } from '@companion-app/shared/Model/Instance.js'
import {
	ConnectionOperations,
	type ConnectionOperationsDeps,
} from '../../../lib/Instance/Connection/ConnectionOperations.js'

function setup() {
	const controller = {
		getConnectionClientJson: vi.fn(() => ({ test: { moduleId: 'test-module', moduleVersionId: '1.0.0' } })),
		setConnectionLabelAndConfig: vi.fn(() => ({ ok: true })),
		setModuleVersionAndActivate: vi.fn(() => true),
		modules: { getModuleManifest: vi.fn(() => ({})) },
	}
	const operations = new ConnectionOperations({
		instanceController: controller,
		logger: {},
	} as unknown as ConnectionOperationsDeps)
	return { operations, controller }
}

test('policy-only save preserves version and other connection settings', async () => {
	const { operations, controller } = setup()
	await operations.setConnectionModuleVersion({
		connectionId: 'test',
		moduleId: 'test-module',
		versionId: '1.0.0',
		updatePolicy: InstanceVersionUpdatePolicy.Beta,
	})
	expect(controller.setConnectionLabelAndConfig).toHaveBeenCalledWith(
		'test',
		{
			label: null,
			enabled: null,
			config: null,
			secrets: null,
			updatePolicy: InstanceVersionUpdatePolicy.Beta,
			upgradeIndex: null,
		},
		{ patchConfig: undefined, patchSecrets: undefined }
	)
	expect(controller.setModuleVersionAndActivate).not.toHaveBeenCalled()
})

test('same version without a policy still activates', async () => {
	const { operations, controller } = setup()
	await operations.setConnectionModuleVersion({
		connectionId: 'test',
		moduleId: 'test-module',
		versionId: '1.0.0',
	})
	expect(controller.setModuleVersionAndActivate).toHaveBeenCalledWith('test', 'test-module@1.0.0', null)
	expect(controller.setConnectionLabelAndConfig).not.toHaveBeenCalled()
})

test('version change applies the chosen policy in the same operation', async () => {
	const { operations, controller } = setup()
	await operations.setConnectionModuleVersion({
		connectionId: 'test',
		moduleId: 'test-module',
		versionId: '2.0.0',
		updatePolicy: InstanceVersionUpdatePolicy.Manual,
	})
	expect(controller.setModuleVersionAndActivate).toHaveBeenCalledWith(
		'test',
		'test-module@2.0.0',
		InstanceVersionUpdatePolicy.Manual
	)
	expect(controller.setConnectionLabelAndConfig).not.toHaveBeenCalled()
})
