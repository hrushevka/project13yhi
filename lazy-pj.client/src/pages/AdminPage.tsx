import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { AdminModel, UserModel } from '../types';
import { translateErrorMessage, validators } from '../utils/validation';

export function AdminPage() {
    const [activeSection, setActiveSection] = useState<'users' | 'admins' | 'tools'>('users');
    const [users, setUsers] = useState<UserModel[]>([]);
    const [admins, setAdmins] = useState<AdminModel[]>([]);
    const [notice, setNotice] = useState<string | null>(null);

    const [roleCheckId, setRoleCheckId] = useState('1');
    const [roleCheckResult, setRoleCheckResult] = useState<string | null>(null);
    const [invalidRoleId, setInvalidRoleId] = useState(false);

    const fetchAllAdminData = useCallback(async () => {
        const [userList, adminList] = await Promise.all([api.getAllUsers(), api.getAllAdmins()]);
        return { userList, adminList };
    }, []);

    const loadAllData = useCallback(async () => {
        const { userList, adminList } = await fetchAllAdminData();
        setUsers(userList);
        setAdmins(adminList);
    }, [fetchAllAdminData]);

    useEffect(() => {
        let active = true;
        fetchAllAdminData().then(({ userList, adminList }) => {
            if (active) {
                setUsers(userList);
                setAdmins(adminList);
            }
        });
        return () => {
            active = false;
        };
    }, [fetchAllAdminData]);

    const handleResetDemo = () => {
        const fresh = api.resetDemoData();
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

        try {
            setRoleCheckResult(await api.checkRoleById(Number(roleCheckId)));
        } catch (err) {
            setRoleCheckResult(translateErrorMessage(err));
        }
    };

    return (
        <div>
            <div className="glass-card profile-banner">
                <div>
                    <h1 className="section-title" style={{ fontSize: '1.5rem' }}>
                        Панель администратора
                    </h1>
                    <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Контроль ролей и управление пользователями
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
                    <div className="stat-label">Пользователи</div>
                    <div className="stat-value">{users.length}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Администраторы</div>
                    <div className="stat-value">{admins.length}</div>
                </div>
            </div>

            <div className="glass-card">
                <div className="admin-toolbar">
                    <div className="filter-group">
                        <button
                            type="button"
                            className={`btn btn-sm ${activeSection === 'users' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveSection('users')}
                        >
                            Пользователи ({users.length})
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${activeSection === 'admins' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveSection('admins')}
                        >
                            Администраторы ({admins.length})
                        </button>
                        <button
                            type="button"
                            className={`btn btn-sm ${activeSection === 'tools' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => setActiveSection('tools')}
                        >
                            Проверка роли по ID
                        </button>
                    </div>
                </div>

                {activeSection === 'users' && (
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>ID</th>
                                    <th>Имя</th>
                                    <th>Email</th>
                                    <th>Управление</th>
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u) => (
                                    <tr key={u.id}>
                                        <td>#{u.id}</td>
                                        <td>{u.name}</td>
                                        <td>{u.email}</td>
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
                                ))}
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
                                </tr>
                            </thead>
                            <tbody>
                                {admins.map((a) => (
                                    <tr key={a.id}>
                                        <td>#{a.id}</td>
                                        <td>{a.name}</td>
                                        <td>{a.email}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {activeSection === 'tools' && (
                    <div>
                        <h3 className="section-title">Проверка роли</h3>
                        <p className="section-subtitle">
                            Запрос к методу проверки прав пользователя по его идентификатору в базе данных.
                        </p>

                        <form className="role-checker-box" onSubmit={handleCheckRole} noValidate>
                            <input
                                type="number"
                                className={`input-control ${invalidRoleId ? 'validation-shake' : ''}`}
                                style={{
                                    maxWidth: 220,
                                    ...(invalidRoleId
                                        ? {
                                              borderColor: 'var(--accent)',
                                          }
                                        : {}),
                                }}
                                value={roleCheckId}
                                onChange={(e) => {
                                    setRoleCheckId(e.target.value);
                                    if (invalidRoleId) setInvalidRoleId(false);
                                }}
                                placeholder="Введите ID"
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
