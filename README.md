# OpenBench

A desktop chat app for experimenting with local LLMs via Ollama.

## Features

- Real-time streaming chat with multiple models
- Modular AI provider support (Ollama, OpenAI, Anthropic)
- Tool calling with user approval
- Conversation persistence with SQLite
- Authentication and session management
- Light/dark theme support
- Prompt templating with temporal variables
- Message thinking process visibility
- Message editing and regeneration
- Conversation archiving and search
- Plugin system for extensible tools
- Inspector panel for request/response debugging
- Temporary chat mode for incognito sessions
- Auto-renaming conversations based on content

## Architecture

### Frontend
- React 19 with TypeScript and Vite
- Zustand for state management
- Tailwind CSS and MUI/Base UI for styling
- Custom hooks for chat streaming, model picking, etc.

### Backend
- Rust with Tauri 2 for desktop shell
- SQLx for SQLite database access
- Ollama-rs for Ollama integration
- Provider system for multiple LLM backends
- Tool execution system with approval workflow

### Data Flow
1. User sends message via ChatInput
2. useChatStore adds user message to state and DB
3. useChatStream sends message to Rust backend via invoke
4. Rust backend processes with selected provider (Ollama/OpenAI/etc)
5. Backend streams chunks via Tauri events (chat-chunk, chat-thinking, tool-invocation)
6. Frontend reducers update streaming messages in real-time
7. On completion, message is saved to DB and conversation updated

## Tech Stack

### Frontend
- **Framework:** React 19
- **Language:** TypeScript
- **Build Tool:** Vite
- **State Management:** Zustand
- **Styling:** Tailwind CSS, MUI, Base UI
- **Icons:** Lucide

### Backend
- **Language:** Rust
- **Framework:** Tauri 2
- **Database:** SQLx (SQLite)
- **Ollama Client:** ollama-rs
- **Async Runtime:** Tokio

### Database
- SQLite (via tauri-plugin-sql)
- Tables: conversations, messages, users, sessions, provider_configs

### AI/Runtime
- Ollama (local LLM server)
- Support for OpenAI and Anthropic APIs via provider configuration

### Deployment
- Tauri for building native desktop binaries
- Bun as package manager

### Tooling
- TypeScript compiler
- Bun package manager

## Quick Start

### Prerequisites
- [Bun](https://bun.sh) (or npm/yarn/pnpm)
- Tauri system dependencies (see [Tauri prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites))
- [Ollama](https://ollama.ai) running locally (for full features)

### Installation
```bash
bun install
```

### Development
```bash
# Runs Vite dev server with Tauri
bun run tauri dev
```

### Build
```bash
# Build full Tauri app (creates native binary)
bun run tauri build
```

### Preview Built Frontend
```bash
bun run preview
```

## Environment Variables

No environment variables are required for basic operation.
The Ollama host can be configured via the provider settings in the UI (defaults to `http://localhost:11434`).

## Project Structure

```
openbench/
├── src/                 # Frontend source
│   ├── components/      # UI components
│   ├── hooks/           # Custom React hooks
│   ├── lib/             # Utilities (database, chat helpers)
│   ├── services/        # Service integrations (Ollama, providers)
│   ├── store/           # Zustand stores
│   ├── types/           # TypeScript types
│   ├── App.tsx          # Root component
│   └── main.tsx         # Entry point
├── src-tauri/           # Backend (Rust/Tauri)
│   ├── src/             # Rust source
│   │   ├── commands/    # Tauri command handlers
│   │   ├── db/          # Database connection and migrations
│   │   ├── tools/       # Tool definitions
│   │   ├── providers/   # Provider abstractions
│   │   ├── models/      # Data models
│   │   └── lib.rs       # Backend entry point
│   ├── migrations/      # SQL migration scripts
│   ├── icons/           # Application icons
│   ├── capabilities/    # Tauri capability definitions
│   ├── gen/             # Generated Tauri code
│   ├── Cargo.toml       # Rust dependencies
│   └── tauri.conf.json  # Tauri configuration
├── public/              # Static assets served by Vite
├── dist/                # Built frontend (generated)
├── bun.lockb            # Bun lockfile
├── package.json         # Frontend dependencies and scripts
└── tsconfig.json        # TypeScript configuration
```

## Development

### Install
```bash
bun install
```

### Dev Commands
- `bun run tauri dev` - Start development server
- `bun run build` - Build frontend only
- `bun run preview` - Preview built frontend

### Build Commands
- `bun run tauri build` - Build production binary

### Type Checking
```bash
bun run tsc --noEmit
```

## API / Integrations

### Backend Commands (Tauri)
- `get_local_models` - Lists available Ollama models
- `pull_model` - Downloads a model with progress events
- `chat_stream` - Streaming chat with tool support
- `chat` - Non-streaming chat (used for auto-titling)
- `cancel_chat` - Aborts current generation
- Authentication: `auth_signup`, `auth_login`, `auth_logout`, etc.
- Providers: `get_providers`, `update_provider_config`, `refresh_provider_health`
- Tools: `list_tools`, `toggle_tool`, `approve_tool`
- Users: `create_user`, `list_users`, `get_user`, `update_user`, `delete_user`

### Frontend Integration
- Communicates with backend via `@tauri-apps/api/core`'s `invoke` function
- Uses Zustand stores for state management
- Custom hooks encapsulate backend interactions

### AI Providers
- Ollama Local: Direct connection to Ollama instance
- Ollama API: Remote Ollama-compatible API

## Deployment

The application is built as a native desktop binary using Tauri.
- Supports Windows, macOS, and Linux
- Build command: `bun run tauri build`
- Output: Platform-specific installer/binary in `src-tauri/target/release/bundle`

> [!WARNING]
> Currently Ollama does not accept tauri.localhost in the OLLAMA_ORIGINS. Build will NOT work with ollama.

## Security

### Authentication
- Session-based authentication with 30-day expiry
- Passwords hashed using bcrypt
- User data stored in local SQLite database
- Session tokens stored securely with HTTP-only equivalent protections
