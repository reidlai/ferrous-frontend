import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$app/navigation', () => ({
	goto: vi.fn().mockResolvedValue(undefined)
}));

import { goto } from '$app/navigation';
import Menubar from './Menubar.svelte';
import StudioShell from './StudioShell.svelte';
import RadarPage from '../../routes/radar/+page.svelte';
import AnalyticsPage from '../../routes/analytics/+page.svelte';
import SimulatorPage from '../../routes/simulator/+page.svelte';
import BenchmarksPage from '../../routes/benchmarks/+page.svelte';
import PipelinePerformancePage from '../../routes/pipeline-performance/+page.svelte';
import { createSessionStore, session } from '$lib/stores/session.svelte';
import { createWorkspaceStore, REPLAY_QUICKSTART_URL, workspace } from '$lib/stores/workspace.svelte';

describe('Menubar', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		session.setRememberMe(false);
		session.logout();
		workspace.setCurrentPath('/investigation');
	});

	it('renders all 7 menubar items, pills, tenant selector, operator badge, and sign out', () => {
		const sessionStore = createSessionStore();
		sessionStore.login({
			token: 'jwt-test',
			username: 'carlos.support',
			role: 'customer_specialist'
		});
		const workspaceStore = createWorkspaceStore();

		render(Menubar, { props: { sessionStore, workspaceStore } });

		const menubar = screen.getByRole('menubar', { name: /application menu bar/i });
		expect(menubar).toBeInTheDocument();

		expect(screen.getByRole('menuitem', { name: /^ferrouscx$/i })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: /^workspaces$/i })).toBeInTheDocument();

		const benchmarksBtn = screen.getByRole('menuitem', { name: /llm benchmarks/i });
		expect(benchmarksBtn).toBeInTheDocument();
		expect(benchmarksBtn).toHaveTextContent('⚡ 182ms TTFT');
		expect(benchmarksBtn.querySelector('svg.text-purple-400')).toBeInTheDocument();

		const pipelineBtn = screen.getByRole('menuitem', { name: /pipeline performance/i });
		expect(pipelineBtn).toBeInTheDocument();
		expect(pipelineBtn).toHaveTextContent('⚡ 0.4ms WAL');
		expect(pipelineBtn.querySelector('svg.text-blue-400')).toBeInTheDocument();

		expect(screen.getByRole('menuitem', { name: /^replay$/i })).toBeInTheDocument();
		expect(screen.getByRole('menuitem', { name: /^diagnostics$/i })).toBeInTheDocument();

		const tenantSelect = screen.getByLabelText(/tenant/i) as HTMLSelectElement;
		expect(tenantSelect.value).toBe('SP-01');
		expect(Array.from(tenantSelect.options).map((o) => o.value)).toEqual([
			'SP-01',
			'RJ-01',
			'MG-01'
		]);

		expect(screen.getByTestId('operator-username')).toHaveTextContent('carlos.support');
		expect(screen.getByRole('button', { name: /sign out/i })).toBeInTheDocument();
	});

	it('includes custom session tenant like ferrous-br in tenant selector', () => {
		const sessionStore = createSessionStore();
		sessionStore.login({
			token: 'jwt-test',
			username: 'carlos.support',
			tenant: 'ferrous-br'
		});
		const workspaceStore = createWorkspaceStore();

		render(Menubar, { props: { sessionStore, workspaceStore } });

		const tenantSelect = screen.getByLabelText(/tenant/i) as HTMLSelectElement;
		expect(Array.from(tenantSelect.options).map((o) => o.value)).toContain('ferrous-br');
		expect(tenantSelect.value).toBe('ferrous-br');
	});

	it('opens Replay popover with read-only status, ferrous-cx quickstart link, and zero playback controls', async () => {
		const sessionStore = createSessionStore();
		sessionStore.login({ token: 'jwt-test', username: 'carlos.support' });
		const workspaceStore = createWorkspaceStore();

		render(Menubar, { props: { sessionStore, workspaceStore } });

		await fireEvent.click(screen.getByRole('menuitem', { name: /^replay$/i }));

		const replayRegion = screen.getByRole('region', { name: /replay status/i });
		expect(replayRegion).toHaveTextContent('olist/orders_stream');
		expect(replayRegion).toHaveTextContent('24.8 msgs/s');
		expect(replayRegion).toHaveTextContent(workspaceStore.replayStatus.mode);

		const quickstartLink = screen.getByRole('link', { name: /ferrous-cx/i });
		expect(quickstartLink).toHaveAttribute('href', REPLAY_QUICKSTART_URL);
		expect(quickstartLink).toHaveAttribute('target', '_blank');

		// Strictly no playback controls inside Replay popover.
		expect(replayRegion.querySelectorAll('button')).toHaveLength(0);
		expect(screen.queryByRole('button', { name: /play|pause|speed|burst/i })).not.toBeInTheDocument();
	});

	it('opens Workspaces and Diagnostics popovers and closes on Escape, outside click, tenant click, or empty header space', async () => {
		const sessionStore = createSessionStore();
		sessionStore.login({ token: 'jwt-test', username: 'carlos.support' });
		const workspaceStore = createWorkspaceStore();
		const onNavigate = vi.fn();

		render(Menubar, { props: { sessionStore, workspaceStore, onNavigate } });

		const workspacesTrigger = screen.getByRole('menuitem', { name: /^workspaces$/i });
		await fireEvent.click(workspacesTrigger);
		const workspacesMenu = screen.getByRole('menu', { name: /workspaces/i });
		expect(workspacesMenu).toHaveTextContent('/investigation');
		expect(workspacesMenu).toHaveTextContent('/radar');
		expect(workspacesMenu).toHaveTextContent('/analytics');
		expect(workspacesMenu).toHaveTextContent('/simulator');

		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(screen.queryByRole('menu', { name: /workspaces/i })).not.toBeInTheDocument();
		expect(document.activeElement).toBe(workspacesTrigger);

		// Clicking Tenant <select> closes open Workspaces dropdown
		await fireEvent.click(workspacesTrigger);
		expect(screen.getByRole('menu', { name: /workspaces/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByLabelText(/tenant/i));
		expect(screen.queryByRole('menu', { name: /workspaces/i })).not.toBeInTheDocument();

		// Clicking empty header space closes open Workspaces dropdown
		await fireEvent.click(workspacesTrigger);
		expect(screen.getByRole('menu', { name: /workspaces/i })).toBeInTheDocument();
		await fireEvent.click(screen.getByTestId('app-menubar'));
		expect(screen.queryByRole('menu', { name: /workspaces/i })).not.toBeInTheDocument();

		await fireEvent.click(screen.getByRole('menuitem', { name: /^diagnostics$/i }));
		const diagnosticsRegion = screen.getByRole('region', { name: /diagnostics status/i });
		expect(diagnosticsRegion).toHaveTextContent(/ok \(200\)/i);
		expect(diagnosticsRegion).toHaveTextContent(/tracing active/i);

		await fireEvent.click(document.body);
		expect(screen.queryByRole('region', { name: /diagnostics status/i })).not.toBeInTheDocument();

		await fireEvent.click(workspacesTrigger);
		await fireEvent.click(screen.getByRole('menuitem', { name: /live ops radar/i }));
		expect(onNavigate).toHaveBeenCalledWith('/radar');
		expect(workspaceStore.currentPath).toBe('/radar');
	});

	it('navigates to /benchmarks and /pipeline-performance calling goto when onNavigate is omitted, and returns to /investigation on FerrousCX click', async () => {
		const sessionStore = createSessionStore();
		sessionStore.login({ token: 'jwt-test', username: 'carlos.support' });
		const workspaceStore = createWorkspaceStore('/investigation');

		render(StudioShell, { props: { sessionStore, workspaceStore } });

		expect(screen.getByTestId('screen-investigation')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('menuitem', { name: /llm benchmarks/i }));
		expect(workspaceStore.currentPath).toBe('/benchmarks');
		expect(goto).toHaveBeenCalledWith('/benchmarks');
		expect(screen.getByTestId('screen-benchmarks')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('menuitem', { name: /pipeline performance/i }));
		expect(workspaceStore.currentPath).toBe('/pipeline-performance');
		expect(goto).toHaveBeenCalledWith('/pipeline-performance');
		expect(screen.getByTestId('screen-pipeline-performance')).toBeInTheDocument();

		await fireEvent.click(screen.getByRole('menuitem', { name: /^ferrouscx$/i }));
		expect(workspaceStore.currentPath).toBe('/investigation');
		expect(goto).toHaveBeenCalledWith('/investigation');
		expect(screen.getByTestId('screen-investigation')).toBeInTheDocument();
	});

	it('navigates on Ctrl/Cmd+B and Ctrl/Cmd+P, and ignores Ctrl+Shift+B, Alt+B, inputs, and unauthenticated state', async () => {
		const sessionStore = createSessionStore();
		sessionStore.login({ token: 'jwt-test', username: 'carlos.support' });
		const workspaceStore = createWorkspaceStore('/investigation');

		render(StudioShell, { props: { sessionStore, workspaceStore } });

		// Ctrl+Shift+B should NOT navigate
		const ctrlShiftB = new KeyboardEvent('keydown', {
			key: 'b',
			ctrlKey: true,
			shiftKey: true,
			cancelable: true
		});
		window.dispatchEvent(ctrlShiftB);
		expect(ctrlShiftB.defaultPrevented).toBe(false);
		expect(workspaceStore.currentPath).toBe('/investigation');

		// Alt+B should NOT navigate
		const altB = new KeyboardEvent('keydown', {
			key: 'b',
			ctrlKey: true,
			altKey: true,
			cancelable: true
		});
		window.dispatchEvent(altB);
		expect(altB.defaultPrevented).toBe(false);
		expect(workspaceStore.currentPath).toBe('/investigation');

		// Ctrl+B inside an <input> should NOT navigate
		const input = document.createElement('input');
		document.body.appendChild(input);
		const inputCtrlB = new KeyboardEvent('keydown', {
			key: 'b',
			ctrlKey: true,
			bubbles: true,
			cancelable: true
		});
		input.dispatchEvent(inputCtrlB);
		expect(inputCtrlB.defaultPrevented).toBe(false);
		expect(workspaceStore.currentPath).toBe('/investigation');
		input.remove();

		// Ctrl+B and Meta+B navigate to /benchmarks
		const ctrlB = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true });
		window.dispatchEvent(ctrlB);
		expect(ctrlB.defaultPrevented).toBe(true);
		await vi.waitFor(() => {
			expect(workspaceStore.currentPath).toBe('/benchmarks');
			expect(screen.getByTestId('screen-benchmarks')).toBeInTheDocument();
		});

		workspaceStore.setCurrentPath('/investigation');
		const metaB = new KeyboardEvent('keydown', { key: 'B', metaKey: true, cancelable: true });
		window.dispatchEvent(metaB);
		expect(metaB.defaultPrevented).toBe(true);
		await vi.waitFor(() => {
			expect(workspaceStore.currentPath).toBe('/benchmarks');
		});

		// Ctrl+P and Meta+P navigate to /pipeline-performance
		workspaceStore.setCurrentPath('/investigation');
		const ctrlP = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true });
		window.dispatchEvent(ctrlP);
		expect(ctrlP.defaultPrevented).toBe(true);
		await vi.waitFor(() => {
			expect(workspaceStore.currentPath).toBe('/pipeline-performance');
			expect(screen.getByTestId('screen-pipeline-performance')).toBeInTheDocument();
		});

		workspaceStore.setCurrentPath('/investigation');
		const metaP = new KeyboardEvent('keydown', { key: 'P', metaKey: true, cancelable: true });
		window.dispatchEvent(metaP);
		expect(metaP.defaultPrevented).toBe(true);
		await vi.waitFor(() => {
			expect(workspaceStore.currentPath).toBe('/pipeline-performance');
		});

		// Unauthenticated state ignores shortcuts
		sessionStore.logout();
		workspaceStore.setCurrentPath('/investigation');
		const unauthCtrlB = new KeyboardEvent('keydown', { key: 'b', ctrlKey: true, cancelable: true });
		window.dispatchEvent(unauthCtrlB);
		expect(unauthCtrlB.defaultPrevented).toBe(false);
		expect(workspaceStore.currentPath).toBe('/investigation');
	});

	it('updates session tenant via tenant selector and signs out cleanly', async () => {
		const sessionStore = createSessionStore();
		sessionStore.login({ token: 'jwt-test', username: 'carlos.support' });
		const workspaceStore = createWorkspaceStore();

		render(Menubar, { props: { sessionStore, workspaceStore } });

		const tenantSelect = screen.getByLabelText(/tenant/i) as HTMLSelectElement;
		expect(tenantSelect.value).toBe('SP-01');

		await fireEvent.change(tenantSelect, { target: { value: 'RJ-01' } });
		expect(sessionStore.tenant).toBe('RJ-01');

		await fireEvent.click(screen.getByRole('button', { name: /sign out/i }));
		expect(sessionStore.authenticated).toBe(false);
	});

	it('renders /radar, /analytics, /simulator, /benchmarks, and /pipeline-performance routes cleanly', async () => {
		const routes = [
			{ Component: RadarPage, testId: 'screen-radar' },
			{ Component: AnalyticsPage, testId: 'screen-analytics' },
			{ Component: SimulatorPage, testId: 'screen-simulator' },
			{ Component: BenchmarksPage, testId: 'screen-benchmarks' },
			{ Component: PipelinePerformancePage, testId: 'screen-pipeline-performance' }
		];

		for (const { Component, testId } of routes) {
			session.logout();
			const { unmount } = render(Component);
			expect(screen.getByTestId('screen-login')).toBeInTheDocument();

			session.login({ token: 'jwt-route', username: 'carlos.support' });
			expect(await screen.findByTestId(testId)).toBeInTheDocument();
			unmount();
		}
	});
});
