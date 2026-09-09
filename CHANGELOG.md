# Change Log

All notable changes to the "AI Autocomplete" extension will be documented in this file.

## [0.0.1] - 2026-09-09

### Added
- Inline (ghost-text) autocomplete powered by DeepSeek (OpenAI-compatible API).
- Manual trigger command + `Alt+\` keybinding.
- Secure API key handling via VS Code `SecretStorage` (server-side; code-server friendly).
- Optional environment-variable API key fallback (`DEEPSEEK_API_KEY`).
- Configurable base URL, model, temperature, token budget and debounce delay.
- Support for any OpenAI-compatible Chat Completions endpoint (DeepSeek, Ollama, vLLM, LM Studio, ...).
