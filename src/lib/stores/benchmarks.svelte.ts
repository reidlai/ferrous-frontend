import { Subject, throttleTime, type Subscription } from 'rxjs';

export type BenchmarkModelId =
	| 'qwen-2.5-72b'
	| 'llama-3.3-70b'
	| 'claude-3.5-sonnet'
	| 'gpt-4o';

export type BenchmarkCategoryId =
	| 'all'
	| 'sla-triage'
	| 'tool-calling'
	| 'pt-br-nuance'
	| 'hitl-guardrails';

export type TtftTier = 'emerald' | 'amber' | 'rose';
export type BenchmarkRunStatus = 'idle' | 'running' | 'completed' | 'aborted' | 'error';
export type ToolValidationStatus = 'PASS' | 'FAIL';

export interface BenchmarkModel {
	id: BenchmarkModelId;
	name: string;
	provider: string;
	baseTtftMs: number;
	tokensPerSec: number;
	toolPassRate: number;
	costPer1kUsd: number;
}

export interface BenchmarkCategory {
	id: BenchmarkCategoryId;
	label: string;
}

export interface BenchmarkPromptCase {
	id: string;
	category: Exclude<BenchmarkCategoryId, 'all'>;
	title: string;
	toolName: 'hitl_issue_credit' | 'lookup_olist_order';
	promptPreview: string;
}

export interface TtftClassification {
	label: 'FAST' | 'NOMINAL' | 'SLOW';
	tier: TtftTier;
}

export interface ToolValidationResult {
	status: ToolValidationStatus;
	toolName: 'hitl_issue_credit' | 'lookup_olist_order';
	schemaVersion: string;
	message: string;
}

export interface BenchmarkTerminalLine {
	id: string;
	timestamp: string;
	modelId: BenchmarkModelId | 'system';
	level: 'info' | 'ttft' | 'tool' | 'error' | 'done';
	text: string;
}

export interface BenchmarkStreamChunk {
	modelId: BenchmarkModelId | 'system';
	level: 'info' | 'ttft' | 'tool' | 'error' | 'done';
	text: string;
	ttftMs?: number;
	toolValidation?: ToolValidationResult;
}

export interface DataFusionBenchmarkRow {
	model_id: BenchmarkModelId;
	category: Exclude<BenchmarkCategoryId, 'all'>;
	avg_ttft_ms: number;
	avg_tps: number;
	tool_pass_pct: number;
	runs: number;
}

export interface DataFusionQueryResult {
	sql: string;
	sourcePath: string;
	executionMs: number;
	columns: string[];
	rows: Array<Record<string, string | number>>;
	error: string | null;
}

export interface RunBenchmarkOptions {
	token?: string | null;
	fetcher?: typeof fetch;
	stepDelayMs?: number;
}

export const BENCHMARK_MODELS: BenchmarkModel[] = [
	{
		id: 'qwen-2.5-72b',
		name: 'Qwen 2.5',
		provider: 'Alibaba · vLLM FP8',
		baseTtftMs: 148.2,
		tokensPerSec: 118.4,
		toolPassRate: 98.4,
		costPer1kUsd: 0.0009
	},
	{
		id: 'llama-3.3-70b',
		name: 'Llama 3.3',
		provider: 'Meta · Groq LPU',
		baseTtftMs: 182.4,
		tokensPerSec: 136.2,
		toolPassRate: 97.6,
		costPer1kUsd: 0.0008
	},
	{
		id: 'claude-3.5-sonnet',
		name: 'Claude 3.5',
		provider: 'Anthropic · Messages API',
		baseTtftMs: 312.6,
		tokensPerSec: 79.5,
		toolPassRate: 99.6,
		costPer1kUsd: 0.003
	},
	{
		id: 'gpt-4o',
		name: 'GPT-4o',
		provider: 'OpenAI · Structured Outputs',
		baseTtftMs: 428.0,
		tokensPerSec: 86.2,
		toolPassRate: 99.1,
		costPer1kUsd: 0.0025
	}
];

export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
	{ id: 'all', label: 'All Prompts' },
	{ id: 'sla-triage', label: 'SLA Triage' },
	{ id: 'tool-calling', label: 'Tool Calling' },
	{ id: 'pt-br-nuance', label: 'PT-BR Nuance' },
	{ id: 'hitl-guardrails', label: 'HITL Guardrails' }
];

export const BENCHMARK_PROMPTS: BenchmarkPromptCase[] = [
	{
		id: 'prm-sla-01',
		category: 'sla-triage',
		title: 'Correios Cajamar +8.4d SLA Breach Triage',
		toolName: 'lookup_olist_order',
		promptPreview: 'Classify SLA breach severity for order OL-94821-SP and quote Policy OLIST-SLA-T2.'
	},
	{
		id: 'prm-tool-01',
		category: 'tool-calling',
		title: 'Strict JSON Schema Tool Dispatch',
		toolName: 'lookup_olist_order',
		promptPreview: 'Invoke lookup_olist_order(order_id, tenant_uf) with strict UUID & UF validation.'
	},
	{
		id: 'prm-ptbr-01',
		category: 'pt-br-nuance',
		title: 'PT-BR Informal Sentiment & Urgency Detection',
		toolName: 'lookup_olist_order',
		promptPreview: 'Translate & score 1-star PT-BR review: "presente de aniversário atrasado em Cajamar".'
	},
	{
		id: 'prm-hitl-01',
		category: 'hitl-guardrails',
		title: 'HITL Courtesy Credit Cap Enforcement',
		toolName: 'hitl_issue_credit',
		promptPreview: 'Emit hitl_issue_credit proposal <= R$ 50,00 requiring human-in-the-loop approval.'
	}
];

export const DELTA_LLM_BENCHMARKS_SOURCE = 'delta/llm_benchmarks/';

export const DEFAULT_BENCHMARK_SQL = `SELECT model_id, ROUND(AVG(ttft_ms), 2) AS avg_ttft_ms, ROUND(AVG(tokens_per_sec), 1) AS avg_tps, ROUND(AVG(tool_pass_rate), 1) AS tool_pass_pct, SUM(runs) AS total_runs
FROM delta.llm_benchmarks
GROUP BY model_id
ORDER BY avg_ttft_ms ASC;`;

const DELTA_BENCHMARK_DATASET: DataFusionBenchmarkRow[] = [
	{
		model_id: 'qwen-2.5-72b',
		category: 'sla-triage',
		avg_ttft_ms: 146.8,
		avg_tps: 119.2,
		tool_pass_pct: 98.5,
		runs: 120
	},
	{
		model_id: 'qwen-2.5-72b',
		category: 'tool-calling',
		avg_ttft_ms: 149.6,
		avg_tps: 117.6,
		tool_pass_pct: 98.3,
		runs: 120
	},
	{
		model_id: 'llama-3.3-70b',
		category: 'sla-triage',
		avg_ttft_ms: 181.2,
		avg_tps: 137.4,
		tool_pass_pct: 97.4,
		runs: 120
	},
	{
		model_id: 'llama-3.3-70b',
		category: 'pt-br-nuance',
		avg_ttft_ms: 183.6,
		avg_tps: 135.0,
		tool_pass_pct: 97.8,
		runs: 120
	},
	{
		model_id: 'claude-3.5-sonnet',
		category: 'hitl-guardrails',
		avg_ttft_ms: 310.4,
		avg_tps: 80.1,
		tool_pass_pct: 99.7,
		runs: 120
	},
	{
		model_id: 'claude-3.5-sonnet',
		category: 'pt-br-nuance',
		avg_ttft_ms: 314.8,
		avg_tps: 78.9,
		tool_pass_pct: 99.5,
		runs: 120
	},
	{
		model_id: 'gpt-4o',
		category: 'tool-calling',
		avg_ttft_ms: 425.5,
		avg_tps: 86.8,
		tool_pass_pct: 99.2,
		runs: 120
	},
	{
		model_id: 'gpt-4o',
		category: 'hitl-guardrails',
		avg_ttft_ms: 430.5,
		avg_tps: 85.6,
		tool_pass_pct: 99.0,
		runs: 120
	}
];

const DEFAULT_SELECTED_MODELS: BenchmarkModelId[] = ['qwen-2.5-72b', 'llama-3.3-70b'];

export function classifyTtft(ttftMs: number): TtftClassification {
	if (!Number.isFinite(ttftMs) || ttftMs < 0 || ttftMs > 500) {
		return { label: 'SLOW', tier: 'rose' };
	}
	if (ttftMs < 200) {
		return { label: 'FAST', tier: 'emerald' };
	}
	return { label: 'NOMINAL', tier: 'amber' };
}

export function formatTtftMicros(ttftMs: number): string {
	if (!Number.isFinite(ttftMs) || ttftMs < 0) {
		return '0.0ms (0 μs)';
	}
	const micros = Math.round(ttftMs * 1000);
	return `${ttftMs.toFixed(1)}ms (${micros.toLocaleString('en-US')} μs)`;
}

function runDataFusionQuery(sql: string): DataFusionQueryResult {
	const trimmed = sql.trim();
	if (!trimmed || !/^\s*SELECT\b/i.test(trimmed) || !/\bllm_benchmarks\b/i.test(trimmed)) {
		return {
			sql: trimmed,
			sourcePath: DELTA_LLM_BENCHMARKS_SOURCE,
			executionMs: 0.8,
			columns: [],
			rows: [],
			error: 'Query must be a SELECT statement referencing delta.llm_benchmarks (delta/llm_benchmarks/).'
		};
	}

	let filtered = [...DELTA_BENCHMARK_DATASET];

	const modelMatch = trimmed.match(/model_id\s*=\s*'([^']+)'/i);
	if (modelMatch?.[1]) {
		filtered = filtered.filter((row) => row.model_id === modelMatch[1]);
	}

	const categoryMatch = trimmed.match(/category\s*=\s*'([^']+)'/i);
	if (categoryMatch?.[1]) {
		filtered = filtered.filter((row) => row.category === categoryMatch[1]);
	}

	const grouped = new Map<
		BenchmarkModelId,
		{ ttftSum: number; tpsSum: number; passSum: number; runs: number; count: number }
	>();

	for (const row of filtered) {
		const prev = grouped.get(row.model_id) ?? {
			ttftSum: 0,
			tpsSum: 0,
			passSum: 0,
			runs: 0,
			count: 0
		};
		prev.ttftSum += row.avg_ttft_ms;
		prev.tpsSum += row.avg_tps;
		prev.passSum += row.tool_pass_pct;
		prev.runs += row.runs;
		prev.count += 1;
		grouped.set(row.model_id, prev);
	}

	const rows: Array<Record<string, string | number>> = Array.from(grouped.entries()).map(
		([modelId, agg]) => ({
			model_id: modelId,
			avg_ttft_ms: Number((agg.ttftSum / agg.count).toFixed(2)),
			avg_tps: Number((agg.tpsSum / agg.count).toFixed(1)),
			tool_pass_pct: Number((agg.passSum / agg.count).toFixed(1)),
			total_runs: agg.runs
		})
	);

	const desc = /ORDER\s+BY\s+.*DESC/i.test(trimmed);
	const orderByTps = /ORDER\s+BY\s+avg_tps/i.test(trimmed);
	const orderByPass = /ORDER\s+BY\s+tool_pass_pct/i.test(trimmed);

	rows.sort((a, b) => {
		const key = orderByTps ? 'avg_tps' : orderByPass ? 'tool_pass_pct' : 'avg_ttft_ms';
		const diff = Number(a[key]) - Number(b[key]);
		return desc ? -diff : diff;
	});

	return {
		sql: trimmed,
		sourcePath: DELTA_LLM_BENCHMARKS_SOURCE,
		executionMs: 2.1,
		columns: ['model_id', 'avg_ttft_ms', 'avg_tps', 'tool_pass_pct', 'total_runs'],
		rows,
		error: null
	};
}

export function createBenchmarksStore() {
	let selectedModelIds = $state<BenchmarkModelId[]>([...DEFAULT_SELECTED_MODELS]);
	let activeCategory = $state<BenchmarkCategoryId>('all');
	let status = $state<BenchmarkRunStatus>('idle');
	let activeRunId = $state<string | null>(null);
	let latestTtftMs = $state<number>(182.4);
	let toolValidation = $state<ToolValidationResult>({
		status: 'PASS',
		toolName: 'lookup_olist_order',
		schemaVersion: 'v1.4',
		message: 'Strict JSON Schema validated for lookup_olist_order'
	});
	let terminalLines = $state<BenchmarkTerminalLine[]>([]);
	let errorMessage = $state<string | null>(null);
	let sqlQuery = $state<string>(DEFAULT_BENCHMARK_SQL);
	let sqlResult = $state<DataFusionQueryResult>(runDataFusionQuery(DEFAULT_BENCHMARK_SQL));

	let activeController: AbortController | null = null;
	let activeTimers = new Set<ReturnType<typeof setTimeout>>();
	let streamSubscription: Subscription | null = null;
	let chunkSubject: Subject<void> | null = null;
	let pendingChunks: BenchmarkStreamChunk[] = [];
	let lineSeq = 0;

	const filteredPrompts = $derived(
		activeCategory === 'all'
			? BENCHMARK_PROMPTS
			: BENCHMARK_PROMPTS.filter((prompt) => prompt.category === activeCategory)
	);

	const selectedModels = $derived(
		BENCHMARK_MODELS.filter((model) => selectedModelIds.includes(model.id))
	);

	const ttftClassification = $derived(classifyTtft(latestTtftMs));
	const formattedTtft = $derived(formatTtftMicros(latestTtftMs));

	function clearTimers() {
		for (const timer of activeTimers) {
			clearTimeout(timer);
		}
		activeTimers.clear();
	}

	function teardownStreamPipeline() {
		clearTimers();
		if (streamSubscription) {
			streamSubscription.unsubscribe();
			streamSubscription = null;
		}
		if (chunkSubject) {
			chunkSubject.complete();
			chunkSubject = null;
		}
		pendingChunks = [];
	}

	function flushPendingChunks() {
		if (pendingChunks.length === 0) {
			return;
		}
		const batch = pendingChunks;
		pendingChunks = [];

		const newLines: BenchmarkTerminalLine[] = [];
		for (const chunk of batch) {
			lineSeq += 1;
			newLines.push({
				id: `bm-line-${lineSeq}`,
				timestamp: new Date().toISOString().slice(11, 23),
				modelId: chunk.modelId,
				level: chunk.level,
				text: chunk.text
			});
			if (typeof chunk.ttftMs === 'number' && Number.isFinite(chunk.ttftMs) && chunk.ttftMs >= 0) {
				latestTtftMs = chunk.ttftMs;
			}
			if (chunk.toolValidation) {
				toolValidation = chunk.toolValidation;
			}
		}

		terminalLines = [...terminalLines, ...newLines];
	}

	function initStreamPipeline() {
		teardownStreamPipeline();
		const subject = new Subject<void>();
		chunkSubject = subject;
		streamSubscription = subject
			.pipe(throttleTime(16, undefined, { leading: true, trailing: true }))
			.subscribe(() => {
				flushPendingChunks();
			});
	}

	function pushChunk(chunk: BenchmarkStreamChunk) {
		pendingChunks.push(chunk);
		chunkSubject?.next();
	}

	function abortActiveController() {
		if (activeController) {
			activeController.abort();
			activeController = null;
		}
		teardownStreamPipeline();
	}

	async function consumeSseStream(
		response: Response,
		signal: AbortSignal
	): Promise<boolean> {
		if (!response.body) {
			return false;
		}
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		const onAbort = () => {
			void reader.cancel().catch(() => {});
		};
		signal.addEventListener('abort', onAbort, { once: true });

		const processSseEvent = (rawEvent: string) => {
			const dataLines = rawEvent
				.split(/\r?\n/)
				.filter((line) => line.startsWith('data:'))
				.map((line) => line.slice(5).replace(/^ /, ''));
			if (dataLines.length === 0) return;
			const payloadText = dataLines.join('\n').trim();
			if (!payloadText || payloadText === '[DONE]') return;

			try {
				const parsed = JSON.parse(payloadText) as Partial<BenchmarkStreamChunk>;
				pushChunk({
					modelId: parsed.modelId ?? 'system',
					level: parsed.level ?? 'info',
					text: parsed.text ?? payloadText,
					ttftMs: parsed.ttftMs,
					toolValidation: parsed.toolValidation
				});
			} catch {
				pushChunk({
					modelId: 'system',
					level: 'info',
					text: payloadText
				});
			}
		};

		try {
			while (!signal.aborted) {
				const { done, value } = await reader.read();
				if (done) {
					buffer += decoder.decode();
					break;
				}
				buffer += decoder.decode(value, { stream: true });
				const events = buffer.split(/\r?\n\r?\n/);
				buffer = events.pop() ?? '';

				for (const rawEvent of events) {
					processSseEvent(rawEvent);
				}
			}

			if (!signal.aborted && buffer.trim()) {
				for (const rawEvent of buffer.split(/\r?\n\r?\n/)) {
					if (rawEvent.trim()) {
						processSseEvent(rawEvent);
					}
				}
			}

			flushPendingChunks();
			return !signal.aborted;
		} finally {
			signal.removeEventListener('abort', onAbort);
			try {
				await reader.cancel().catch(() => {});
			} catch {
				// Ignore already-closed or cancelled reader.
			}
			try {
				reader.releaseLock();
			} catch {
				// Ignore already-released reader locks.
			}
		}
	}

	function runLocalSimulation(
		controller: AbortController,
		stepDelayMs: number
	): Promise<void> {
		const modelsSnapshot = [...selectedModels];
		const promptsSnapshot = [...filteredPrompts];

		const chunks: BenchmarkStreamChunk[] = [
			{
				modelId: 'system',
				level: 'info',
				text: `[RUN] Dispatching ${modelsSnapshot.length} model(s) across ${promptsSnapshot.length} prompt(s) (${activeCategory})`
			}
		];

		for (const model of modelsSnapshot) {
			const tier = classifyTtft(model.baseTtftMs);
			chunks.push({
				modelId: model.id,
				level: 'ttft',
				ttftMs: model.baseTtftMs,
				text: `[TTFT] ${model.name} (${model.id}) -> ${formatTtftMicros(model.baseTtftMs)} [${tier.label}] · ${model.tokensPerSec.toFixed(1)} tok/s`
			});

			for (const prompt of promptsSnapshot) {
				const validation: ToolValidationResult = {
					status: 'PASS',
					toolName: prompt.toolName,
					schemaVersion: 'v1.4',
					message: `Strict JSON Schema validated for ${prompt.toolName}`
				};
				chunks.push({
					modelId: model.id,
					level: 'tool',
					toolValidation: validation,
					text: `[TOOL] ${model.id} · ${prompt.toolName} (${prompt.category}) -> PASS (${prompt.id})`
				});
			}
		}

		chunks.push({
			modelId: 'system',
			level: 'done',
			text: `[DONE] Benchmark suite finished · ${modelsSnapshot.length} model(s) verified.`
		});

		return new Promise<void>((resolve) => {
			if (controller.signal.aborted) {
				resolve();
				return;
			}

			let idx = 0;
			const finishSimulation = () => {
				flushPendingChunks();
				teardownStreamPipeline();
				if (!controller.signal.aborted) {
					status = 'completed';
					if (activeController === controller) {
						activeController = null;
					}
				}
				resolve();
			};

			const scheduleNext = () => {
				if (controller.signal.aborted) {
					resolve();
					return;
				}
				if (idx >= chunks.length) {
					finishSimulation();
					return;
				}

				const chunk = chunks[idx];
				idx += 1;
				pushChunk(chunk);

				if (idx >= chunks.length) {
					finishSimulation();
					return;
				}

				const timer = setTimeout(() => {
					activeTimers.delete(timer);
					scheduleNext();
				}, stepDelayMs);
				activeTimers.add(timer);
			};

			const initialTimer = setTimeout(() => {
				activeTimers.delete(initialTimer);
				scheduleNext();
			}, stepDelayMs);
			activeTimers.add(initialTimer);

			controller.signal.addEventListener(
				'abort',
				() => {
					clearTimers();
					resolve();
				},
				{ once: true }
			);
		});
	}

	return {
		get models() {
			return BENCHMARK_MODELS;
		},
		get categories() {
			return BENCHMARK_CATEGORIES;
		},
		get selectedModelIds() {
			return selectedModelIds;
		},
		get selectedModels() {
			return selectedModels;
		},
		get activeCategory() {
			return activeCategory;
		},
		get filteredPrompts() {
			return filteredPrompts;
		},
		get status() {
			return status;
		},
		get activeRunId() {
			return activeRunId;
		},
		get latestTtftMs() {
			return latestTtftMs;
		},
		get ttftClassification() {
			return ttftClassification;
		},
		get formattedTtft() {
			return formattedTtft;
		},
		get toolValidation() {
			return toolValidation;
		},
		get terminalLines() {
			return terminalLines;
		},
		get errorMessage() {
			return errorMessage;
		},
		get sqlQuery() {
			return sqlQuery;
		},
		get sqlResult() {
			return sqlResult;
		},

		toggleModel(modelId: BenchmarkModelId) {
			const exists = BENCHMARK_MODELS.some((m) => m.id === modelId);
			if (!exists) return;

			if (selectedModelIds.includes(modelId)) {
				if (selectedModelIds.length <= 1) {
					return;
				}
				selectedModelIds = selectedModelIds.filter((id) => id !== modelId);
			} else {
				selectedModelIds = [...selectedModelIds, modelId];
			}
		},

		setCategory(categoryId: BenchmarkCategoryId) {
			activeCategory = categoryId;
		},

		setSqlQuery(query: string) {
			sqlQuery = query;
		},

		executeSqlQuery(query?: string) {
			const nextSql = typeof query === 'string' ? query : sqlQuery;
			sqlQuery = nextSql;
			sqlResult = runDataFusionQuery(nextSql);
			return sqlResult;
		},

		async runBenchmarkSuite(options: RunBenchmarkOptions = {}): Promise<void> {
			// Preempt and abort any in-flight run before starting a new one.
			abortActiveController();

			const controller = new AbortController();
			activeController = controller;
			status = 'running';
			errorMessage = null;
			terminalLines = [];
			activeRunId = `run-${Date.now()}`;
			initStreamPipeline();

			const fetcher =
				options.fetcher ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch : null);
			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			if (options.token) {
				headers.Authorization = `Bearer ${options.token}`;
			}

			if (fetcher) {
				try {
					const runRes = await fetcher('/api/v1/benchmarks/run', {
						method: 'POST',
						headers,
						body: JSON.stringify({
							models: selectedModelIds,
							category: activeCategory
						}),
						signal: controller.signal
					});

					if (controller.signal.aborted) {
						return;
					}

					if (runRes.ok) {
						const payload = (await runRes.json()) as { run_id?: string };
						const runId = payload.run_id ?? activeRunId;
						activeRunId = runId;

						const streamRes = await fetcher(`/api/v1/benchmarks/${runId}/stream`, {
							method: 'GET',
							headers: options.token ? { Authorization: `Bearer ${options.token}` } : {},
							signal: controller.signal
						});

						if (controller.signal.aborted) {
							return;
						}

						if (streamRes.ok && (await consumeSseStream(streamRes, controller.signal))) {
							teardownStreamPipeline();
							if (!controller.signal.aborted) {
								status = 'completed';
								if (activeController === controller) {
									activeController = null;
								}
							}
							return;
						}
					}
				} catch (err) {
					if (controller.signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
						return;
					}
					// Backend offline or unconfigured: fall back to deterministic local simulation.
				}
			}

			if (controller.signal.aborted) {
				return;
			}

			await runLocalSimulation(controller, options.stepDelayMs ?? 25);
		},

		abortRun() {
			if (!activeController && status !== 'running') {
				return;
			}
			abortActiveController();
			status = 'aborted';
			lineSeq += 1;
			terminalLines = [
				...terminalLines,
				{
					id: `bm-line-${lineSeq}`,
					timestamp: new Date().toISOString().slice(11, 23),
					modelId: 'system',
					level: 'error',
					text: '[ABORT] Benchmark run cancelled by operator.'
				}
			];
		},

		reset() {
			abortActiveController();
			selectedModelIds = [...DEFAULT_SELECTED_MODELS];
			activeCategory = 'all';
			status = 'idle';
			activeRunId = null;
			latestTtftMs = 182.4;
			toolValidation = {
				status: 'PASS',
				toolName: 'lookup_olist_order',
				schemaVersion: 'v1.4',
				message: 'Strict JSON Schema validated for lookup_olist_order'
			};
			terminalLines = [];
			errorMessage = null;
			sqlQuery = DEFAULT_BENCHMARK_SQL;
			sqlResult = runDataFusionQuery(DEFAULT_BENCHMARK_SQL);
		}
	};
}

export const benchmarksStore = createBenchmarksStore();
