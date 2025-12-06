namespace YallaBusinessAdmin.Application.Common.Errors;

/// <summary>
/// Centralized error codes for the application
/// </summary>
public static class ErrorCodes
{
    // ═══════════════════════════════════════════════════════════════
    // Authentication Errors (AUTH_*)
    // ═══════════════════════════════════════════════════════════════
    public const string AUTH_INVALID_CREDENTIALS = "AUTH_INVALID_CREDENTIALS";
    public const string AUTH_USER_BLOCKED = "AUTH_USER_BLOCKED";
    public const string AUTH_USER_INACTIVE = "AUTH_USER_INACTIVE";
    public const string AUTH_TOKEN_EXPIRED = "AUTH_TOKEN_EXPIRED";
    public const string AUTH_TOKEN_INVALID = "AUTH_TOKEN_INVALID";
    public const string AUTH_REFRESH_TOKEN_INVALID = "AUTH_REFRESH_TOKEN_INVALID";
    public const string AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED";
    public const string AUTH_FORBIDDEN = "AUTH_FORBIDDEN";
    public const string AUTH_IMPERSONATION_NOT_ALLOWED = "AUTH_IMPERSONATION_NOT_ALLOWED";
    public const string AUTH_PASSWORD_MISMATCH = "AUTH_PASSWORD_MISMATCH";
    public const string AUTH_PASSWORD_WEAK = "AUTH_PASSWORD_WEAK";

    // ═══════════════════════════════════════════════════════════════
    // User Errors (USER_*)
    // ═══════════════════════════════════════════════════════════════
    public const string USER_NOT_FOUND = "USER_NOT_FOUND";
    public const string USER_PHONE_EXISTS = "USER_PHONE_EXISTS";
    public const string USER_EMAIL_EXISTS = "USER_EMAIL_EXISTS";
    public const string USER_CANNOT_DELETE_SELF = "USER_CANNOT_DELETE_SELF";
    public const string USER_CANNOT_DELETE_LAST_ADMIN = "USER_CANNOT_DELETE_LAST_ADMIN";
    public const string USER_INVALID_PHONE_FORMAT = "USER_INVALID_PHONE_FORMAT";
    public const string USER_INVALID_EMAIL_FORMAT = "USER_INVALID_EMAIL_FORMAT";
    public const string USER_REQUIRED_FIELD_MISSING = "USER_REQUIRED_FIELD_MISSING";

    // ═══════════════════════════════════════════════════════════════
    // Employee Errors (EMP_*)
    // ═══════════════════════════════════════════════════════════════
    public const string EMP_NOT_FOUND = "EMP_NOT_FOUND";
    public const string EMP_PHONE_EXISTS = "EMP_PHONE_EXISTS";
    public const string EMP_PHONE_DELETED = "EMP_PHONE_DELETED";
    public const string EMP_INVALID_PHONE_FORMAT = "EMP_INVALID_PHONE_FORMAT";
    public const string EMP_REQUIRED_FIELD_MISSING = "EMP_REQUIRED_FIELD_MISSING";
    public const string EMP_SERVICE_TYPE_SWITCH_BLOCKED = "EMP_SERVICE_TYPE_SWITCH_BLOCKED";
    public const string EMP_HAS_ACTIVE_ORDERS = "EMP_HAS_ACTIVE_ORDERS";

    // ═══════════════════════════════════════════════════════════════
    // Project Errors (PROJ_*)
    // ═══════════════════════════════════════════════════════════════
    public const string PROJ_NOT_FOUND = "PROJ_NOT_FOUND";
    public const string PROJ_ADDRESS_IMMUTABLE = "PROJ_ADDRESS_IMMUTABLE";
    public const string PROJ_FOREIGN_COMPANY = "PROJ_FOREIGN_COMPANY";
    public const string PROJ_REQUIRED_FIELD_MISSING = "PROJ_REQUIRED_FIELD_MISSING";

    // ═══════════════════════════════════════════════════════════════
    // Subscription Errors (SUB_*)
    // ═══════════════════════════════════════════════════════════════
    public const string SUB_NOT_FOUND = "SUB_NOT_FOUND";
    public const string SUB_MIN_DAYS_REQUIRED = "SUB_MIN_DAYS_REQUIRED";
    public const string SUB_PAST_DATE_NOT_ALLOWED = "SUB_PAST_DATE_NOT_ALLOWED";
    public const string SUB_ALREADY_PAUSED = "SUB_ALREADY_PAUSED";
    public const string SUB_ALREADY_ACTIVE = "SUB_ALREADY_ACTIVE";
    public const string SUB_ALREADY_CANCELLED = "SUB_ALREADY_CANCELLED";
    public const string SUB_INVALID_COMBO_TYPE = "SUB_INVALID_COMBO_TYPE";

    // ═══════════════════════════════════════════════════════════════
    // Freeze Errors (FREEZE_*)
    // ═══════════════════════════════════════════════════════════════
    public const string FREEZE_LIMIT_EXCEEDED = "FREEZE_LIMIT_EXCEEDED";
    public const string FREEZE_ALREADY_FROZEN = "FREEZE_ALREADY_FROZEN";
    public const string FREEZE_NOT_FROZEN = "FREEZE_NOT_FROZEN";
    public const string FREEZE_PAST_DATE_NOT_ALLOWED = "FREEZE_PAST_DATE_NOT_ALLOWED";
    public const string FREEZE_ASSIGNMENT_NOT_FOUND = "FREEZE_ASSIGNMENT_NOT_FOUND";

    // ═══════════════════════════════════════════════════════════════
    // Order Errors (ORDER_*)
    // ═══════════════════════════════════════════════════════════════
    public const string ORDER_NOT_FOUND = "ORDER_NOT_FOUND";
    public const string ORDER_CUTOFF_PASSED = "ORDER_CUTOFF_PASSED";
    public const string ORDER_PAST_DATE_NOT_ALLOWED = "ORDER_PAST_DATE_NOT_ALLOWED";
    public const string ORDER_ALREADY_EXISTS = "ORDER_ALREADY_EXISTS";
    public const string ORDER_GUEST_CANNOT_FREEZE = "ORDER_GUEST_CANNOT_FREEZE";

    // ═══════════════════════════════════════════════════════════════
    // Budget Errors (BUDGET_*)
    // ═══════════════════════════════════════════════════════════════
    public const string BUDGET_INSUFFICIENT = "BUDGET_INSUFFICIENT";
    public const string BUDGET_OVERDRAFT_EXCEEDED = "BUDGET_OVERDRAFT_EXCEEDED";
    public const string BUDGET_NEGATIVE_NOT_ALLOWED = "BUDGET_NEGATIVE_NOT_ALLOWED";

    // ═══════════════════════════════════════════════════════════════
    // Generic Errors
    // ═══════════════════════════════════════════════════════════════
    public const string INTERNAL_ERROR = "INTERNAL_ERROR";
    public const string VALIDATION_ERROR = "VALIDATION_ERROR";
    public const string NOT_FOUND = "NOT_FOUND";
    public const string FORBIDDEN = "FORBIDDEN";
    public const string CONFLICT = "CONFLICT";
}

/// <summary>
/// Human-readable error messages in Russian
/// </summary>
public static class ErrorMessages
{
    private static readonly Dictionary<string, string> Messages = new()
    {
        // Auth
        [ErrorCodes.AUTH_INVALID_CREDENTIALS] = "Неверный логин или пароль",
        [ErrorCodes.AUTH_USER_BLOCKED] = "Ваш аккаунт заблокирован. Обратитесь к администратору",
        [ErrorCodes.AUTH_USER_INACTIVE] = "Ваш аккаунт неактивен. Обратитесь к администратору",
        [ErrorCodes.AUTH_TOKEN_EXPIRED] = "Сессия истекла. Пожалуйста, войдите заново",
        [ErrorCodes.AUTH_TOKEN_INVALID] = "Недействительный токен авторизации",
        [ErrorCodes.AUTH_REFRESH_TOKEN_INVALID] = "Недействительный токен обновления",
        [ErrorCodes.AUTH_UNAUTHORIZED] = "Требуется авторизация",
        [ErrorCodes.AUTH_FORBIDDEN] = "Доступ запрещён",
        [ErrorCodes.AUTH_IMPERSONATION_NOT_ALLOWED] = "Имперсонация доступна только для SUPER_ADMIN",
        [ErrorCodes.AUTH_PASSWORD_MISMATCH] = "Неверный текущий пароль",
        [ErrorCodes.AUTH_PASSWORD_WEAK] = "Пароль слишком слабый. Минимум 6 символов",

        // User
        [ErrorCodes.USER_NOT_FOUND] = "Пользователь не найден",
        [ErrorCodes.USER_PHONE_EXISTS] = "Пользователь с таким телефоном уже существует",
        [ErrorCodes.USER_EMAIL_EXISTS] = "Пользователь с такой почтой уже существует",
        [ErrorCodes.USER_CANNOT_DELETE_SELF] = "Нельзя удалить самого себя",
        [ErrorCodes.USER_CANNOT_DELETE_LAST_ADMIN] = "Нельзя удалить последнего администратора",
        [ErrorCodes.USER_INVALID_PHONE_FORMAT] = "Неверный формат телефона. Телефон должен начинаться с + и содержать только цифры",
        [ErrorCodes.USER_INVALID_EMAIL_FORMAT] = "Неверный формат email",
        [ErrorCodes.USER_REQUIRED_FIELD_MISSING] = "Обязательное поле не заполнено",

        // Employee
        [ErrorCodes.EMP_NOT_FOUND] = "Сотрудник не найден",
        [ErrorCodes.EMP_PHONE_EXISTS] = "Сотрудник с таким телефоном уже существует",
        [ErrorCodes.EMP_PHONE_DELETED] = "Сотрудник с таким телефоном был удален. Обратитесь к администратору для восстановления",
        [ErrorCodes.EMP_INVALID_PHONE_FORMAT] = "Неверный формат телефона. Телефон должен начинаться с + и содержать только цифры",
        [ErrorCodes.EMP_REQUIRED_FIELD_MISSING] = "Обязательное поле не заполнено",
        [ErrorCodes.EMP_SERVICE_TYPE_SWITCH_BLOCKED] = "Невозможно переключить тип услуги: у сотрудника активная подписка",
        [ErrorCodes.EMP_HAS_ACTIVE_ORDERS] = "Невозможно удалить сотрудника с активными заказами",

        // Project
        [ErrorCodes.PROJ_NOT_FOUND] = "Проект не найден",
        [ErrorCodes.PROJ_ADDRESS_IMMUTABLE] = "Адрес проекта нельзя изменить. Создайте новый проект с другим адресом",
        [ErrorCodes.PROJ_FOREIGN_COMPANY] = "Проект не принадлежит вашей компании",
        [ErrorCodes.PROJ_REQUIRED_FIELD_MISSING] = "Обязательное поле не заполнено",

        // Subscription
        [ErrorCodes.SUB_NOT_FOUND] = "Подписка не найдена",
        [ErrorCodes.SUB_MIN_DAYS_REQUIRED] = "Минимальный период подписки — 5 дней",
        [ErrorCodes.SUB_PAST_DATE_NOT_ALLOWED] = "Нельзя создать подписку на прошедшие даты",
        [ErrorCodes.SUB_ALREADY_PAUSED] = "Подписка уже приостановлена",
        [ErrorCodes.SUB_ALREADY_ACTIVE] = "Подписка уже активна",
        [ErrorCodes.SUB_ALREADY_CANCELLED] = "Подписка уже отменена",
        [ErrorCodes.SUB_INVALID_COMBO_TYPE] = "Неверный тип комбо",

        // Freeze
        [ErrorCodes.FREEZE_LIMIT_EXCEEDED] = "Вы уже использовали 2 заморозки на этой неделе. Лимит исчерпан",
        [ErrorCodes.FREEZE_ALREADY_FROZEN] = "Этот заказ уже заморожен",
        [ErrorCodes.FREEZE_NOT_FROZEN] = "Этот заказ не заморожен",
        [ErrorCodes.FREEZE_PAST_DATE_NOT_ALLOWED] = "Нельзя заморозить заказ на прошедшую дату",
        [ErrorCodes.FREEZE_ASSIGNMENT_NOT_FOUND] = "Назначение не найдено",

        // Order
        [ErrorCodes.ORDER_NOT_FOUND] = "Заказ не найден",
        [ErrorCodes.ORDER_CUTOFF_PASSED] = "Время для изменения заказов на сегодня истекло",
        [ErrorCodes.ORDER_PAST_DATE_NOT_ALLOWED] = "Нельзя изменять заказы на прошедшие даты",
        [ErrorCodes.ORDER_ALREADY_EXISTS] = "Заказ на эту дату уже существует",
        [ErrorCodes.ORDER_GUEST_CANNOT_FREEZE] = "Гостевые заказы нельзя замораживать",

        // Budget
        [ErrorCodes.BUDGET_INSUFFICIENT] = "Недостаточно бюджета для выполнения операции",
        [ErrorCodes.BUDGET_OVERDRAFT_EXCEEDED] = "Превышен лимит овердрафта",
        [ErrorCodes.BUDGET_NEGATIVE_NOT_ALLOWED] = "Бюджет не может быть отрицательным",

        // Generic
        [ErrorCodes.INTERNAL_ERROR] = "Произошла внутренняя ошибка. Попробуйте позже",
        [ErrorCodes.VALIDATION_ERROR] = "Ошибка валидации данных",
        [ErrorCodes.NOT_FOUND] = "Запрашиваемый ресурс не найден",
        [ErrorCodes.FORBIDDEN] = "Доступ запрещён",
        [ErrorCodes.CONFLICT] = "Конфликт данных"
    };

    public static string GetMessage(string code) => 
        Messages.TryGetValue(code, out var message) ? message : "Произошла ошибка";
}

/// <summary>
/// Action suggestions for users in Russian
/// </summary>
public static class ErrorActions
{
    private static readonly Dictionary<string, string> Actions = new()
    {
        [ErrorCodes.AUTH_INVALID_CREDENTIALS] = "Проверьте введённые данные или воспользуйтесь функцией восстановления пароля",
        [ErrorCodes.AUTH_USER_BLOCKED] = "Свяжитесь с администратором для разблокировки аккаунта",
        [ErrorCodes.AUTH_TOKEN_EXPIRED] = "Войдите в систему заново",
        [ErrorCodes.BUDGET_INSUFFICIENT] = "Обратитесь к администратору для пополнения бюджета",
        [ErrorCodes.FREEZE_LIMIT_EXCEEDED] = "Дождитесь следующей недели для использования заморозок",
        [ErrorCodes.ORDER_CUTOFF_PASSED] = "Изменения заказов возможны только до указанного времени",
        [ErrorCodes.EMP_SERVICE_TYPE_SWITCH_BLOCKED] = "Дождитесь окончания текущей подписки или отмените её"
    };

    public static string? GetAction(string code) => 
        Actions.TryGetValue(code, out var action) ? action : null;
}

