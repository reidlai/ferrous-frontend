export type WorkspacePath =
	| '/investigation'
	| '/radar'
	| '/analytics'
	| '/simulator'
	| '/benchmarks'
	| '/pipeline-performance';

export interface ReplayStatus {
	readonly stream: string;
	readonly throughput: string;
	readonly mode: 'read-only';
	readonly quickstartUrl: string;
}

export interface WorkspaceState {
	currentPath: WorkspacePath;
	ttftMs: number;
	walLatencyMs: number;
	replayStatus: ReplayStatus;
}

export const TENANT_OPTIONS = ['SP-01', 'RJ-01', 'MG-01'] as const;

export const WORKSPACE_LINKS: ReadonlyArray<{ label: string; path: WorkspacePath }> = [
	{ label: 'Investigation', path: '/investigation' },
	{ label: 'Live Ops Radar', path: '/radar' },
	{ label: 'SLA & Analytics', path: '/analytics' },
	{ label: 'Simulator', path: '/simulator' }
];

export const REPLAY_QUICKSTART_URL = 'https://github.com/reidlai/ferrous-cx#quickstart';

const VALID_WORKSPACE_PATHS: ReadonlySet<string> = new Set<WorkspacePath>([
	'/investigation',
	'/radar',
	'/analytics',
	'/simulator',
	'/benchmarks',
	'/pipeline-performance'
]);

export function normalizePath(path: string): WorkspacePath {
	if (VALID_WORKSPACE_PATHS.has(path)) {
		return path as WorkspacePath;
	}
	return '/investigation';
}

export function createWorkspaceStore(initialPath: string = '/investigation') {
	let state = $state<WorkspaceState>({
		currentPath: normalizePath(initialPath),
		ttftMs: 182,
		walLatencyMs: 0.4,
		replayStatus: {
			stream: 'olist/orders_stream',
			throughput: '24.8 msgs/s',
			mode: 'read-only',
			quickstartUrl: REPLAY_QUICKSTART_URL
		}
	});

	return {
		get currentPath() {
			return state.currentPath;
		},
		get ttftMs() {
			return state.ttftMs;
		},
		get walLatencyMs() {
			return state.walLatencyMs;
		},
		get replayStatus() {
			return state.replayStatus;
		},

		setCurrentPath(path: string) {
			state.currentPath = normalizePath(path);
		},

		navigateTo(path: string, gotoFn?: (url: WorkspacePath) => unknown) {
			const previousPath = state.currentPath;
			const normalized = normalizePath(path);
			state.currentPath = normalized;
			if (!gotoFn) {
				return undefined;
			}
			try {
				const result = gotoFn(normalized);
				if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
					return Promise.resolve(result).catch((err) => {
						if (state.currentPath === normalized) {
							state.currentPath = previousPath;
						}
						throw err;
					});
				}
				return result;
			} catch (err) {
				if (state.currentPath === normalized) {
					state.currentPath = previousPath;
				}
				throw err;
			}
		}
	};
}

export const workspace = createWorkspaceStore();
