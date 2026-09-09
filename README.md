# AI Autocomplete

AI inline autocomplete for **VS Code** and **code-server**, powered by an
OpenAI-compatible Chat Completions API (DeepSeek by default). It shows
**ghost-text suggestions** as you type (or on demand) and lets you accept them
with **Tab**.

## Features

- 🧠 **Inline (ghost-text) autocomplete** — a gray suggestion appears after a
  short pause while you type. Press **Tab** to accept, **Esc** to dismiss.
- ⌨️ **Manual trigger** — press **`Alt+\`** (or run the command) to request a
  suggestion at the cursor at any time.
- 🔌 **Any OpenAI-compatible backend** — DeepSeek by default, but you can point
  it at Ollama, vLLM, LM Studio, a self-hosted proxy, etc.
- 🔒 **Secure, server-side API key** — the key is entered in the UI and stored
  in VS Code `SecretStorage`. In code-server / remote setups it stays on the
  server; it is never written to the browser or sent to the front end.

## Why it works great with code-server

This extension is a normal (non-web) extension that runs in the **Node-based
extension host**. On code-server that extension host lives on the server, next
to your code, so:

- The model request and your API key never touch the browser.
- No browser CORS issues, no custom webview wiring needed.
- It also works with VS Code Desktop, VS Code Remote-SSH/Containers, and the
  VS Code CLI.

## Requirements

- VS Code `^1.80.0` or a compatible code-server build.
- A DeepSeek API key (or another OpenAI-compatible endpoint). Get one at
  https://platform.deepseek.com.

## Getting started

1. Install the extension.
2. Run the command **`AI Autocomplete: Set API Key`** from the Command Palette
   (`Ctrl+Shift+P`) and paste your DeepSeek API key.
   > Alternatively set the environment variable `DEEPSEEK_API_KEY` on the
   > server (see `autocomplete.apiKeyEnvVar`).
3. Open a file and start typing — a ghost suggestion should appear after a
   short pause. Press **Tab** to accept it.

### Keybindings

| Action                  | Key   |
| ----------------------- | ----- |
| Trigger a suggestion    | Alt+\ |
| Accept the suggestion   | Tab   |
| Dismiss the suggestion  | Esc   |

> `Tab` / `Esc` are the built-in inline-suggest keys. If they do not work,
> make sure `editor.inlineSuggest.enabled` is `true` in your settings.

## Extension Settings

This extension contributes the following settings (all under `autocomplete.*`):

| Setting                        | Default                    | Description                                                        |
| ------------------------------ | -------------------------- | ------------------------------------------------------------------ |
| `autocomplete.enabled`         | `true`                     | Enable/disable AI inline autocomplete.                             |
| `autocomplete.apiBaseUrl`      | `https://api.deepseek.com` | Base URL of an OpenAI-compatible Chat Completions API.             |
| `autocomplete.model`           | `deepseek-chat`            | Model used for completions.                                        |
| `autocomplete.maxTokens`       | `256`                      | Max tokens generated per completion.                               |
| `autocomplete.temperature`     | `0.2`                      | Sampling temperature (lower = more deterministic).                 |
| `autocomplete.debounceMs`      | `700`                      | Inactivity (ms) before an automatic suggestion is requested.       |
| `autocomplete.maxContextChars` | `8000`                     | Max code context characters sent to the model.                     |
| `autocomplete.apiKeyEnvVar`    | `DEEPSEEK_API_KEY`         | Env var name used as a fallback API key.                           |

### Commands

| Command                               | Description                          |
| ------------------------------------- | ------------------------------------ |
| `AI Autocomplete: Trigger Suggestion` | Ask for a suggestion at the cursor.  |
| `AI Autocomplete: Set API Key`        | Store/update the API key securely.   |
| `AI Autocomplete: Clear API Key`      | Remove the stored API key.           |

## Usage tips

- For a quick single-line completion, pause ~0.7 s after typing and the ghost
  text appears automatically.
- To force a suggestion immediately, press **`Alt+\`**.
- Point `autocomplete.apiBaseUrl` at a local model server such as
  `http://localhost:11434/v1` (Ollama) for a fully offline experience.

## Known Issues / Notes

- Ghost-text rendering requires `editor.inlineSuggest.enabled` (on by default
  in recent VS Code/code-server).
- Automatic suggestions are debounced to avoid excessive API calls;
  suggestions appear once you pause typing.

## Release Notes

### 0.0.1

- Initial release: DeepSeek-powered inline autocomplete for VS Code and
  code-server, with secure SecretStorage API key handling and manual trigger.
