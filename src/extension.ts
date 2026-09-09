// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { clearApiKeyCommand, setApiKeyCommand, triggerCompletionCommand } from './commands';
import { DeepSeekInlineCompletionProvider } from './completion';
import { openSettingsView, SettingsViewProvider } from './settingsView';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('AI Autocomplete extension is now active!');

	// Provider that powers inline (ghost-text) suggestions.
	const provider = new DeepSeekInlineCompletionProvider(context.secrets);
	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider('*', provider)
	);

	// Sidebar settings view (activity bar icon on the left).
	const settingsProvider = new SettingsViewProvider(context.secrets, context.extensionUri);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SettingsViewProvider.viewType, settingsProvider)
	);

	// Commands.
	context.subscriptions.push(
		vscode.commands.registerCommand('autocomplete.trigger', () => triggerCompletionCommand())
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('autocomplete.setApiKey', () => setApiKeyCommand(context))
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('autocomplete.clearApiKey', () => clearApiKeyCommand(context))
	);
	context.subscriptions.push(
		vscode.commands.registerCommand('autocomplete.openSettings', () => openSettingsView())
	);
}

// This method is called when your extension is deactivated
export function deactivate() {}

