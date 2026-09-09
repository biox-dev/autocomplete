// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { clearApiKeyCommand, setApiKeyCommand, triggerCompletionCommand } from './commands';
import { DeepSeekInlineCompletionProvider } from './completion';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	console.log('AI Autocomplete extension is now active!');

	// Provider that powers inline (ghost-text) suggestions.
	const provider = new DeepSeekInlineCompletionProvider(context.secrets);
	context.subscriptions.push(
		vscode.languages.registerInlineCompletionItemProvider('*', provider)
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
}

// This method is called when your extension is deactivated
export function deactivate() {}

