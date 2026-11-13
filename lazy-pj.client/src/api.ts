import {
    RequestStatus,
} from './types';
import type {
    AdminModel,
    AdminRequestModel,
    AuthSession,
    AuthUser,
    CreateRequestDTO,
    RequestStatusCode,
    UserModel,
} from './types';
import { translateErrorMessage } from './utils/validation';

const STORAGE_KEYS = {
    SESSION: 'lazypj_session_v1',
    USERS: 'lazypj_users_v1',
    ADMINS: 'lazypj_admins_v1',
    REQUESTS: 'lazypj_requests_v1',
};

const INITIAL_USERS: UserModel[] = [
    {
        id: 1,
        email: 'user@lazypj.ru',
        name: 'Алексей Смирнов',
        password: 'password123',
    },
    {
        id: 2,
        email: 'elena@lazypj.ru',
        name: 'Елена Волкова',
        password: 'password123',
    },
    {
        id: 3,
        email: 'dmitry@lazypj.ru',
        name: 'Дмитрий Соколов',
        password: 'password123',
    },
];

const INITIAL_ADMINS: AdminModel[] = [
    {
        id: 100,
        email: 'admin@lazypj.ru',
        name: 'Главный Администратор',
        password: 'adminpassword',
    },
];

const INITIAL_REQUESTS: AdminRequestModel[] = [
    {
        id: 101,
        userId: 1,
        userEmail: 'user@lazypj.ru',
        description: 'Запрос на предоставление доступа к корпоративному репозиторию и тестовому контуру проекта.',
        creationTime: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        approved: RequestStatus.Approve,
    },
    {
        id: 102,
        userId: 1,
        userEmail: 'user@lazypj.ru',
        description: 'Заявка на выпуск нового SSL-сертификата для внутреннего микросервиса авторизации.',
        creationTime: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
        approved: RequestStatus.Pending,
    },
    {
        id: 103,
        userId: 2,
        userEmail: 'elena@lazypj.ru',
        description: 'Согласование бюджета на облачную инфраструктуру и выделение GPU-узлов для аналитики.',
        creationTime: new Date(Date.now() - 1000 * 60 * 60 * 42).toISOString(),
        approved: RequestStatus.Denied,
    },
    {
        id: 104,
        userId: 3,
        userEmail: 'dmitry@lazypj.ru',
        description: 'Подключение двухфакторной аутентификации и обновление прав доступа для отдела разработки.',
        creationTime: new Date(Date.now() - 1000 * 60 * 50).toISOString(),
        approved: RequestStatus.Pending,
    },
];

function isJsonResponse(response: Response): boolean {
    const contentType = response.headers.get('content-type') || '';
    return contentType.toLowerCase().includes('application/json');
}

function normalizeStatus(raw: unknown): RequestStatusCode {
    if (raw === RequestStatus.Approve || raw === 1 || raw === '1' || raw === 'Approve' || raw === 'Approved') {
        return RequestStatus.Approve;
    }
    if (raw === RequestStatus.Denied || raw === 2 || raw === '2' || raw === 'Denied' || raw === 'Deny') {
        return RequestStatus.Denied;
    }
    return RequestStatus.Pending;
}

function normalizeUser(raw: unknown, fallbackId = 1): UserModel {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = Number(obj.id ?? obj.Id ?? fallbackId);
    const email = String(obj.email ?? obj.Email ?? 'user@lazypj.ru');
    const name = String(obj.name ?? obj.Name ?? (email.split('@')[0] || 'Пользователь'));
    const password = obj.password ?? obj.Password;
    return {
        id: Number.isFinite(id) && id > 0 ? id : fallbackId,
        email,
        name,
        password: typeof password === 'string' ? password : 'password123',
    };
}

function normalizeAdmin(raw: unknown, fallbackId = 100): AdminModel {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = Number(obj.id ?? obj.Id ?? fallbackId);
    const email = String(obj.email ?? obj.Email ?? 'admin@lazypj.ru');
    const name = String(obj.name ?? obj.Name ?? (email.split('@')[0] || 'Администратор'));
    const password = obj.password ?? obj.Password;
    return {
        id: Number.isFinite(id) && id > 0 ? id : fallbackId,
        email,
        name,
        password: typeof password === 'string' ? password : 'adminpassword',
    };
}

function normalizeRequest(raw: unknown, fallbackId = 101): AdminRequestModel {
    const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const id = Number(obj.id ?? obj.Id ?? fallbackId);
    const userId = Number(obj.userId ?? obj.UserId ?? 1);
    const userEmail = String(obj.userEmail ?? obj.UserEmail ?? 'user@lazypj.ru');
    const description = String(obj.description ?? obj.Description ?? 'Заявка без описания');
    const rawTime = obj.creationTime ?? obj.CreationTime;
    let creationTime = new Date().toISOString();
    if (typeof rawTime === 'string' && rawTime.trim()) {
        const parsed = new Date(rawTime);
        if (!Number.isNaN(parsed.getTime())) {
            creationTime = parsed.toISOString();
        }
    }
    const approved = normalizeStatus(obj.approved ?? obj.Approved);
    return {
        id: Number.isFinite(id) && id > 0 ? id : fallbackId,
        userId: Number.isFinite(userId) && userId > 0 ? userId : 1,
        userEmail: userEmail || 'user@lazypj.ru',
        description: description || 'Заявка без описания',
        creationTime,
        approved,
    };
}

function getStoredUsers(): UserModel[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.USERS);
        if (!raw) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
            return [...INITIAL_USERS];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(INITIAL_USERS));
            return [...INITIAL_USERS];
        }
        return parsed.map((item, idx) => normalizeUser(item, idx + 1));
    } catch {
        return [...INITIAL_USERS];
    }
}

function saveStoredUsers(users: UserModel[]) {
    try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch {
        return;
    }
}

function getStoredAdmins(): AdminModel[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.ADMINS);
        if (!raw) {
            localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(INITIAL_ADMINS));
            return [...INITIAL_ADMINS];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(INITIAL_ADMINS));
            return [...INITIAL_ADMINS];
        }
        return parsed.map((item, idx) => normalizeAdmin(item, 100 + idx));
    } catch {
        return [...INITIAL_ADMINS];
    }
}

function saveStoredAdmins(admins: AdminModel[]) {
    try {
        localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(admins));
    } catch {
        return;
    }
}

function getStoredRequests(): AdminRequestModel[] {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.REQUESTS);
        if (!raw) {
            localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(INITIAL_REQUESTS));
            return [...INITIAL_REQUESTS];
        }
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || parsed.length === 0) {
            localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(INITIAL_REQUESTS));
            return [...INITIAL_REQUESTS];
        }
        return parsed.map((item, idx) => normalizeRequest(item, 101 + idx));
    } catch {
        return [...INITIAL_REQUESTS];
    }
}

function saveStoredRequests(requests: AdminRequestModel[]) {
    try {
        localStorage.setItem(STORAGE_KEYS.REQUESTS, JSON.stringify(requests));
    } catch {
        return;
    }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
    try {
        const parts = token.split('.');
        if (parts.length < 2) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const json = decodeURIComponent(
            atob(base64)
                .split('')
                .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(json);
    } catch {
        return null;
    }
}

function buildFakeJwt(user: AuthUser): string {
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(
        encodeURIComponent(
            JSON.stringify({
                sub: String(user.id),
                email: user.email,
                role: user.role,
                exp: Math.floor(Date.now() / 1000) + 7200,
            })
        )
    );
    return `${header}.${payload}.lazypj-signature`;
}

export const api = {
    getSession(): AuthSession | null {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
            if (!raw) return null;
            const parsed = JSON.parse(raw) as AuthSession;
            if (!parsed || !parsed.user || typeof parsed.user.email !== 'string') {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    },

    saveSession(session: AuthSession | null) {
        if (!session) {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
        } else {
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
        }
    },

    resetDemoData(): {
        requests: AdminRequestModel[];
        users: UserModel[];
        admins: AdminModel[];
    } {
        saveStoredUsers(INITIAL_USERS);
        saveStoredAdmins(INITIAL_ADMINS);
        saveStoredRequests(INITIAL_REQUESTS);
        return {
            requests: [...INITIAL_REQUESTS],
            users: [...INITIAL_USERS],
            admins: [...INITIAL_ADMINS],
        };
    },

    async checkAccountExistsInDb(email: string, password: string): Promise<boolean> {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 0,
                    email: email.trim(),
                    name: '',
                    password,
                }),
            });

            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                return Boolean(data?.token);
            }
            return false;
        } catch {
            return false;
        }
    },

    async login(email: string, password: string): Promise<AuthSession> {
        const cleanEmail = email.trim().toLowerCase();

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 0,
                    email: cleanEmail,
                    name: '',
                    password,
                }),
            });

            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                const token: string = data.token;
                const claims = decodeJwtPayload(token);

                const roleClaim =
                    (claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] as string) ||
                    (claims?.['role'] as string) ||
                    'User';
                const idClaim =
                    Number(
                        claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ??
                            claims?.['sub'] ??
                            1
                    ) || 1;

                const users = getStoredUsers();
                const admins = getStoredAdmins();
                const localMatch =
                    roleClaim === 'Admin'
                        ? admins.find((a) => a.email.toLowerCase() === cleanEmail)
                        : users.find((u) => u.email.toLowerCase() === cleanEmail);

                const authUser: AuthUser = {
                    id: localMatch?.id ?? idClaim,
                    email: cleanEmail,
                    name: localMatch?.name ?? cleanEmail.split('@')[0],
                    role: roleClaim === 'Admin' ? 'Admin' : 'User',
                    password,
                };

                const session: AuthSession = { token, user: authUser };
                this.saveSession(session);
                return session;
            }
        } catch {
            void 0;
        }

        const admins = getStoredAdmins();
        const matchedAdmin = admins.find(
            (a) => a.email.toLowerCase() === cleanEmail && (a.password === password || !a.password)
        );

        if (matchedAdmin) {
            const user: AuthUser = {
                id: matchedAdmin.id,
                email: matchedAdmin.email,
                name: matchedAdmin.name,
                role: 'Admin',
                password,
            };
            const session: AuthSession = { token: buildFakeJwt(user), user };
            this.saveSession(session);
            return session;
        }

        const users = getStoredUsers();
        const matchedUser = users.find(
            (u) => u.email.toLowerCase() === cleanEmail && (u.password === password || !u.password)
        );

        if (matchedUser) {
            const user: AuthUser = {
                id: matchedUser.id,
                email: matchedUser.email,
                name: matchedUser.name,
                role: 'User',
                password,
            };
            const session: AuthSession = { token: buildFakeJwt(user), user };
            this.saveSession(session);
            return session;
        }

        throw new Error('Неверный Email или пароль. Попробуйте демо-аккаунт ниже или зарегистрируйтесь.');
    },

    async register(name: string, email: string, password: string): Promise<AuthSession> {
        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim() || cleanEmail.split('@')[0];

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id: 0,
                    email: cleanEmail,
                    name: cleanName,
                    password,
                }),
            });

            if (!response.ok && response.status === 400) {
                const errText = await response.text();
                if (errText.toLowerCase().includes('exist')) {
                    throw new Error('Пользователь с таким Email уже существует.');
                }
            }
        } catch (err) {
            if (err instanceof Error && err.message.includes('существует')) {
                throw err;
            }
        }

        const users = getStoredUsers();
        const admins = getStoredAdmins();

        if (
            users.some((u) => u.email.toLowerCase() === cleanEmail) ||
            admins.some((a) => a.email.toLowerCase() === cleanEmail)
        ) {
            throw new Error('Пользователь с таким Email уже зарегистрирован.');
        }

        const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
        const newUser: UserModel = {
            id: nextId,
            email: cleanEmail,
            name: cleanName,
            password,
        };

        users.push(newUser);
        saveStoredUsers(users);

        return this.login(cleanEmail, password);
    },

    async editUser(updated: UserModel): Promise<UserModel> {
        const session = this.getSession();
        try {
            const response = await fetch('/api/auth/edit', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
                body: JSON.stringify(updated),
            });

            if (response.ok && isJsonResponse(response)) {
                const serverUser = normalizeUser(await response.json(), updated.id);
                this.syncLocalUserUpdate(serverUser);
                return serverUser;
            }
        } catch {
            void 0;
        }

        this.syncLocalUserUpdate(updated);
        return updated;
    },

    syncLocalUserUpdate(updated: UserModel) {
        const users = getStoredUsers();
        const idx = users.findIndex((u) => u.id === updated.id);
        if (idx !== -1) {
            users[idx] = { ...users[idx], ...updated };
            saveStoredUsers(users);
        }

        const admins = getStoredAdmins();
        const adminIdx = admins.findIndex((a) => a.id === updated.id);
        if (adminIdx !== -1) {
            admins[adminIdx] = { ...admins[adminIdx], ...updated };
            saveStoredAdmins(admins);
        }

        const requests = getStoredRequests();
        let changed = false;
        requests.forEach((r) => {
            if (r.userId === updated.id) {
                r.userEmail = updated.email;
                changed = true;
            }
        });
        if (changed) {
            saveStoredRequests(requests);
        }

        const session = this.getSession();
        if (session && session.user.id === updated.id) {
            session.user = {
                ...session.user,
                email: updated.email,
                name: updated.name,
                password: updated.password || session.user.password,
            };
            this.saveSession(session);
        }
    },

    async deleteAccount(id: number): Promise<void> {
        const session = this.getSession();
        try {
            await fetch(`/api/auth/delete/${id}`, {
                method: 'DELETE',
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
        } catch {
            void 0;
        }

        const users = getStoredUsers().filter((u) => u.id !== id);
        saveStoredUsers(users);

        const requests = getStoredRequests().filter((r) => r.userId !== id);
        saveStoredRequests(requests);

        if (session?.user.id === id) {
            this.saveSession(null);
        }
    },

    async checkRoleById(id: number): Promise<string> {
        const session = this.getSession();
        try {
            const response = await fetch(`/api/admin/role/${id}`, {
                method: 'GET',
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                if (typeof data === 'string' && data.trim()) {
                    return data;
                }
            }
        } catch {
            void 0;
        }

        const admins = getStoredAdmins();
        const foundAdmin = admins.find((a) => a.id === id);
        if (foundAdmin) {
            return `Пользователь с ID ${id} (${foundAdmin.name}) является администратором`;
        }

        const users = getStoredUsers();
        const foundUser = users.find((u) => u.id === id);
        if (foundUser) {
            return `Пользователь с ID ${id} (${foundUser.name}) не является администратором (Роль: Пользователь)`;
        }

        throw new Error(`Пользователь с ID ${id} не найден в базе данных.`);
    },

    async createRequest(dto: CreateRequestDTO): Promise<AdminRequestModel> {
        const session = this.getSession();
        const users = getStoredUsers();
        const sender =
            users.find((u) => u.id === dto.userId) ||
            (session?.user.id === dto.userId
                ? { id: session.user.id, email: session.user.email, name: session.user.name }
                : undefined);

        try {
            const response = await fetch('/api/request', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
                body: JSON.stringify(dto),
            });

            if (response.ok && isJsonResponse(response)) {
                const created = normalizeRequest(await response.json());
                const requests = getStoredRequests();
                requests.unshift(created);
                saveStoredRequests(requests);
                return created;
            }
        } catch {
            void 0;
        }

        const requests = getStoredRequests();
        const nextId = requests.reduce((max, r) => Math.max(max, r.id), 100) + 1;
        const newRequest: AdminRequestModel = {
            id: nextId,
            userId: dto.userId,
            userEmail: sender?.email || session?.user.email || 'user@lazypj.ru',
            description: dto.description.trim(),
            creationTime: new Date().toISOString(),
            approved: RequestStatus.Pending,
        };

        requests.unshift(newRequest);
        saveStoredRequests(requests);
        return newRequest;
    },

    async getAllRequests(): Promise<AdminRequestModel[]> {
        const localRequests = getStoredRequests();
        const session = this.getSession();
        try {
            const response = await fetch('/api/request', {
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const normalized = data.map((item, idx) => normalizeRequest(item, 101 + idx));
                    const mergedMap = new Map<number, AdminRequestModel>();
                    normalized.forEach((r) => mergedMap.set(r.id, r));
                    localRequests.forEach((r) => {
                        if (!mergedMap.has(r.id)) {
                            mergedMap.set(r.id, r);
                        }
                    });
                    const merged = Array.from(mergedMap.values()).sort(
                        (a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
                    );
                    saveStoredRequests(merged);
                    return merged;
                }
            }
        } catch {
            void 0;
        }

        return [...localRequests].sort(
            (a, b) => new Date(b.creationTime).getTime() - new Date(a.creationTime).getTime()
        );
    },

    async acceptRequest(id: number): Promise<AdminRequestModel> {
        const session = this.getSession();
        try {
            const response = await fetch(`/api/request/${id}/accept`, {
                method: 'POST',
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
            if (response.ok && isJsonResponse(response)) {
                await response.json();
            }
        } catch {
            void 0;
        }

        return this.setRequestStatus(id, RequestStatus.Approve);
    },

    async denyRequest(id: number): Promise<AdminRequestModel> {
        const session = this.getSession();
        try {
            const response = await fetch(`/api/request/${id}/Deny`, {
                method: 'POST',
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
            if (response.ok && isJsonResponse(response)) {
                await response.json();
            }
        } catch {
            void 0;
        }

        return this.setRequestStatus(id, RequestStatus.Denied);
    },

    async setRequestStatus(id: number, status: RequestStatusCode): Promise<AdminRequestModel> {
        const requests = getStoredRequests();
        const target = requests.find((r) => r.id === id);
        if (!target) {
            throw new Error(translateErrorMessage(`Заявка #${id} не найдена.`));
        }
        target.approved = status;
        saveStoredRequests(requests);
        return { ...target };
    },

    async getAllUsers(): Promise<UserModel[]> {
        const localUsers = getStoredUsers();
        const session = this.getSession();
        try {
            const response = await fetch('/api/admin/users', {
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const normalized = data.map((item, idx) => normalizeUser(item, idx + 1));
                    saveStoredUsers(normalized);
                    return normalized;
                }
            }
        } catch {
            void 0;
        }
        return localUsers;
    },

    async getAllAdmins(): Promise<AdminModel[]> {
        const localAdmins = getStoredAdmins();
        const session = this.getSession();
        try {
            const response = await fetch('/api/admin/admins', {
                headers: {
                    ...(session?.token ? { Authorization: `Bearer ${session.token}` } : {}),
                },
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                if (Array.isArray(data) && data.length > 0) {
                    const normalized = data.map((item, idx) => normalizeAdmin(item, 100 + idx));
                    saveStoredAdmins(normalized);
                    return normalized;
                }
            }
        } catch {
            void 0;
        }
        return localAdmins;
    },
};
