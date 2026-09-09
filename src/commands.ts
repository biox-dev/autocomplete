import * as vscode from 'vscode';
import { clearApiKey, setApiKey } from './config';

/**
 * Prompts the user for a DeepSeek API key and stores it securely in
 * SecretStorage. On code-server / remote hosts this keeps the key on the
 * server; it is never written to browser storage or sent to the front end.
 */
export async function setApiKeyCommand(context: vscode.ExtensionContext): Promise<void> {
	const value = await vscode.window.showInputBox({
		title: 'AI Autocomplete',
		prompt: 'Enter your DeepSeek API key (or another OpenAI-compatible key).',
		password: true,
		ignoreFocusOut: true,
		placeHolder: 'sk-...',
		validateInput: (input) => (input.trim().length === 0 ? 'API key cannot be empty.' : undefined),
	});

	if (value === undefined) {
		// Cancelled by the user.
		return;
	}

	await setApiKey(context.secrets, value);
	void vscode.window.showInformationMessage(
		value.trim() ? 'AI Autocomplete: API key saved.' : 'AI Autocomplete: API key cleared.'
	);
}

/** Clears the stored API key. */
export async function clearApiKeyCommand(context: vscode.ExtensionContext): Promise<void> {
	await clearApiKey(context.secrets);
	void vscode.window.showInformationMessage('AI Autocomplete: API key cleared.');
}

/**
 * Manually triggers the built-in inline-suggestion UI. This asks any registered
 * inline completion provider (including ours) for a suggestion at the cursor.
 */
export async function triggerCompletionCommand(): Promise<void> {
	const editor = vscode.window.activeTextEditor;
	if (!editor) {
		return;
	}
	await vscode.commands.executeCommand('editor.action.inlineSuggest.trigger');
}
