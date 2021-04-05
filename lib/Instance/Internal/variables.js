module.exports = {
	update_variables(system) {
		var variables = getNetworkInterfaces()
		var ip = ''

		for (let i = 0; i < variables.length; i++) {
			this.setVariable(variables[i].name, variables[i].address)
			ip += variables[i].address + '\\n'
		}

		variables.push({
			label: 'Time of day (HH:MM:SS)',
			name: 'time_hms',
		})
		variables.push({
			label: 'Time of day (HH:MM)',
			name: 'time_hm',
		})
		variables.push({
			label: 'Time of day (HH)',
			name: 'time_h',
		})
		variables.push({
			label: 'Time of day (MM)',
			name: 'time_m',
		})
		variables.push({
			label: 'Time of day (SS)',
			name: 'time_s',
		})

		variables.push({
			label: 'Instances with errors',
			name: 'instance_errors',
		})
		variables.push({
			label: 'Instances with warnings',
			name: 'instance_warns',
		})
		variables.push({
			label: 'Instances OK',
			name: 'instance_oks',
		})

		variables.push({
			label: 'IP of binded network interface',
			name: 'bind_ip',
		})

		variables.push({
			label: 'IP of all network interfaces',
			name: 'all_ip',
		})

		variables.push({
			label: 'T-bar position',
			name: 't-bar',
		})

		variables.push({
			label: 'Shuttle position',
			name: 'shuttle',
		})

		variables.push({
			label: 'Jog position',
			name: 'jog',
		})

		this.setVariable('instance_errors', 0)
		this.setVariable('instance_warns', 0)
		this.setVariable('instance_oks', 0)
		this.setVariable('time_hms', '')
		this.setVariable('time_hm', '')
		this.setVariable('time_h', '')
		this.setVariable('time_m', '')
		this.setVariable('time_s', '')
		this.setVariable('bind_ip', '')
		this.setVariable('all_ip', ip)
		this.setVariable('t-bar', '0')
		this.setVariable('jog', '0')
		this.setVariable('shuttle', '0')

		this.setVariableDefinitions(variables)
	},
}
