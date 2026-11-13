const STORAGE_KEYS = {
    SESSION: 'lazypj_session_v1',
    USERS: 'lazypj_users_v1',
    ADMINS: 'lazypj_admins_v1',
};

const INITIAL_USERS = [
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

const INITIAL_ADMINS = [
    {
        id: 100,
        email: 'admin@lazypj.ru',
        name: 'Главный Администратор',
        password: 'adminpassword',
    },
];

function isJsonResponse(response) {
    const contentType = response.headers.get('content-type') || '';
    return contentType.toLowerCase().includes('application/json');
}

function toNumber(raw, fallback) {
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
}

function normalizeUser(raw, fallbackId = 1) {
    const obj = raw && typeof raw === 'object' ? raw : {};
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

function normalizeAdmin(raw, fallbackId = 100) {
    const obj = raw && typeof raw === 'object' ? raw : {};
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

function normalizeBody(raw) {
    const obj = raw && typeof raw === 'object' ? raw : {};
    return {
        mass: toNumber(obj.mass ?? obj.Mass, 1),
        positionX: toNumber(obj.positionX ?? obj.PositionX, 0),
        positionY: toNumber(obj.positionY ?? obj.PositionY, 0),
        velocityX: toNumber(obj.velocityX ?? obj.VelocityX, 0),
        velocityY: toNumber(obj.velocityY ?? obj.VelocityY, 0),
    };
}

function normalizePresetListItem(raw) {
    const obj = raw && typeof raw === 'object' ? raw : {};
    const description = obj.description ?? obj.Description;
    const outcome = obj.outcome ?? obj.Outcome;
    const previewUrl = obj.previewUrl ?? obj.PreviewUrl;
    return {
        id: toNumber(obj.id ?? obj.Id, 0),
        title: String(obj.title ?? obj.Title ?? 'Без названия'),
        description: typeof description === 'string' ? description : null,
        outcome: typeof outcome === 'string' ? outcome : null,
        previewUrl: typeof previewUrl === 'string' ? previewUrl : null,
        authorName: String(obj.authorName ?? obj.AuthorName ?? 'unknown'),
        createdAt: String(obj.createdAt ?? obj.CreatedAt ?? new Date().toISOString()),
        canEdit: Boolean(obj.canEdit ?? obj.CanEdit),
    };
}

function normalizePresetDetail(raw) {
    const obj = raw && typeof raw === 'object' ? raw : {};
    const rawBodies = obj.bodies ?? obj.Bodies;
    const description = obj.description ?? obj.Description;
    const outcome = obj.outcome ?? obj.Outcome;
    const dt = toNumber(obj.dt ?? obj.Dt, 0.001);
    return {
        id: toNumber(obj.id ?? obj.Id, 0),
        title: String(obj.title ?? obj.Title ?? 'Без названия'),
        description: typeof description === 'string' ? description : null,
        bodies: Array.isArray(rawBodies) ? rawBodies.map(normalizeBody) : [],
        g: toNumber(obj.g ?? obj.G, 1),
        softening: Math.max(0, toNumber(obj.softening ?? obj.Softening, 0.01)),
        dt: dt > 0 ? dt : 0.001,
        outcome: typeof outcome === 'string' ? outcome : null,
        authorName: String(obj.authorName ?? obj.AuthorName ?? 'unknown'),
        authorId: toNumber(obj.authorId ?? obj.AuthorId, 0),
        canEdit: Boolean(obj.canEdit ?? obj.CanEdit),
    };
}

function getStoredUsers() {
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

function saveStoredUsers(users) {
    try {
        localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    } catch {
        return;
    }
}

function getStoredAdmins() {
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

function saveStoredAdmins(admins) {
    try {
        localStorage.setItem(STORAGE_KEYS.ADMINS, JSON.stringify(admins));
    } catch {
        return;
    }
}

function decodeJwtPayload(token) {
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

function buildFakeJwt(user) {
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

function authHeaders() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed?.token && !parsed.token.endsWith('.lazypj-signature')) {
            return { Authorization: `Bearer ${parsed.token}` };
        }
    } catch {
        return {};
    }
    return {};
}

export const api = {
    getSession() {
        try {
            const raw = localStorage.getItem(STORAGE_KEYS.SESSION);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            if (!parsed || !parsed.user || typeof parsed.user.email !== 'string') {
                return null;
            }
            return parsed;
        } catch {
            return null;
        }
    },

    saveSession(session) {
        if (!session) {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
        } else {
            localStorage.setItem(STORAGE_KEYS.SESSION, JSON.stringify(session));
        }
    },

    resetDemoData() {
        saveStoredUsers(INITIAL_USERS);
        saveStoredAdmins(INITIAL_ADMINS);
        return {
            users: [...INITIAL_USERS],
            admins: [...INITIAL_ADMINS],
        };
    },

    async checkAccountExistsInDb(email, password) {
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

    async login(email, password) {
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
                const token = data.token;
                const claims = decodeJwtPayload(token);

                const roleClaim = String(
                    data.role ??
                        claims?.['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'] ??
                        claims?.role ??
                        'user'
                ).toLowerCase();
                const idClaim =
                    Number(
                        claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'] ??
                            claims?.sub ??
                            1
                    ) || 1;
                const nameClaim = claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'];

                const authUser = {
                    id: idClaim,
                    email: cleanEmail,
                    name:
                        typeof nameClaim === 'string' && nameClaim.trim()
                            ? nameClaim
                            : cleanEmail.split('@')[0],
                    role: roleClaim === 'admin' ? 'Admin' : 'User',
                    password,
                };

                const session = { token, user: authUser };
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
            const user = {
                id: matchedAdmin.id,
                email: matchedAdmin.email,
                name: matchedAdmin.name,
                role: 'Admin',
                password,
            };
            const session = { token: buildFakeJwt(user), user };
            this.saveSession(session);
            return session;
        }

        const users = getStoredUsers();
        const matchedUser = users.find(
            (u) => u.email.toLowerCase() === cleanEmail && (u.password === password || !u.password)
        );

        if (matchedUser) {
            const user = {
                id: matchedUser.id,
                email: matchedUser.email,
                name: matchedUser.name,
                role: 'User',
                password,
            };
            const session = { token: buildFakeJwt(user), user };
            this.saveSession(session);
            return session;
        }

        throw new Error('Неверный Email или пароль. Попробуйте демо-аккаунт ниже или зарегистрируйтесь.');
    },

    async register(name, email, password) {
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
            !users.some((u) => u.email.toLowerCase() === cleanEmail) &&
            !admins.some((a) => a.email.toLowerCase() === cleanEmail)
        ) {
            const nextId = users.reduce((max, u) => Math.max(max, u.id), 0) + 1;
            users.push({
                id: nextId,
                email: cleanEmail,
                name: cleanName,
                password,
            });
            saveStoredUsers(users);
        }

        return this.login(cleanEmail, password);
    },

    async editUser(updated) {
        try {
            const response = await fetch('/api/auth/edit', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    ...authHeaders(),
                },
                body: JSON.stringify(updated),
            });

            if (response.ok) {
                this.syncLocalUserUpdate(updated);
                return updated;
            }
        } catch {
            void 0;
        }

        this.syncLocalUserUpdate(updated);
        return updated;
    },

    syncLocalUserUpdate(updated) {
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

    async deleteAccount(id) {
        const session = this.getSession();
        try {
            await fetch(`/api/auth/delete/${id}`, {
                method: 'DELETE',
                headers: authHeaders(),
            });
        } catch {
            void 0;
        }

        saveStoredUsers(getStoredUsers().filter((u) => u.id !== id));

        if (session?.user.id === id) {
            this.saveSession(null);
        }
    },

    async checkRoleById(id) {
        try {
            const response = await fetch(`/api/admin/users/${id}/role`, {
                method: 'GET',
                headers: authHeaders(),
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                const role = String(data?.role ?? data?.Role ?? '').toLowerCase();
                if (role) {
                    return role === 'admin'
                        ? `Пользователь с ID ${id} является администратором`
                        : `Пользователь с ID ${id} не является администратором (Роль: Пользователь)`;
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

    async getAllUsers() {
        const localUsers = getStoredUsers();
        try {
            const response = await fetch('/api/admin/users', {
                headers: authHeaders(),
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

    async getAllAdmins() {
        const localAdmins = getStoredAdmins();
        try {
            const response = await fetch('/api/admin/admins', {
                headers: authHeaders(),
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

    async getPublicPresets(search, outcome, page = 1) {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (outcome) params.set('outcome', outcome);
        params.set('page', String(page));
        try {
            const response = await fetch(`/api/presets?${params.toString()}`, {
                headers: authHeaders(),
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    return data.map(normalizePresetListItem);
                }
            }
        } catch {
            void 0;
        }
        return [];
    },

    async getMyPresets(page = 1) {
        try {
            const response = await fetch(`/api/presets/mine?page=${page}`, {
                headers: authHeaders(),
            });
            if (response.ok && isJsonResponse(response)) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    return data.map(normalizePresetListItem);
                }
            }
        } catch {
            void 0;
        }
        return [];
    },

    async getPresetById(id) {
        try {
            const response = await fetch(`/api/presets/${id}`, {
                headers: authHeaders(),
            });
            if (response.ok && isJsonResponse(response)) {
                const detail = normalizePresetDetail(await response.json());
                return detail.bodies.length === 3 ? detail : null;
            }
        } catch {
            void 0;
        }
        return null;
    },
};
