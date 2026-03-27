# Learning Path (tauri-applearning-path)

Desktop app built with **Tauri 2** and a **Solid.js** (Vite) frontend. The Rust backend uses SurrealDB and models via OpenRouter; importing PDFs and other documents requires a local **Python** environment with **Docling**.

## Requirements

| Component | Notes |
|-----------|--------|
| **Node.js** | npm (e.g. LTS); dependency install and Vite |
| **Rust** | `rustc` / `cargo` (stable toolchain); builds `src-tauri` |
| **Python 3** | For the virtualenv under `src-python/venv` |
| **Linux system libraries** | WebKitGTK and related deps required by Tauri — see [Tauri prerequisites for Linux](https://v2.tauri.app/start/prerequisites/) |

## First-time setup

### 1. Node dependencies

From the repository root:

```bash
npm install
```

### 2. `config.toml`

A `config.toml` file must exist in the **project root** (next to `package.json`). The repo includes an example with:

- `MODEL_NAME` — OpenRouter model id (e.g. `xiaomi/mimo-v2-pro`)
- `OUTPUT_LANGUAGE` — model output language (e.g. `Polish`)

Without a valid `config.toml`, the app will not start (it is read at startup).

### 3. `.env` and API key

In the same root directory, create a `.env` file with:

```env
OPENROUTER_API_KEY=your_key_here
```

The key is required for LLM-backed features.

### 4. Python environment (Docling)

Non-plain-text imports (e.g. PDF, DOCX) run `src-python/extract.py` using:

`src-python/venv/bin/python`

Create the venv and install dependencies:

```bash
cd src-python
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
cd ..
```

The first Docling run may download models; allow time and disk space.

## Development

From the **project root** (where `package.json` and `config.toml` live):

```bash
npm run tauri dev
```

This will:

1. Start the frontend via `npm run dev` (Vite; port from `tauri.conf.json`, typically `http://localhost:1420`).
2. Build and run the Tauri binary from `src-tauri`.

**Note:** The Rust code assumes the process working directory at app start is `src-tauri` (normal for `tauri dev`), so paths resolve to `config.toml`, `.env`, and `src-python/venv` under the repo root. Run Tauri from the project root as the CLI expects.

### Frontend only (no desktop window)

```bash
npm run dev
```

Useful for UI work; Tauri `invoke` calls and native APIs are not available outside the Tauri app.

## Production build

```bash
npm run tauri build
```

Artifacts end up under Tauri/Cargo build output (platform-dependent).

## Troubleshooting

- **`config.toml` or `OPENROUTER_API_KEY` errors** — ensure both files are in the project root, not inside `src-tauri`.
- **Python / Docling errors when importing** — confirm `src-python/venv` exists and `requirements.txt` is installed; stderr often appears in the terminal running `tauri dev`.
- **Logs** — some events may be written to `mas_system.log` in the project root (depends on how the app was launched).
