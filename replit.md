# Overview

This is a 3D interactive web application built with React Three Fiber (R3F) that renders a room scene with desks, a human developer character, a robot character, and a player-controlled entity. The player can navigate around the room using arrow keys or WASD controls. The UI includes Arabic text suggesting this may be targeted at an Arabic-speaking audience. The project follows a full-stack architecture with an Express backend and a React frontend, though the backend currently has minimal functionality (placeholder routes and in-memory storage).

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript, bundled by Vite
- **3D Rendering**: React Three Fiber (`@react-three/fiber`) with Drei helpers (`@react-three/drei`) for the 3D scene. All 3D objects (Room, Desk, HumanDeveloper, Robot, Player) are custom components built from primitive Three.js geometries (boxes, spheres, cylinders) — no external 3D model files are loaded
- **GLSL Support**: Vite plugin `vite-plugin-glsl` is configured for shader imports
- **UI Components**: Shadcn/ui component library (Radix UI primitives + Tailwind CSS + class-variance-authority). Components live in `client/src/components/ui/`
- **State Management**: Zustand stores in `client/src/lib/stores/` for game state (`useGame` — tracks phase, managerDoorLocked) and audio state (`useAudio`)
- **Styling**: Tailwind CSS with CSS custom properties for theming (HSL-based color tokens defined via CSS variables). PostCSS handles processing
- **Player Controls**: `@react-three/drei` KeyboardControls with WASD/Arrow key mappings. Player movement is bounded within the room
- **Data Fetching**: TanStack React Query is set up (`client/src/lib/queryClient.ts`) but currently not actively used since the backend has no real API endpoints
- **Path Aliases**: `@/` maps to `client/src/`, `@shared/` maps to `shared/`

## Backend Architecture
- **Framework**: Express.js running on Node with TypeScript (executed via `tsx`)
- **HTTP Server**: Node's `createServer` wraps the Express app, enabling WebSocket support if needed later
- **Dev Server**: Vite dev server runs as middleware in development mode (`server/vite.ts`), providing HMR
- **Production**: Static files served from `dist/public` after build. The build process uses Vite for the client and esbuild for the server
- **API Pattern**: All API routes prefixed with `/api` and registered in `server/routes.ts`
- **SFM Pipeline Engine**: The GPT robot (robot-1) operates as a deterministic stage builder pipeline, NOT a conversational assistant. It accepts structured task-board JSON from upstream systems (pd.sillar.us, cp.sillar.us) or plain story text, then auto-generates analysis.json → S0 → S1 → S2 workflow stages with gated close commands ("اقفل S0/S1/S2"). No clarifying questions. Minimal responses.
  - **Pipeline Flow (Two-Step Generation)**: For each stage: Step A = Extract structured facts (S0_FACTS/S1_FACTS/S2_FACTS) from input → Step B = Fill workflow template using only extracted facts (grounded, not generic). Quality Gate validates before GitHub push; auto-regeneration on failure.
  - **Fact Extractor** (`server/sfmFactExtractor.ts`): Defines fact schemas (core_problem, harm, failure_modes, governance_gaps, evidence_examples, constraints, out_of_scope, success_criteria for S0; actors, flow_steps, hard_rules, edge_cases for S1; conceptual_components, state_model, governance_rules, tradeoffs for S2). Provides `buildExtractPrompt()` and `buildFillPrompt()` for each stage.
  - **Quality Validator** (`server/sfmQualityValidator.ts`): Comprehensive stage validator with scoring (0-100, pass threshold ≥85 + no hard failures). Common layer validates JSON, required nodes (group/stage/insight/outcome/direction/gate-problem/alignment-gate/evidence-node), exactly 6 custom edges, parentId matching, exportedAt. S0 rules: 3/4 concrete example categories, outcome must include 3 dimensions (Data Integrity/Process Governance/Availability), direction must be positive not negation, gateChecklist 5-7 YES/NO questions (no KPIs), no solution words. S1 rules: 4+ actors, explicit 5-step flow, 3 hard rules verbatim (لا عمل دون اسناد / لا تحويل لحالة التذكرة قبل الاسناد / لا اغلاق نهائي قبل معاينة القسم الطالب), outcome must describe product shape, no tech leak. S2 rules: hard-ban tech keywords (Laravel/React/Node/PHP/Redis/Kafka/Docker/K8s etc.), outcome must NOT mention ADRs/diagrams/implementation, must include conceptual components + state model + governance boundaries. Returns ValidationResult with failures[], requiredFixPrompt, patchSuggestions[]. Auto-regeneration pipeline: validate→regenerate (GPT-4o)→revalidate→block/push.
  - **Session State**: Tracks repoBound, repoOwner/repoName, runId, inputReceived, inputType (json|story), stageStatus (S0/S1/S2: pending|pushed|closed)
  - **Stage Discipline**: S0=problem lock only, S1=actors+flow+rules, S2=conceptual components+state model (no tech stack)
  - **Error Handling**: Tool result truncation (8000 chars), GPT 429 rate limit handling, GitHub HTML error detection, token refresh with 60s buffer
  - **Safety Nets**: Retry mechanism forces tool calls when GPT responds with text-only but mandatory action is pending; owner/repo override corrects GPT's parameters; quality gate blocks weak output before push
- **Background Jobs**: `server/backgroundJobs.ts` — in-memory job queue that processes AI chat tasks asynchronously. Jobs continue executing on the server even if the user closes the browser. API: `POST /api/jobs`, `GET /api/jobs`, `GET /api/jobs/:id`, `DELETE /api/jobs/completed`
- **Auto-Trigger**: `server/autoTrigger.ts` — autonomous task watcher that polls ClickUp at configurable intervals, finds tasks assigned to a specific user with matching statuses (e.g., "to do", "pending"), and auto-processes them with AI (reads task description, executes on GitHub, updates status to complete). API: `POST /api/auto-trigger/start`, `POST /api/auto-trigger/stop`, `GET /api/auto-trigger/config`, `GET /api/auto-trigger/logs`, `POST /api/auto-trigger/scan`, `POST /api/auto-trigger/clear-cache`
- **Storage Layer**: Abstract `IStorage` interface in `server/storage.ts` with a `MemStorage` in-memory implementation. This should be replaced with a database-backed implementation (using Drizzle) when needed
- **Logging**: Custom request logging middleware that tracks response times for `/api` routes

## Data Storage
- **ORM**: Drizzle ORM configured for PostgreSQL (`drizzle.config.ts`)
- **Schema**: Defined in `shared/schema.ts` — currently only a `users` table with `id`, `username`, and `password` fields
- **Validation**: `drizzle-zod` generates Zod schemas from the Drizzle table definitions for input validation
- **Migrations**: Output to `./migrations` directory. Schema push via `npm run db:push`
- **Current State**: The app uses in-memory storage (`MemStorage`) by default. The Drizzle/PostgreSQL setup is ready but not actively wired into the storage layer. The `DATABASE_URL` environment variable is required for database operations

## Build System
- **Development**: `npm run dev` — runs `tsx server/index.ts` which starts Express with Vite middleware for HMR
- **Production Build**: `npm run build` — runs `script/build.ts` which builds the client with Vite and the server with esbuild. Server dependencies in the allowlist are bundled to reduce cold start times
- **Production Start**: `npm start` — runs `node dist/index.cjs`
- **Type Checking**: `npm run check` — runs `tsc` with `noEmit`

# External Dependencies

- **Database**: PostgreSQL via `DATABASE_URL` environment variable, accessed through Drizzle ORM. Database schema management via `drizzle-kit push`
- **Session Store**: `connect-pg-simple` is listed as a dependency for PostgreSQL-backed sessions (not yet wired up)
- **3D Libraries**: Three.js ecosystem — `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing`
- **UI Framework**: Shadcn/ui component system built on Radix UI primitives, Tailwind CSS, Lucide icons
- **State Management**: Zustand with `subscribeWithSelector` middleware
- **Static Assets**: Wood texture at `client/public/textures/wood.jpg`, Inter font JSON at `client/public/fonts/inter.json`. Vite is configured to handle `.gltf`, `.glb`, `.mp3`, `.ogg`, `.wav` as assets