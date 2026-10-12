# Console

A minimal dashboard to trigger and monitor Ansible playbooks from the browser.

## Features

- Register playbooks (name, description, path)
- Run a playbook with an inventory, common `ansible-playbook` options and extra vars
- Runs are queued and executed by a background worker, so long playbooks don't hit HTTP timeouts
- Execution history with status, timings, exit code and the full Ansible log
- Email and password login with a JWT stored in an `httpOnly` cookie

## Architecture

<img src="https://github.com/user-attachments/assets/9f908f95-4aeb-4e1d-a1cf-46784f567f5d" alt ="architecture_diagram">

```text
React (Cloudflare Pages)
        │  HTTPS
        ▼
Express API ──► SQLite (Prisma)
                    ▲
                    │ polls for QUEUED executions
                Worker ──► ansible-playbook ──► execution-<id>.log
```

- `POST /run` only creates an `Execution` row with status `QUEUED` and returns `202`.
- The worker picks one job at a time, runs `ansible-playbook`, writes stdout and stderr to a log file, then sets `SUCCESS` or `FAILED`.
- The API and the worker are separate processes that share the same database and log directory.

## Screenshots

<p align="center">
  <img src="https://github.com/user-attachments/assets/7e3cf2ed-c14b-464c-91db-0cd079b7114b" width="100%" style="border: 1px solid white;">
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/689ebdf0-f7cd-4126-a924-6d0929194e64" width="100%" style="border: 1px solid white;">
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/c51592c1-dfc3-421b-aea0-4ae1dfcc31b2" width="100%" style="border: 1px solid white;">
</p>

<p align="center">
  <img src="https://github.com/user-attachments/assets/53aa0bd6-f978-4013-a949-cb3a1248f0c2" width="100%" style="border: 1px solid white;">
</p>

## Tech stack

| Part | Stack |
|---|---|
| Frontend | React, TypeScript, Vite, Tailwind v4, shadcn/ui |
| Backend | Node.js, Express, Zod, JWT, bcrypt |
| Database | SQLite through Prisma |
| Worker | Node.js, `child_process.spawn` |


## Requirements

- Node.js 22 or later
- pnpm
- Ansible installed on the machine that runs the worker

> Run the server with **Node**, not Bun. The Prisma SQLite adapter uses `better-sqlite3`, which Bun doesn't support.

## Setup

### Server

```bash
cd server
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm build
```

Create `server/.env`:

```env
PORT=3000
JWT_SECRET=change-me
DATABASE_URL=file:./dev.db
LOG_DIR=/var/log/servauto
OPTIONS_ALLOWED_DIR=/opt/ansible
```

| Variable | Purpose |
|---|---|
| `PORT` | API port |
| `JWT_SECRET` | Secret used to sign login tokens |
| `DATABASE_URL` | SQLite database file |
| `LOG_DIR` | Where execution logs are written. Must be the same for the API and the worker |
| `OPTIONS_ALLOWED_DIR` | Optional. Inventory, key and vault files must be inside this directory |

Start the API and the worker:

```bash
pnpm start
```

### Frontend

```bash
cd client
pnpm install
pnpm dev        # local development
pnpm build      # production build in dist/
```

Create `client/.env`:

```env
VITE_API_URL=http://localhost:3000
```

For a production build, set `VITE_API_URL` to your API URL. Vite reads it at build time.

## Ansible options

Only options in the allowed list can be used (inventory, limit, tags, skip tags, start at task, check, diff, SSH user, private key, become, become user, vault password file, forks and verbosity). Interactive options such as `-k`, `-K` and `--ask-vault-pass` are not supported, because the worker has no terminal.