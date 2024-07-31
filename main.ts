import { App, Modal, Plugin, PluginSettingTab, requestUrl, Setting } from 'obsidian';

// Remember to rename these classes and interfaces!

interface TimeSyncSettings {
	TimeSyncServiceURL: string;
	TimeSyncServiceToken: string;
}

const DEFAULT_SETTINGS: TimeSyncSettings = {
	TimeSyncServiceURL: '',
	TimeSyncServiceToken: '',
}

export default class TimeSyncPlugin extends Plugin {
	settings: TimeSyncSettings;

	async onload() {
		await this.loadSettings();

		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sync-redmine-timeentries-from-selection',
			name: 'Sync time entries',
			callback: () => {
				new TimeSyncModal(this.app, this.settings).open()
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new TimeSyncSettingTab(this.app, this));

	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class TimeEntry {
	date: String
	duration: Number
	tags: String[]
	note: String
}

class TimeSyncModal extends Modal {
	settings: TimeSyncSettings;

	constructor(app: App, settings: TimeSyncSettings) {
		super(app);
		this.settings = settings
	}

	async onOpen() {
		const { contentEl } = this;

		const file = this.app.workspace.getActiveFile()
		if (file) {
			let result: TimeEntry[] = []
			const regex = /^\|\W\W*\|.*\|/gm;

			let content = await this.app.vault.read(file)
			let m;
			while ((m = regex.exec(content)) !== null) {
				// This is necessary to avoid infinite loops with zero-width matches
				if (m.index === regex.lastIndex) {
					regex.lastIndex++;
				}

				// The result can be accessed through the `m`-variable.
				m.forEach((match, _) => {
					let data = match.split('|')
					let entry = new TimeEntry()

					entry.date = file.name.replace('.md', '')
					entry.duration = Number(data[2].trim())
					entry.tags = data[3].trim().split(" ")
					entry.note = data[4].trim()

					result.push(entry)
				});
			}

			console.log(result)
			console.log("Starting request with: ")
			let requestURLParam = {
				url: this.settings.TimeSyncServiceURL,
				method: 'POST',
				body: JSON.stringify(result),
				headers: {
					'Authorization': `Basic ${this.settings.TimeSyncServiceToken}`,
				}
			};
			console.log(requestURLParam)

			const response = await requestUrl(requestURLParam);

			console.log(response)

			content = ""
			result.forEach(element => {
				content += `${JSON.stringify(element)}\n`
			});
			contentEl.append(content);
		} else {
			contentEl.setText("empty")
		}
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class TimeSyncSettingTab extends PluginSettingTab {
	plugin: TimeSyncPlugin;

	constructor(app: App, plugin: TimeSyncPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('TimeSyncServiceURL')
			.setDesc('The URL instance.')
			.addText(text => text
				.setPlaceholder('Enter the URL')
				.setValue(this.plugin.settings.TimeSyncServiceURL)
				.onChange(async (value) => {
					this.plugin.settings.TimeSyncServiceURL = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('TimeSyncServiceToken')
			.setDesc('The token to use')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue(this.plugin.settings.TimeSyncServiceToken)
				.onChange(async (value) => {
					this.plugin.settings.TimeSyncServiceToken = value;
					await this.plugin.saveSettings();
				}));

	}
}
