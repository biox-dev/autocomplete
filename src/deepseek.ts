/**
 * Minimal OpenAI-compatible Chat Completions client.
 * DeepSeek exposes an OpenAI-compatible API, so this works with DeepSeek
 * and any other compatible endpoint (Ollama, vLLM, LM Studio, etc.).
 *
 * Uses the global `fetch` (Node >= 18), so it runs fine in the Node-based
 * extension host used by VS Code and code-server.
 */

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant';
	content: string;
}

export interface ChatCompletionOptions {
	baseUrl: string;
	apiKey: string;
	model: string;
	messages: ChatMessage[];
	maxTokens: number;
	temperature: number;
	/** Optional extra HTTP headers. */
	headers?: Record<string, string>;
	signal?: AbortSignal;
}

export interface ChatCompletionResponse {
	id: string;
	choices: Array<{
		index: number;
		message: { role: string; content?: string | null };
		finish_reason?: string | null;
	}>;
}

/** Thrown when the upstream API returns a non-OK status or an error payload. */
export class ApiError extends Error {
	constructor(
		message: string,
		public readonly status?: number,
		public readonly statusText?: string,
		public readonly body?: string
	) {
		super(message);
		this.name = 'ApiError';
	}
}

/**
 * Calls the OpenAI-compatible `/chat/completions` endpoint and returns the
 * generated text content.
 */
export async function chatCompletion(opts: ChatCompletionOptions): Promise<string> {
	const url = `${opts.baseUrl.replace(/\/+$/, '')}/chat/completions`;

	const controller = new AbortController();
	const abort = () => controller.abort();
	opts.signal?.addEventListener('abort', abort, { once: true });

	let response: Response;
	try {
		response = await fetch(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${opts.apiKey}`,
				...opts.headers,
			},
			body: JSON.stringify({
				model: opts.model,
				messages: opts.messages,
				max_tokens: opts.maxTokens,
				temperature: opts.temperature,
				stream: false,
			}),
			signal: controller.signal,
		});
	} finally {
		opts.signal?.removeEventListener('abort', abort);
	}

	if (!response.ok) {
		const body = await response.text().catch(() => '');
		throw new ApiError(
			`AI Autocomplete request failed (${response.status} ${response.statusText})`,
			response.status,
			response.statusText,
			body
		);
	}

	const data = (await response.json()) as ChatCompletionResponse;
	const content = data?.choices?.[0]?.message?.content;

	if (!content || content.trim().length === 0) {
		throw new ApiError('The AI model returned an empty completion.');
	}

	return content;
}
