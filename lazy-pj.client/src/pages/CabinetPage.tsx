import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { RequestStatus } from '../types';
import type { AdminRequestModel, AuthSession, RequestStatusCode } from '../types';
import { translateErrorMessage, validators } from '../utils/validation';

interface CabinetPageProps {
    session: AuthSession;
    onSessionUpdate: (session: AuthSession | null) => void;
    onOpenAdmin?: () => void;
}

export function CabinetPage({ session, onSessionUpdate, onOpenAdmin }: CabinetPageProps) {
    const [requests, setRequests] = useState<AdminRequestModel[]>([]);
    const [description, setDescription] = useState('');
    const [creating, setCreating] = useState(false);

    const [editName, setEditName] = useState(session.user.name);
    const [editEmail, setEditEmail] = useState(session.user.email);
    const [editPassword, setEditPassword] = useState(session.user.password || '');
    const [savingProfile, setSavingProfile] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [invalidField, setInvalidField] = useState<'description' | 'name' | 'email' | 'password' | null>(null);

    const fetchMyRequests = useCallback(async () => {
        const all = await api.getAllRequests();
        const mine = all.filter(
            (r) =>
                r.userId === session.user.id ||
                (r.userEmail || '').toLowerCase() === session.user.email.toLowerCase()
        );
        return mine;
    }, [session.user.id, session.user.email]);

    const loadMyRequests = useCallback(async () => {
        const mine = await fetchMyRequests();
        setRequests(mine);
    }, [fetchMyRequests]);

    useEffect(() => {
        let active = true;
        fetchMyRequests().then((mine) => {
            if (active) {
                setRequests(mine);
            }
        });
        return () => {
            active = false;
        };
    }, [fetchMyRequests]);

    const handleCreateRequest = async (e: FormEvent) => {
        e.preventDefault();
        setInvalidField(null);

        const descError = validators.validateDescription(description);
        if (descError) {
            setInvalidField('description');
            setNotice(descError);
            return;
        }

        setCreating(true);
        setNotice(null);
        try {
            await api.createRequest({
                userId: session.user.id,
                description: description.trim(),
            });
            setDescription('');
            await loadMyRequests();
            setNotice('Заявка успешно создана и передана на рассмотрение.');
        } catch (err) {
            setNotice(translateErrorMessage(err));
        } finally {
            setCreating(false);
        }
    };

    const handleSaveProfile = async (e: FormEvent) => {
        e.preventDefault();
        setInvalidField(null);

        const nameError = validators.validateName(editName);
        if (nameError) {
            setInvalidField('name');
            setNotice(nameError);
            return;
        }

        const emailError = validators.validateEmail(editEmail);
        if (emailError) {
            setInvalidField('email');
            setNotice(emailError);
            return;
        }

        if (editPassword.trim().length > 0 && editPassword.trim().length < 4) {
            setInvalidField('password');
            setNotice('Пароль должен содержать не менее 4 символов');
            return;
        }

        setSavingProfile(true);
        setNotice(null);
        try {
            await api.editUser({
                id: session.user.id,
                name: editName.trim(),
                email: editEmail.trim(),
                password: editPassword || session.user.password || 'password123',
            });
            const updatedSession = api.getSession();
            onSessionUpdate(updatedSession);
            await loadMyRequests();
            setNotice('Профиль успешно обновлён (PUT /api/auth/edit).');
        } catch (err) {
            setNotice(translateErrorMessage(err));
        } finally {
            setSavingProfile(false);
        }
    };

    const handleDeleteAccount = async () => {
        await api.deleteAccount(session.user.id);
        onSessionUpdate(null);
    };

    const renderStatusBadge = (status: RequestStatusCode) => {
        if (status === RequestStatus.Approve) {
            return <span className="status-pill status-approved">Одобрена</span>;
        }
        if (status === RequestStatus.Denied) {
            return <span className="status-pill status-denied">Отклонена</span>;
        }
        return <span className="status-pill status-pending">На рассмотрении</span>;
    };

    const totalCount = requests.length;
    const approvedCount = requests.filter((r) => r.approved === RequestStatus.Approve).length;
    const pendingCount = requests.filter((r) => r.approved === RequestStatus.Pending).length;

    const initials = (session.user.name || session.user.email || 'U')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);

    return (
        <div>
            <div className="glass-card profile-banner">
                <div className="profile-identity">
                    <div className="profile-avatar">{initials}</div>
                    <div className="profile-meta">
                        <h1>{session.user.name}</h1>
                        <p>
                            {session.user.email} • ID #{session.user.id}
                        </p>
                    </div>
                </div>

                <div className="action-row">
                    <span className="role-badge">
                        {session.user.role === 'Admin' ? 'Администратор' : 'Пользователь'}
                    </span>
                    {session.user.role === 'Admin' && onOpenAdmin && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAdmin}>
                            Перейти в Админ-панель
                        </button>
                    )}
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
                        Понятно
                    </button>
                </div>
            )}

            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-label">Мои заявки</div>
                    <div className="stat-value">{totalCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">Одобрено</div>
                    <div className="stat-value">{approvedCount}</div>
                </div>
                <div className="stat-card">
                    <div className="stat-label">В ожидании</div>
                    <div className="stat-value">{pendingCount}</div>
                </div>
            </div>

            <div className="cabinet-grid">
                <div className="glass-card">
                    <h2 className="section-title">Новая заявка</h2>
                    <p className="section-subtitle">
                        Опишите задачу, доступ или ресурс, который необходимо согласовать с администратором.
                    </p>

                    <form className="form-stack" onSubmit={handleCreateRequest} noValidate>
                        <div className="field-group">
                            <label className="field-label" htmlFor="req-desc">
                                Описание заявки
                            </label>
                            <textarea
                                id="req-desc"
                                className={`textarea-control ${invalidField === 'description' ? 'validation-shake' : ''}`}
                                placeholder="Например: Прошу предоставить доступ к тестовому серверу аналитики..."
                                value={description}
                                onChange={(e) => {
                                    setDescription(e.target.value);
                                    if (invalidField === 'description') setInvalidField(null);
                                }}
                                style={
                                    invalidField === 'description'
                                        ? { borderColor: 'var(--color-light)', boxShadow: '0 0 0 3px rgba(82, 138, 154, 0.35)' }
                                        : undefined
                                }
                            />
                        </div>
                        <button type="submit" className="btn btn-primary" disabled={creating}>
                            {creating ? 'Отправка...' : 'Отправить заявку'}
                        </button>
                    </form>

                    <div style={{ marginTop: '28px' }}>
                        <h3 className="section-title">История моих заявок</h3>
                        {requests.length === 0 ? (
                            <div className="empty-state">
                                У вас пока нет созданных заявок. Создайте первую заявку выше!
                            </div>
                        ) : (
                            <div className="request-list">
                                {requests.map((req) => (
                                    <div key={req.id} className="request-item">
                                        <div className="request-item-header">
                                            <div>
                                                <span className="request-id">Заявка #{req.id}</span>
                                                <span className="request-date" style={{ marginLeft: 10 }}>
                                                    {new Date(req.creationTime).toLocaleString('ru-RU', {
                                                        day: '2-digit',
                                                        month: 'short',
                                                        hour: '2-digit',
                                                        minute: '2-digit',
                                                    })}
                                                </span>
                                            </div>
                                            {renderStatusBadge(req.approved)}
                                        </div>
                                        <p className="request-desc">{req.description}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="glass-card">
                    <h2 className="section-title">Настройки профиля</h2>
                    <p className="section-subtitle">
                        Управление персональными данными аккаунта и параметрами безопасности.
                    </p>

                    <form key={session.user.id} className="form-stack" onSubmit={handleSaveProfile} noValidate>
                        <div className="field-group">
                            <label className="field-label" htmlFor="edit-name">
                                Имя пользователя
                            </label>
                            <input
                                id="edit-name"
                                className={`input-control ${invalidField === 'name' ? 'validation-shake' : ''}`}
                                type="text"
                                value={editName}
                                onChange={(e) => {
                                    setEditName(e.target.value);
                                    if (invalidField === 'name') setInvalidField(null);
                                }}
                                style={
                                    invalidField === 'name'
                                        ? { borderColor: 'var(--color-light)', boxShadow: '0 0 0 3px rgba(82, 138, 154, 0.35)' }
                                        : undefined
                                }
                            />
                        </div>

                        <div className="field-group">
                            <label className="field-label" htmlFor="edit-email">
                                Электронная почта
                            </label>
                            <input
                                id="edit-email"
                                className={`input-control ${invalidField === 'email' ? 'validation-shake' : ''}`}
                                type="email"
                                value={editEmail}
                                onChange={(e) => {
                                    setEditEmail(e.target.value);
                                    if (invalidField === 'email') setInvalidField(null);
                                }}
                                style={
                                    invalidField === 'email'
                                        ? { borderColor: 'var(--color-light)', boxShadow: '0 0 0 3px rgba(82, 138, 154, 0.35)' }
                                        : undefined
                                }
                            />
                        </div>

                        <div className="field-group">
                            <label className="field-label" htmlFor="edit-password">
                                Новый пароль
                            </label>
                            <input
                                id="edit-password"
                                className={`input-control ${invalidField === 'password' ? 'validation-shake' : ''}`}
                                type="password"
                                placeholder="Оставьте прежним или введите новый"
                                value={editPassword}
                                onChange={(e) => {
                                    setEditPassword(e.target.value);
                                    if (invalidField === 'password') setInvalidField(null);
                                }}
                                style={
                                    invalidField === 'password'
                                        ? { borderColor: 'var(--color-light)', boxShadow: '0 0 0 3px rgba(82, 138, 154, 0.35)' }
                                        : undefined
                                }
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={savingProfile}>
                            {savingProfile ? 'Сохранение...' : 'Сохранить изменения'}
                        </button>
                    </form>

                    <div
                        style={{
                            marginTop: '28px',
                            paddingTop: '20px',
                            borderTop: '1px solid var(--border-subtle)',
                        }}
                    >
                        <h3 className="section-title" style={{ fontSize: '1rem' }}>
                            Удаление учётной записи
                        </h3>
                        <p className="section-subtitle" style={{ marginBottom: '12px' }}>
                            При удалении аккаунта все связанные с ним данные будут стерты из базы.
                        </p>

                        {!confirmDelete ? (
                            <button
                                type="button"
                                className="btn btn-outline-danger btn-sm"
                                onClick={() => setConfirmDelete(true)}
                            >
                                Удалить мой аккаунт
                            </button>
                        ) : (
                            <div className="action-row">
                                <button
                                    type="button"
                                    className="btn btn-primary btn-sm"
                                    onClick={handleDeleteAccount}
                                >
                                    Подтвердить удаление
                                </button>
                                <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => setConfirmDelete(false)}
                                >
                                    Отмена
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
