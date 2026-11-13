import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import type { AuthSession } from '../types';
import { translateErrorMessage, validators } from '../utils/validation';

interface CabinetPageProps {
    session: AuthSession;
    onSessionUpdate: (session: AuthSession | null) => void;
    onOpenAdmin?: () => void;
    onLogout?: () => void;
}

const INVALID_STYLE = { borderColor: 'var(--accent)' };

export function CabinetPage({ session, onSessionUpdate, onOpenAdmin, onLogout }: CabinetPageProps) {
    const [editName, setEditName] = useState(session.user.name);
    const [editEmail, setEditEmail] = useState(session.user.email);
    const [editPassword, setEditPassword] = useState(session.user.password || '');
    const [savingProfile, setSavingProfile] = useState(false);

    const [confirmDelete, setConfirmDelete] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [invalidField, setInvalidField] = useState<'name' | 'email' | 'password' | null>(null);

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
            onSessionUpdate(api.getSession());
            setNotice('Профиль успешно обновлён.');
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
                        <p>{session.user.email}</p>
                    </div>
                </div>

                <div className="action-row">
                    {session.user.role === 'Admin' && onOpenAdmin && (
                        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAdmin}>
                            Перейти в Админ-панель
                        </button>
                    )}
                    {onLogout && (
                        <button type="button" className="btn btn-secondary btn-sm" onClick={onLogout}>
                            Выйти
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

            <div className="cabinet-grid">
                <div className="glass-card">
                    <h2 className="section-title">Мои присеты</h2>
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
                                style={invalidField === 'name' ? INVALID_STYLE : undefined}
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
                                style={invalidField === 'email' ? INVALID_STYLE : undefined}
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
                                style={invalidField === 'password' ? INVALID_STYLE : undefined}
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
