import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { RequestStatus } from '../types';
import type {
    AdminModel,
    AdminRequestModel,
    RequestStatusCode,
    UserModel,
} from '../types';
import { translateErrorMessage, validators } from '../utils/validation';

export function AdminPage() {
    const [activeSection, setActiveSection] = useState<'requests' | 'users' | 'admins' | 'tools'>('requests');
    const [requests, setRequests] = useState<AdminRequestModel[]>([]);
    const [users, setUsers] = useState<UserModel[]>([]);
    const [admins, setAdmins] = useState<AdminModel[]>([]);

    const [statusFilter, setStatusFilter] = useState<'all' | RequestStatusCode>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [notice, setNotice] = useState<string | null>(null);

    const [roleCheckId, setRoleCheckId] = useState('100');
    const [roleCheckResult, setRoleCheckResult] = useState<string | null>(null);
    const [invalidRoleId, setInvalidRoleId] = useState(false);

    const fetchAllAdminData = useCallback(async () => {
        const [reqList, userList, adminList] = await Promise.all([
            api.getAllRequests(),
            api.getAllUsers(),
            api.getAllAdmins(),
        ]);
        return { reqList, userList, adminList };
    }, []);

    const loadAllData = useCallback(async () => {
        const { reqList, userList, adminList } = await fetchAllAdminData();
        setRequests(reqList);
        setUsers(userList);
        setAdmins(adminList);
    }, [fetchAllAdminData]);

    useEffect(() => {
        let active = true;
        fetchAllAdminData().then(({ reqList, userList, adminList }) => {
            if (active) {
                setRequests(reqList);
                setUsers(userList);
                setAdmins(adminList);
            }
        });
        return () => {
            active = false;
        };
    }, [fetchAllAdminData]);

    const handleAcceptRequest = async (id: number) => {
        try {
            await api.acceptRequest(id);
            await loadAllData();
            setNotice(`Заявка #${id} одобрена (POST /api/request/${id}/accept).`);
        } catch (err) {
            setNotice(translateErrorMessage(err));
        }
    };

    const handleDenyRequest = async (id: number) => {
        try {
            await api.denyRequest(id);
            await loadAllData();
            setNotice(`Заявка #${id} отклонена (POST /api/request/${id}/Deny).`);
        } catch (err) {
            setNotice(translateErrorMessage(err));
        }
    };

    const handleResetPending = async (id: number) => {
        try {
            await api.setRequestStatus(id, RequestStatus.Pending);
            await loadAllData();
            setNotice(`Статус заявки #${id} возвращён в ожидание.`);
        } catch (err) {
            setNotice(translateErrorMessage(err));
        }
    };

    const handleResetDemo = () => {
        const fresh = api.resetDemoData();
        setRequests(fresh.requests);
        setUsers(fresh.users);
        setAdmins(fresh.admins);
        setNotice('Демонстрационные данные успешно восстановлены.');
    };

    const handleDeleteUser = async (id: number, email: string) => {
        await api.deleteAccount(id);
        await loadAllData();
        setNotice(`Пользователь ${email} (ID #${id}) удалён.`);
    };

    const handleCheckRole = async (e: FormEvent) => {
        e.preventDefault();
        setInvalidRoleId(false);

        const idErr = validators.validateId(roleCheckId);
        if (idErr) {
            setInvalidRoleId(true);
            setRoleCheckResult(idErr);
            return;
        }

        const parsed = Number(roleCheckId);
        try {
            const res = await api.checkRoleById(parsed);
            setRoleCheckResult(res);
        } catch (err) {
            setRoleCheckResult(translateErrorMessage(err));
        }
    };

    const filteredRequests = requests.filter((r) => {
        const matchesStatus = statusFilter === 'all' || r.approved === statusFilter;
        const q = searchQuery.trim().toLowerCase();
        const matchesQuery =
            !q ||
            (r.userEmail || '').toLowerCase().includes(q) ||
            (r.description || '').toLowerCase().includes(q) ||
            String(r.id).includes(q);
        return matchesStatus && matchesQuery;
    });

    const totalRequests = requests.length;
    const pendingCount = requests.filter((r) => r.approved === RequestStatus.Pending).length;
    const approvedCount = requests.filter((r) => r.approved === RequestStatus.Approve).length;
    const deniedCount = requests.filter((r) => r.approved === RequestStatus.Denied).length;

    const renderStatusBadge = (status: RequestStatusCode) => {
        if (status === RequestStatus.Approve) {
            return <span className="status-pill status-approved">Одобрена</span>;
        }
        if (status === RequestStatus.Denied) {
            return <span className="status-pill status-denied">Отклонена</span>;
        }
        return <span className="status-pill status-pending">В очереди</span>;
    };

    return (
        <div>
            <div className="glass-card profile-banner">
                <div>
                    <h1 style={{ margin: '0 0 6px', fontSize: '1.5rem' }}>
                        Панель администратора
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Центр рассмотрения заявок пользователей, контроля ролей и управления базой данных
                    </p>
                </div>

                <div className="action-row">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={loadAllData}>
                        Обновить данные
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleResetDemo}>
                        Сбросить демо
                    </button>
                </div>
            </div>

            {notice && (
                <div className="alert-banner" role="status">
                    <span>{notice}</span>
                    <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setNotice(null)}
                    >
                        Закрыть
                    </button>
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Всего заявок</div>
                    <div className="stat-value">{totalRequests}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Ожидают решения</div>
                    <div className="stat-value">{pendingCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Одобрено</div>
                    <div className="stat-value">{approvedCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Отклонено</div>
                    <div className="stat-value">{deniedCount}</div>
                </div>
            </div>

            <div className="glass-card">
                <div className="admin-toolbar">
                    <div className="filter-group">
                        <button
                            type="button"
                            className={`nav-pill ${activeSection === 'requests' ? 'active' : ''}`}
                            onClick={() => setActiveSection('requests')}
                        >
                            Заявки ({requests.length})
                        </button>
                        <button
                            type="button"
                            className={`nav-pill ${activeSection === 'users' ? 'active' : ''}`}
                            onClick={() => setActiveSection('users')}
                        >
                            Пользователи ({users.length})
                        </button>
                        <button
                            type="button"
                            className={`nav-pill ${activeSection === 'admins' ? 'active' : ''}`}
                            onClick={() => setActiveSection('admins')}
                        >
                            Администраторы ({admins.length})
                        </button>
                        <button
                            type="button"
                            className={`nav-pill ${activeSection === 'tools' ? 'active' : ''}`}
                            onClick={() => setActiveSection('tools')}
                        >
                            Проверка роли по ID
                        </button>
                    </div>
                </div>

                {activeSection === 'requests' && (
                    <>
                        <div className="admin-toolbar">
                            <div className="filter-group">
                                <button
                                    type="button"
                                    className={`btn btn-sm ${
                                        statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'
                                    }`}
                                    onClick={() => setStatusFilter('all')}
                                >
                                    Все
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${
                                        statusFilter === RequestStatus.Pending
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                    }`}
                                    onClick={() => setStatusFilter(RequestStatus.Pending)}
                                >
                                    В ожидании
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${
                                        statusFilter === RequestStatus.Approve
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                    }`}
                                    onClick={() => setStatusFilter(RequestStatus.Approve)}
                                >
                                    Одобренные
                                </button>
                                <button
                                    type="button"
                                    className={`btn btn-sm ${
                                        statusFilter === RequestStatus.Denied
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                    }`}
                                    onClick={() => setStatusFilter(RequestStatus.Denied)}
                                >
                                    Отклонённые
                                </button>
                            </div>

                            <input
                                type="search"
                                className="search-input"
                                placeholder="Поиск по Email, ID или тексту..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>

                        {filteredRequests.length === 0 ? (
                            <div className="empty-state">
                                Заявки по выбранным критериям не найдены.
                            </div>
                        ) : (
                            <div className="table-responsive">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Отправитель</th>
                                            <th>Описание заявки</th>
                                            <th>Дата создания</th>
                                            <th>Статус</th>
                                            <th>Действия</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredRequests.map((req) => (
                                            <tr key={req.id}>
                                                <td>
                                                    <strong>#{req.id}</strong>
                                                </td>
                                                <td>
                                                    <div>{req.userEmail}</div>
                                                    <span
                                                        style={{
                                                            fontSize: '0.75rem',
                                                            color: 'var(--text-muted)',
                                                        }}
                                                    >
                                                        User ID: {req.userId}
                                                    </span>
                                                </td>
                                                <td style={{ maxWidth: 380 }}>{req.description}</td>
                                                <td style={{ whiteSpace: 'nowrap' }}>
                                                    {new Date(req.creationTime).toLocaleString('ru-RU', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </td>
                                                <td>{renderStatusBadge(req.approved)}</td>
                                                <td>
                                                    <div className="action-row">
                                                        <button
                                                            type="button"
                                                            className="btn btn-primary btn-sm"
                                                            disabled={req.approved === RequestStatus.Approve}
                                                            onClick={() => handleAcceptRequest(req.id)}
                                                        >
                                                            Принять
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="btn btn-outline-danger btn-sm"
                                                            disabled={req.approved === RequestStatus.Denied}
                                                            onClick={() => handleDenyRequest(req.id)}
                                                        >
                                                            Отклонить
                                                        </button>
                                                        {req.approved !== RequestStatus.Pending && (
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary btn-sm"
                                                                onClick={() => handleResetPending(req.id)}
                                                            >
                                                                В очередь
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}

                {activeSection === 'users' && (
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Имя</th>
                                    <th>Email</th>
                                    <th>Заявок создано</th>
                                    <th>Управление</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => {
                                    const userReqCount = requests.filter(
                                        (r) =>
                                            r.userId === u.id ||
                                            (r.userEmail || '').toLowerCase() === (u.email || '').toLowerCase()
                                    ).length;
                                    return (
                                        <tr key={u.id}>
                                            <td>#{u.id}</td>
                                            <td>{u.name}</td>
                                            <td>{u.email}</td>
                                            <td>{userReqCount}</td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="btn btn-outline-danger btn-sm"
                                                    onClick={() => handleDeleteUser(u.id, u.email)}
                                                >
                                                    Удалить
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeSection === 'admins' && (
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Имя администратора</th>
                                    <th>Email</th>
                                    <th>Уровень доступа</th>
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map((a) => (
                                    <tr key={a.id}>
                                        <td>#{a.id}</td>
                                        <td>{a.name}</td>
                                        <td>{a.email}</td>
                                        <td>
                                            <span className="role-badge">Admin</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeSection === 'tools' && (
                    <div>
                        <h3 className="section-title">Проверка принадлежности к роли Администратора</h3>
                        <p className="section-subtitle">
                            Выполняет запрос к методу проверки прав пользователя по его идентификатору в базе данных.
                        </p>

                        <form className="role-checker-box" onSubmit={handleCheckRole} noValidate>
                            <input
                                type="number"
                                className={`input-control ${invalidRoleId ? 'validation-shake' : ''}`}
                                style={{
                                    maxWidth: 220,
                                    ...(invalidRoleId
                                        ? {
                                              borderColor: 'var(--color-light)',
                                              boxShadow: '0 0 0 3px rgba(82, 138, 154, 0.35)',
                                          }
                                        : {}),
                                }}
                                value={roleCheckId}
                                onChange={(e) => {
                                    setRoleCheckId(e.target.value);
                                    if (invalidRoleId) setInvalidRoleId(false);
                                }}
                                placeholder="Введите ID (например, 100)"
                            />
                            <button type="submit" className="btn btn-primary">
                                Проверить ID
                            </button>
                        </form>

                        {roleCheckResult && (
                            <div className="alert-banner" style={{ marginTop: 18 }}>
                                <span>{roleCheckResult}</span>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
