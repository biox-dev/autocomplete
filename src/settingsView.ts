import * as vscode from 'vscode';
import {
	clearApiKey,
	DEFAULT_SYSTEM_PROMPT,
	getConfig,
	hasApiKey,
	setApiKey,
	setEnabled,
	setLogMessages,
	setSystemPrompt,
} from './config';

/** State object pushed to the webview when it loads. */
interface ViewState {
	enabled: boolean;
	hasApiKey: boolean;
	systemPrompt: string;
	isDefaultPrompt: boolean;
	baseUrl: string;
	model: string;
	logMessages: boolean;
}

/**
 * Sidebar settings view. Renders a small form (enable/disable, API key,
 * system prompt) and keeps the extension configuration in sync with the UI.
 */
export class SettingsViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'autocomplete.settingsView';

	private view?: vscode.WebviewView;

	constructor(
		private readonly secrets: vscode.SecretStorage,
		private readonly extensionUri: vscode.Uri
	) {}

	resolveWebviewView(
		webviewView: vscode.WebviewView,
		_context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken
	): void {
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')],
		};

		webviewView.webview.html = this.getHtml(webviewView.webview);

		webviewView.webview.onDidReceiveMessage(async (msg) => {
			await this.handleMessage(msg);
		});

		// Refresh state whenever the view becomes visible again.
		webviewView.onDidChangeVisibility(() => {
			if (webviewView.visible) {
				void this.postState();
			}
		});
	}

	private async handleMessage(msg: { command: string; value?: unknown }): Promise<void> {
		switch (msg.command) {
			case 'getState':
				await this.postState();
				break;
			case 'setEnabled':
				await setEnabled(Boolean(msg.value));
				this.postStatus(true, '已保存：开启状态已更新');
				break;
			case 'setLogMessages':
				await setLogMessages(Boolean(msg.value));
				this.postStatus(true, '已保存：日志打印已更新');
				break;
			case 'setApiKey':
				await setApiKey(this.secrets, String(msg.value ?? ''));
				await this.postState();
				this.postStatus(true, String(msg.value ?? '').trim() ? 'API Key 已保存' : 'API Key 已清除');
				break;
			case 'clearApiKey':
				await clearApiKey(this.secrets);
				await this.postState();
				this.postStatus(true, 'API Key 已清除');
				break;
			case 'setSystemPrompt':
				await setSystemPrompt(String(msg.value ?? ''));
				this.postStatus(true, '系统提示词已保存');
				break;
			case 'restoreSystemPrompt':
				await setSystemPrompt('');
				await this.postState();
				this.postStatus(true, '已恢复默认系统提示词');
				break;
			default:
				break;
		}
	}

	private async postState(): Promise<void> {
		if (!this.view) {
			return;
		}
		const cfg = getConfig();
		const isDefault = !cfg.systemPrompt.trim() || cfg.systemPrompt.trim() === DEFAULT_SYSTEM_PROMPT;
		const state: ViewState = {
			enabled: cfg.enabled,
			hasApiKey: await hasApiKey(this.secrets),
			// Always show a concrete prompt: the user's custom one, or the default.
			systemPrompt: isDefault ? DEFAULT_SYSTEM_PROMPT : cfg.systemPrompt.trim(),
			isDefaultPrompt: isDefault,
			baseUrl: cfg.baseUrl,
			model: cfg.model,
			logMessages: cfg.logMessages,
		};
		void this.view.webview.postMessage({ type: 'init', state });
	}

	private postStatus(ok: boolean, text: string): void {
		if (this.view) {
			void this.view.webview.postMessage({ type: 'status', ok, text });
		}
	}

	private getHtml(webview: vscode.Webview): string {
		const styleUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'media', 'main.css')
		);
		const scriptUri = webview.asWebviewUri(
			vscode.Uri.joinPath(this.extensionUri, 'media', 'main.js')
		);

		const nonce = getNonce();

		return /* html */ `<!DOCTYPE html>
<html lang="zh-CN">
<head>
	<meta charset="UTF-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';" />
	<link href="${styleUri}" rel="stylesheet" />
</head>
<body>
	<div class="header">
		<span class="title">AI Autocomplete 设置</span>
	</div>

	<!-- 开启 / 关闭 -->
	<div class="card">
		<div class="row">
			<label class="field" for="enabled">
				启用 AI 自动补全
				<span class="hint">关闭后不再产生建议</span>
			</label>
			<label class="switch">
				<input type="checkbox" id="enabled" />
				<span class="slider"></span>
			</label>
		</div>
	</div>

	<!-- API Key -->
	<div class="card">
		<div class="row">
			<label class="field" for="apiKey">
				API Key
				<span class="hint">密钥安全保存在 SecretStorage</span>
			</label>
			<span id="keyBadge" class="badge no">未配置</span>
		</div>
		<input type="password" id="apiKey" autocomplete="off" placeholder="sk-..." />
		<div class="row" style="margin-top:8px;">
			<button id="saveKey" class="btn">保存 API Key</button>
			<button id="clearKey" class="btn secondary">清除</button>
		</div>
	</div>

	<!-- 日志打印 -->
	<div class="card">
		<div class="row">
			<label class="field" for="logMessages">
				打印 LLM 消息到 OUTPUT
				<span class="hint">在输出面板打印发送给模型的消息和返回结果</span>
			</label>
			<label class="switch">
				<input type="checkbox" id="logMessages" />
				<span class="slider"></span>
			</label>
		</div>
	</div>

	<!-- 系统提示词 -->
	<div class="card">
		<div class="row">
			<label class="field" for="systemPrompt">
				系统提示词 (System Prompt)
				<span class="hint">默认提示词已预填，可直接修改</span>
			</label>
			<button id="restorePrompt" class="btn secondary" title="恢复为内置默认提示词">恢复默认</button>
		</div>
		<textarea id="systemPrompt"></textarea>
	</div>

	<!-- 只读元信息 -->
	<div class="card">
		<div class="row">
			<span class="meta">模型</span>
			<span class="meta" id="model"></span>
		</div>
		<div class="row">
			<span class="meta">Base URL</span>
			<span class="meta" id="baseUrl"></span>
		</div>
	</div>

	<div id="status" class="status"></div>
	<div class="footer">DeepSeek (OpenAI 兼容 API)</div>

	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function getNonce(): string {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let i = 0; i < 32; i++) {
		text += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return text;
}

/** Focus / reveal the settings view (used by the gear command in the view title). */
export async function openSettingsView(): Promise<void> {
	await vscode.commands.executeCommand(`${SettingsViewProvider.viewType}.focus`);
}
