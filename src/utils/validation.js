export function translateErrorMessage(raw) {
    if (!raw) return 'Попробуйте позже';
    const message = raw instanceof Error ? raw.message : String(raw);
    const trimmed = message.trim();
    if (!trimmed) return 'Попробуйте позже';
    const lower = trimmed.toLowerCase();

    if (
        lower.includes('failed to fetch') ||
        lower.includes('networkerror') ||
        lower.includes('network request failed') ||
        lower.includes('load failed') ||
        lower.includes('err_connection') ||
        lower.includes('econnrefused') ||
        lower.includes('timeout') ||
        lower.includes('aborted')
    ) {
        return 'Нет соединения с сервером. Попробуйте позже';
    }

    if (
        lower.includes('internal server error') ||
        lower.includes('500') ||
        lower.includes('502') ||
        lower.includes('503') ||
        lower.includes('504') ||
        lower.includes('bad gateway') ||
        lower.includes('service unavailable') ||
        lower.includes('unexpected token') ||
        lower.includes('json')
    ) {
        return 'Попробуйте позже';
    }

    if (lower.includes('user already exist') || lower.includes('already exists')) {
        return 'Пользователь с таким Email уже зарегистрирован';
    }

    if (lower.includes('user not found') || lower.includes('not found')) {
        return 'Запрашиваемые данные не найдены';
    }

    if (lower.includes('unauthorized') || lower.includes('401') || lower.includes('invalid credentials')) {
        return 'Неверный Email или пароль';
    }

    if (lower.includes('forbidden') || lower.includes('403')) {
        return 'Недостаточно прав для выполнения операции';
    }

    if (lower.includes('bad request') || lower.includes('400')) {
        return 'Проверьте правильность введённых данных';
    }

    const hasCyrillic = /[а-яёА-ЯЁ]/.test(trimmed);
    if (hasCyrillic) return trimmed;

    return 'Попробуйте позже';
}

export const validators = {
    validateEmail(email) {
        const value = email.trim();
        if (!value) return 'Пожалуйста, укажите адрес электронной почты';
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
        if (!emailRegex.test(value)) return 'Введите корректный Email (например, name@domain.ru)';
        return null;
    },

    validatePassword(password, minLength = 4) {
        if (!password || !password.trim()) return 'Пожалуйста, введите пароль';
        if (password.trim().length < minLength) return `Пароль должен содержать не менее ${minLength} символов`;
        return null;
    },

    validateName(name) {
        const value = name.trim();
        if (!value) return 'Пожалуйста, укажите ваше имя';
        if (value.length < 2) return 'Имя должно содержать не менее 2 символов';
        if (value.length > 60) return 'Имя не должно превышать 60 символов';
        return null;
    },

    validateDescription(description) {
        const value = description.trim();
        if (!value) return 'Опишите суть вашей заявки перед отправкой';
        if (value.length < 10) return 'Описание заявки слишком короткое (минимум 10 символов)';
        if (value.length > 1000) return 'Описание заявки не должно превышать 1000 символов';
        return null;
    },

    validateId(idInput) {
        const value = idInput.trim();
        if (!value) return 'Укажите числовой ID пользователя для проверки';
        const parsed = Number(value);
        if (!Number.isInteger(parsed) || parsed <= 0) return 'ID должен быть положительным целым числом';
        return null;
    },
};
