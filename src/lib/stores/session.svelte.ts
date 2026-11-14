export const REMEMBERED_USERNAME_KEY = 'ferrouscx.remembered_username';

export interface SessionState {
	authenticated: boolean;
	token: string | null;
	username: string;
	role: string | null;
	tenant: string | null;
	rememberMe: boolean;
}

export interface LoginSessionPayload {
	token: string;
	username: string;
	role?: string | null;
	tenant?: string | null;
	rememberMe?: boolean;
}

function getLocalStorage(): Storage | null {
	if (typeof window === 'undefined') {
		return null;
	}
	try {
		return window.localStorage ?? null;
	} catch {
		return null;
	}
}

function readRememberedUsername(): string {
	const storage = getLocalStorage();
	if (!storage) {
		return '';
	}
	try {
		return storage.getItem(REMEMBERED_USERNAME_KEY)?.trim() ?? '';
	} catch {
		return '';
	}
}

function writeRememberedUsername(username: string | null): void {
	const storage = getLocalStorage();
	if (!storage) {
		return;
	}
	try {
		if (username) {
			storage.setItem(REMEMBERED_USERNAME_KEY, username);
		} else {
			storage.removeItem(REMEMBERED_USERNAME_KEY);
		}
	} catch {
		// Ignore storage quota or privacy-mode errors.
	}
}

export function createSessionStore() {
	const initialRemembered = readRememberedUsername();

	let state = $state<SessionState>({
		authenticated: false,
		token: null,
		username: initialRemembered,
		role: null,
		tenant: null,
		rememberMe: initialRemembered.length > 0
	});

	return {
		get authenticated() {
			return state.authenticated;
		},
		get token() {
			return state.token;
		},
		get username() {
			return state.username;
		},
		get role() {
			return state.role;
		},
		get tenant() {
			return state.tenant;
		},
		get rememberMe() {
			return state.rememberMe;
		},

		setRememberMe(value: boolean) {
			state.rememberMe = value;
			if (!value) {
				writeRememberedUsername(null);
			}
		},

		login(payload: LoginSessionPayload) {
			const shouldRemember = payload.rememberMe ?? state.rememberMe;
			state.authenticated = true;
			state.token = payload.token;
			state.username = payload.username;
			state.role = payload.role ?? null;
			state.tenant = payload.tenant ?? null;
			state.rememberMe = shouldRemember;

			// Only persist the operator username when rememberMe is enabled; JWT stays in memory only.
			writeRememberedUsername(shouldRemember ? payload.username : null);
		},

		logout() {
			state.authenticated = false;
			state.token = null;
			state.role = null;
			state.tenant = null;
			if (!state.rememberMe) {
				state.username = '';
				writeRememberedUsername(null);
			}
		}
	};
}

export const session = createSessionStore();
