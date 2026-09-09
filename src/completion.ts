import * as vscode from 'vscode';
import { DEFAULT_SYSTEM_PROMPT, getApiKey, getConfig, type Config } from './config';
import { chatCompletion, type ChatMessage } from './deepseek';

let warnedAboutMissingKey = false;

/** Output channel used to print LLM request/response messages when enabled. */
let logChannel: vscode.OutputChannel | undefined;

function getLogChannel(): vscode.OutputChannel {
	if (!logChannel) {
		logChannel = vscode.window.createOutputChannel('AI Autocomplete');
	}
	return logChannel;
}

/** Prints the messages sent to the LLM and the returned response. */
function logMessages(cfg: Config, messages: ChatMessage[], response: string): void {
	if (!cfg.logMessages) {
		return;
	}
	const channel = getLogChannel();
	channel.show(true);
	const stamp = new Date().toLocaleTimeString();
	channel.appendLine(`==================== [${stamp}] ====================`);
	channel.appendLine('--- Messages sent to the LLM ---');
	for (const msg of messages) {
		channel.appendLine(`[${msg.role}]`);
		channel.appendLine(msg.content);
		channel.appendLine('----------------------------------');
	}
	channel.appendLine('--- Response from the LLM ---');
	channel.appendLine(response);
	channel.appendLine('====================================================');
	channel.appendLine('');
}

export function resetWarnings(): void {
	warnedAboutMissingKey = false;
}

/** Cancellable delay used to debounce automatic suggestions. */
function delay(ms: number, token: vscode.CancellationToken): Promise<void> {
	return new Promise<void>((resolve) => {
		if (ms <= 0) {
			resolve();
			return;
		}
		const timer = setTimeout(resolve, ms);
		token.onCancellationRequested(() => {
			clearTimeout(timer);
			resolve();
		});
	});
}

const MAX_PREFIX = 8_000;

/**
 * Builds the prompt messages sent to the model.
 * Only code before the cursor is used as context; the model is instructed to
 * continue from that point without repeating existing code.
 */
function buildMessages(document: vscode.TextDocument, position: vscode.Position, cfg: Config): ChatMessage[] {
	const start = new vscode.Position(0, 0);
	let prefix = document.getText(new vscode.Range(start, position));

	const limit = Math.min(cfg.maxContextChars, MAX_PREFIX);
	if (prefix.length > limit) {
		prefix = prefix.slice(prefix.length - limit);
	}

	const language = document.languageId;
	const fileName = document.fileName.split(/[\\/]/).pop() || 'untitled';

	const customPrompt = cfg.systemPrompt.trim();
	let systemContent: string;
	if (customPrompt && customPrompt !== DEFAULT_SYSTEM_PROMPT) {
		// User-provided custom system prompt. We still inject minimal context
		// about the file/language so completions stay relevant.
		systemContent = `${customPrompt}\n\n(The user is editing a ${language} file named "${fileName}". Output only the code to insert.)`;
	} else {
		systemContent = `The user is editing a ${language} file named "${fileName}".\n${DEFAULT_SYSTEM_PROMPT}`;
	}

	const system: ChatMessage = {
		role: 'system',
		content: systemContent,
	};

	const user: ChatMessage = {
		role: 'user',
		content: `Continue the code below. Output only the code that should be inserted at the cursor.\n\n${prefix}`,
	};

	
	return [system, user];
}

/**
 * Cleans up the raw model output into something safe to insert:
 *  - normalizes line endings,
 *  - removes accidental markdown code fences,
 *  - trims trailing whitespace / stray leading blank lines.
 */
export function sanitize(raw: string): string {
	let text = raw.replace(/\r\n/g, '\n');

	const fence = text.match(/```[^\n]*\n?([\s\S]*?)(?:```|$)/);
	if (fence && fence[1] && fence[1].trim().length > 0 && text.trim().startsWith('```')) {
		text = fence[1];
	}

	text = text.replace(/^\n+/, '').trimEnd();
	return text;
}

/**
 * Computes the range that the suggestion should replace.
 *
 * When the model output already begins with the partial word the user is
 * typing (e.g. user typed `con` and the model returned `console.log(...)`),
 * we start the replacement range at the beginning of that word so the ghost
 * text does not duplicate it. Otherwise we insert right at the cursor.
 */
function computeReplaceStart(
	document: vscode.TextDocument,
	position: vscode.Position,
	cleaned: string
): vscode.Position {
	const lineText = document.lineAt(position.line).text;
	const upToCursor = lineText.slice(0, position.character);
	const match = upToCursor.match(/[\p{L}\p{N}_$]+$/u);
	if (match && cleaned.startsWith(match[0])) {
		return new vscode.Position(position.line, position.character - match[0].length);
	}
	return position;
}

/** Whether a given document is eligible for suggestions. */
function isSupportedDocument(document: vscode.TextDocument): boolean {
	return document.uri.scheme === 'file' || document.uri.scheme === 'untitled';
}

export class DeepSeekInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
	constructor(private readonly secrets: vscode.SecretStorage) {}

	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken
	): Promise<vscode.InlineCompletionList | vscode.InlineCompletionItem[] | null> {
		const empty: vscode.InlineCompletionList = { items: [] };

		const cfg = getConfig();
		if (!cfg.enabled || !isSupportedDocument(document)) {
			return empty;
		}

		const isManual = context.triggerKind === vscode.InlineCompletionTriggerKind.Invoke;

		// Don't try to autocomplete when there is essentially no code yet.
		if (!isManual && document.offsetAt(position) < 10) {
			return empty;
		}

		if (token.isCancellationRequested) {
			return empty;
		}

		// Debounce automatic requests: wait until the user pauses typing before
		// asking the model. Each new keystroke triggers a fresh provider call,
		// which cancels the previous pending one, so we effectively fire once the
		// user stops typing instead of once per character.
		if (!isManual && cfg.debounceMs > 0) {
			await delay(cfg.debounceMs, token);
			if (token.isCancellationRequested) {
				return empty;
			}
		}

		const apiKey = await getApiKey(this.secrets);
		if (!apiKey) {
			if (isManual && !warnedAboutMissingKey) {
				warnedAboutMissingKey = true;
				const action = await vscode.window.showWarningMessage(
					'AI Autocomplete: No API key configured. Set a DeepSeek API key to enable suggestions.',
					'Set API Key',
					'Later'
				);
				if (action === 'Set API Key') {
					await vscode.commands.executeCommand('autocomplete.setApiKey');
				}
			}
			return empty;
		}

		const controller = new AbortController();
		const onCancel = () => controller.abort();
		token.onCancellationRequested(onCancel);

		try {
			const messages = buildMessages(document, position, cfg);
			const raw = await chatCompletion({
				baseUrl: cfg.baseUrl,
				apiKey,
				model: cfg.model,
				messages,
				maxTokens: cfg.maxTokens,
				temperature: cfg.temperature,
				signal: controller.signal,
			});

			// Print the request/response messages to OUTPUT when enabled.
		logMessages(cfg, messages, raw);

			if (token.isCancellationRequested) {
				return empty;
			}

			const cleaned = sanitize(raw);
			if (!cleaned) {
				return empty;
			}

			const replaceStart = computeReplaceStart(document, position, cleaned);
			const item = new vscode.InlineCompletionItem(
				cleaned,
				new vscode.Range(replaceStart, position)
			);

			return { items: [item] };
		} catch (err) {
			if (token.isCancellationRequested || (err instanceof Error && err.name === 'AbortError')) {
				return empty;
			}
			console.error('[AI Autocomplete] Completion request failed:', err);
			const message =
				err instanceof Error
					? err.message
					: 'Unknown error while requesting a completion.';
			if (isManual) {
				void vscode.window.showErrorMessage(`AI Autocomplete: ${message}`);
			}
			return empty;
		}
	}
}
