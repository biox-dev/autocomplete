// @ts-check
(function () {
	// Acquire the VS Code webview API.
	const vscode = acquireVsCodeApi();

	const els = {
		enabled: document.getElementById('enabled'),
		logMessages: document.getElementById('logMessages'),
		keyInput: document.getElementById('apiKey'),
		keyBadge: document.getElementById('keyBadge'),
		saveKey: document.getElementById('saveKey'),
		clearKey: document.getElementById('clearKey'),
		prompt: document.getElementById('systemPrompt'),
		restorePrompt: document.getElementById('restorePrompt'),
		model: document.getElementById('model'),
		baseUrl: document.getElementById('baseUrl'),
		status: document.getElementById('status'),
	};

	let promptTimer = null;
	let statusTimer = null;

	// Ask the extension for the current state once the view is shown.
	vscode.postMessage({ command: 'getState' });

	// Message channel back from the extension.
	window.addEventListener('message', (event) => {
		const msg = event.data;
		if (!msg || typeof msg !== 'object') {
			return;
		}

		switch (msg.type) {
			case 'init':
				applyState(msg.state || {});
				break;
			case 'status':
				showStatus(msg.ok, msg.text);
				break;
		}
	});

	function applyState(state) {
		if (typeof state.enabled === 'boolean') {
			els.enabled.checked = state.enabled;
			setDisabled(!state.enabled);
		}
		if (typeof state.logMessages === 'boolean') {
			els.logMessages.checked = state.logMessages;
		}
		if (typeof state.hasApiKey === 'boolean') {
			els.keyBadge.textContent = state.hasApiKey ? '已配置' : '未配置';
			els.keyBadge.className = 'badge ' + (state.hasApiKey ? 'yes' : 'no');
			if (state.hasApiKey) {
				els.keyInput.placeholder = '已保存密钥（留空则不变）';
				els.keyInput.value = '';
			} else {
				els.keyInput.placeholder = 'sk-...';
			}
		}
		if (typeof state.systemPrompt === 'string') {
			els.prompt.value = state.systemPrompt;
		}
		if (typeof state.baseUrl === 'string') {
			els.baseUrl.textContent = state.baseUrl;
		}
		if (typeof state.model === 'string') {
			els.model.textContent = state.model;
		}
	}

	function setDisabled(disabled) {
		els.keyInput.disabled = disabled;
		els.saveKey.disabled = disabled;
		els.clearKey.disabled = disabled;
		els.prompt.disabled = disabled;
		els.restorePrompt.disabled = disabled;
	}

	function showStatus(ok, text) {
		els.status.textContent = text;
		els.status.className = 'status ' + (ok ? 'ok' : 'err');
		clearTimeout(statusTimer);
		statusTimer = setTimeout(() => {
			els.status.className = 'status';
			els.status.textContent = '';
		}, 3000);
	}

	// Enable / disable switch.
	els.enabled.addEventListener('change', () => {
		const value = els.enabled.checked;
		setDisabled(!value);
		vscode.postMessage({ command: 'setEnabled', value });
	});

	// Print LLM messages to OUTPUT switch.
	els.logMessages.addEventListener('change', () => {
		vscode.postMessage({ command: 'setLogMessages', value: els.logMessages.checked });
	});

	// API key actions.
	els.saveKey.addEventListener('click', () => {
		vscode.postMessage({ command: 'setApiKey', value: els.keyInput.value });
		els.keyInput.value = '';
	});
	els.clearKey.addEventListener('click', () => {
		vscode.postMessage({ command: 'clearApiKey' });
	});

	// System prompt: save on blur or after a short pause while typing.
	function schedulePromptSave() {
		clearTimeout(promptTimer);
		promptTimer = setTimeout(() => {
			vscode.postMessage({ command: 'setSystemPrompt', value: els.prompt.value });
		}, 600);
	}
	els.prompt.addEventListener('input', schedulePromptSave);
	els.prompt.addEventListener('blur', () => {
		clearTimeout(promptTimer);
		vscode.postMessage({ command: 'setSystemPrompt', value: els.prompt.value });
	});

	// Restore the built-in default system prompt.
	els.restorePrompt.addEventListener('click', () => {
		vscode.postMessage({ command: 'restoreSystemPrompt' });
	});
})();
