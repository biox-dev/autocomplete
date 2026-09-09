import * as vscode from 'vscode';

/** Key under which the API key is stored in VS Code SecretStorage. */
export const SECRET_API_KEY = 'autocomplete.apiKey';

/** Namespace used for user-facing configuration settings. */
const CONFIG_NS = 'autocomplete';

export interface Config {
	enabled: boolean;
	baseUrl: string;
	model: string;
	maxTokens: number;
	temperature: number;
	debounceMs: number;
	maxContextChars: number;
	apiKeyEnvVar: string;
}

/** Reads the current effective configuration from VS Code settings. */
export function getConfig(): Config {
	const c = vscode.workspace.getConfiguration(CONFIG_NS);
	return {
		enabled: c.get<boolean>('enabled', true),
		baseUrl: (c.get<string>('apiBaseUrl', 'https://api.deepseek.com') || 'https://api.deepseek.com').replace(/\/+$/, ''),
		model: c.get<string>('model', 'deepseek-chat'),
		maxTokens: c.get<number>('maxTokens', 256),
		temperature: c.get<number>('temperature', 0.2),
		debounceMs: c.get<number>('debounceMs', 700),
		maxContextChars: c.get<number>('maxContextChars', 8000),
		apiKeyEnvVar: c.get<string>('apiKeyEnvVar', 'DEEPSEEK_API_KEY'),
	};
}

/**
 * Returns the API key to use.
 *
 * Priority:
 *  1. The key stored in SecretStorage (entered by the user via the UI).
 *  2. An environment variable (see `autocomplete.apiKeyEnvVar`).
 *
 * Storing the key in SecretStorage keeps it on the server side, which is ideal
 * for code-server / remote setups where the browser never needs the raw key.
 */
export async function getApiKey(secrets: vscode.SecretStorage): Promise<string | undefined> {
	try {
		const stored = await secrets.get(SECRET_API_KEY);
		if (stored && stored.trim().length > 0) {
			return stored.trim();
		}
	} catch (err) {
		console.error('[AI Autocomplete] Failed to read API key from SecretStorage:', err);
	}

	const cfg = getConfig();
	// Guard for environments where `process` is undefined (pure web extension host).
	const env = typeof process !== 'undefined' ? process.env[cfg.apiKeyEnvVar] : undefined;
	if (env && env.trim().length > 0) {
		return env.trim();
	}
	return undefined;
}

/** Stores a new API key (or deletes it when `key` is empty/undefined). */
export async function setApiKey(secrets: vscode.SecretStorage, key: string): Promise<void> {
	const trimmed = key.trim();
	if (!trimmed) {
		await secrets.delete(SECRET_API_KEY);
		return;
	}
	await secrets.store(SECRET_API_KEY, trimmed);
}

/** Removes any stored API key. */
export async function clearApiKey(secrets: vscode.SecretStorage): Promise<void> {
	await secrets.delete(SECRET_API_KEY);
}
