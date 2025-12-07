# API Документация

**Base URL:** `https://business-crm-iu04.onrender.com/api`  
**Локально:** `http://localhost:4000/api`

---

## Авторизация

Все запросы (кроме `/auth/login`) требуют заголовок:
```
Authorization: Bearer <access_token>
```

**Токены:**
- Access Token: 24 часа
- Refresh Token: 7 дней

---

## Auth — Аутентификация

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/auth/login` | Вход по телефону и паролю |
| POST | `/auth/refresh` | Обновить токены |
| POST | `/auth/logout` | Выход (отзыв refresh token) |
| GET | `/auth/me` | Текущий пользователь |
| PUT | `/auth/profile` | Обновить профиль |
| POST | `/auth/change-password` | Сменить пароль |
| POST | `/auth/forgot-password` | Запрос сброса пароля |
| POST | `/auth/reset-password` | Сброс пароля по токену |

### Импершонация (SUPER_ADMIN)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| POST | `/auth/impersonate/{userId}` | Войти как другой пользователь |
| POST | `/auth/stop-impersonation` | Завершить импершонацию |

---

## Users — Пользователи

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/users` | Список пользователей |
| GET | `/users/{id}` | Получить по ID |
| POST | `/users` | Создать пользователя |
| PUT | `/users/{id}` | Обновить пользователя |
| DELETE | `/users/{id}` | Удалить (soft delete) |
| GET | `/users/all-admins` | Все админы (SUPER_ADMIN) |
| GET | `/users/permissions/routes` | Доступные роуты |
| GET | `/users/statuses` | Доступные статусы |
| GET | `/users/roles` | Доступные роли |

**Фильтры для GET /users:**
- `page`, `pageSize` — пагинация
- `search` — поиск по имени/телефону/email
- `status` — Активный / Не активный / Заблокирован
- `role` — admin / manager
- `sortBy`, `sortDesc` — сортировка

---

## Employees — Сотрудники

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/employees` | Список сотрудников |
| GET | `/employees/{id}` | Получить по ID |
| POST | `/employees` | Создать сотрудника |
| PUT | `/employees/{id}` | Обновить сотрудника |
| DELETE | `/employees/{id}` | Удалить (soft delete) |
| PATCH | `/employees/{id}/activate` | Активировать/деактивировать |
| PUT | `/employees/{id}/budget` | Обновить бюджет |
| PUT | `/employees/budget/batch` | Массовое обновление бюджета |
| GET | `/employees/{id}/orders` | История заказов |
| GET | `/employees/invite-statuses` | Статусы приглашений |
| GET | `/employees/export` | Экспорт в CSV |

**Фильтры для GET /employees:**
- `page`, `pageSize` — пагинация
- `search` — поиск
- `status` — активность
- `inviteStatus` — Принято / Ожидает / Отклонено
- `orderStatus` — статус заказа
- `minBudget`, `maxBudget` — фильтр по бюджету
- `hasSubscription` — есть подписка
- `projectId` — фильтр по проекту

---

## Projects — Проекты (филиалы)

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/projects` | Список проектов |
| GET | `/projects/{id}` | Получить по ID |
| POST | `/projects` | Создать проект |
| PUT | `/projects/{id}` | Обновить проект |
| DELETE | `/projects/{id}` | Удалить проект |

**Типы услуг проекта:**
```json
{
  "serviceTypes": ["LUNCH", "COMPENSATION"]
}
```

> ⚠️ Проект может поддерживать оба типа услуг, но сотрудник — только один.

---

## Dashboard (Home) — Главная

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/home/dashboard` | Статистика (включая сравнение с вчера) |
| GET | `/home/orders` | Заказы |
| GET | `/home/orders/export` | Экспорт заказов в CSV |
| POST | `/home/guest-orders` | Создать гостевой заказ |
| POST | `/home/assign-meals` | Назначить обеды сотрудникам |
| POST | `/home/bulk-action` | Массовые действия (pause, resume, cancel) |
| PUT | `/home/subscriptions/{employeeId}` | Обновить подписку |
| POST | `/home/subscriptions/bulk` | Массовое обновление подписок |
| GET | `/home/cutoff-time` | Время отсечки заказов |
| PUT | `/home/cutoff-time` | Обновить время отсечки |
| GET | `/home/combos` | Типы комбо (25 / 35 сомони) |

**Гостевой заказ:**
```json
{
  "guestName": "Гость",
  "comboType": "Комбо 25",
  "deliveryDate": "2024-12-07"
}
```
> Адрес автоматически берётся из проекта пользователя.

---

## Meal Subscriptions — Подписки на обеды

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/meal-subscriptions?projectId=` | Список подписок проекта |
| GET | `/meal-subscriptions/{id}` | Подписка по ID |
| POST | `/meal-subscriptions` | Создать подписку |
| POST | `/meal-subscriptions/{id}/cancel` | Отменить подписку |
| POST | `/meal-subscriptions/{id}/pause` | Приостановить |
| POST | `/meal-subscriptions/{id}/resume` | Возобновить |
| POST | `/meal-subscriptions/price-preview` | Предпросмотр цены |

### Назначения обедов

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/meal-subscriptions/{id}/assignments` | Назначения подписки |
| GET | `/meal-subscriptions/employees/{id}/assignments` | Назначения сотрудника |
| GET | `/meal-subscriptions/projects/{id}/assignments` | Назначения проекта |
| PUT | `/meal-subscriptions/assignments/{id}` | Обновить назначение |
| POST | `/meal-subscriptions/assignments/{id}/cancel` | Отменить |
| POST | `/meal-subscriptions/assignments/{id}/freeze` | Заморозить |
| POST | `/meal-subscriptions/assignments/{id}/unfreeze` | Разморозить |

### Заморозки

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/meal-subscriptions/employees/{id}/freeze-info` | Инфо о заморозках (лимит 2/неделю) |

### Календарь

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/meal-subscriptions/calendar?projectId=&startDate=&endDate=` | Календарь обедов |

---

## Invoices — Счета

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/invoices` | Список счетов |
| GET | `/invoices/{id}` | Счёт по ID |

---

## Transactions — Транзакции

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/transactions` | История транзакций |

---

## Documents — Документы

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/documents` | Список документов |

---

## News — Новости

| Метод | Эндпоинт | Описание |
|-------|----------|----------|
| GET | `/news` | Список новостей |
| GET | `/news/{id}` | Новость по ID |
| POST | `/news/{id}/read` | Отметить прочитанной |

---

## Формат ответа при ошибках

Все ошибки возвращаются в едином формате:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Человекопонятное сообщение",
    "type": "Validation|NotFound|Forbidden|Conflict|Internal",
    "details": { "field": "причина" }
  },
  "path": "/api/endpoint",
  "timestamp": "2024-12-06T10:30:00Z",
  "correlationId": "abc-123"
}
```

### Коды ошибок

#### Аутентификация (AUTH_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `AUTH_INVALID_CREDENTIALS` | 401 | Неверный логин или пароль |
| `AUTH_USER_BLOCKED` | 403 | Пользователь заблокирован |
| `AUTH_USER_INACTIVE` | 403 | Пользователь неактивен |
| `AUTH_TOKEN_EXPIRED` | 401 | Токен истёк |
| `AUTH_TOKEN_INVALID` | 401 | Невалидный токен |
| `AUTH_REFRESH_TOKEN_INVALID` | 401 | Невалидный refresh token |
| `AUTH_FORBIDDEN` | 403 | Недостаточно прав |
| `AUTH_IMPERSONATION_NOT_ALLOWED` | 403 | Импершонация запрещена |
| `AUTH_PASSWORD_WEAK` | 400 | Слабый пароль |

#### Пользователи (USER_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `USER_NOT_FOUND` | 404 | Пользователь не найден |
| `USER_PHONE_EXISTS` | 409 | Телефон уже занят |
| `USER_EMAIL_EXISTS` | 409 | Email уже занят |
| `USER_CANNOT_DELETE_SELF` | 400 | Нельзя удалить себя |
| `USER_CANNOT_DELETE_LAST_ADMIN` | 400 | Нельзя удалить последнего админа |
| `USER_INVALID_PHONE_FORMAT` | 400 | Некорректный формат телефона |

#### Сотрудники (EMP_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `EMP_NOT_FOUND` | 404 | Сотрудник не найден |
| `EMP_PHONE_EXISTS` | 409 | Телефон уже занят |
| `EMP_PHONE_DELETED` | 409 | Телефон принадлежит удалённому сотруднику |
| `EMP_INVALID_PHONE_FORMAT` | 400 | Некорректный формат телефона |
| `EMP_SERVICE_TYPE_SWITCH_BLOCKED` | 400 | Нельзя сменить тип услуги |
| `EMP_HAS_ACTIVE_ORDERS` | 400 | Есть активные заказы |

#### Проекты (PROJ_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `PROJ_NOT_FOUND` | 404 | Проект не найден |
| `PROJ_ADDRESS_IMMUTABLE` | 400 | Адрес проекта нельзя изменить |
| `PROJ_FOREIGN_COMPANY` | 403 | Проект чужой компании |

#### Подписки (SUB_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `SUB_NOT_FOUND` | 404 | Подписка не найдена |
| `SUB_MIN_DAYS_REQUIRED` | 400 | Минимум дней не соблюдён |
| `SUB_PAST_DATE_NOT_ALLOWED` | 400 | Дата в прошлом |
| `SUB_ALREADY_PAUSED` | 400 | Уже приостановлена |
| `SUB_ALREADY_ACTIVE` | 400 | Уже активна |
| `SUB_ALREADY_CANCELLED` | 400 | Уже отменена |

#### Заморозки (FREEZE_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `FREEZE_LIMIT_EXCEEDED` | 400 | Превышен лимит (2 в неделю) |
| `FREEZE_ALREADY_FROZEN` | 400 | Уже заморожено |
| `FREEZE_NOT_FROZEN` | 400 | Не заморожено |
| `FREEZE_PAST_DATE_NOT_ALLOWED` | 400 | Нельзя заморозить прошедшую дату |

#### Заказы (ORDER_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `ORDER_NOT_FOUND` | 404 | Заказ не найден |
| `ORDER_CUTOFF_PASSED` | 400 | Время отсечки прошло |
| `ORDER_PAST_DATE_NOT_ALLOWED` | 400 | Дата в прошлом |
| `ORDER_ALREADY_EXISTS` | 409 | Заказ уже существует |

#### Бюджет (BUDGET_*)

| Код | HTTP | Описание |
|-----|------|----------|
| `BUDGET_INSUFFICIENT` | 400 | Недостаточно средств |
| `BUDGET_OVERDRAFT_EXCEEDED` | 400 | Превышен овердрафт |

---

## HTTP коды ответов

| Код | Описание |
|-----|----------|
| 200 | OK — успешный запрос |
| 201 | Created — ресурс создан |
| 204 | No Content — успешно без тела |
| 400 | Bad Request — ошибка валидации |
| 401 | Unauthorized — требуется авторизация |
| 403 | Forbidden — доступ запрещён |
| 404 | Not Found — ресурс не найден |
| 409 | Conflict — конфликт (дубликат) |
| 500 | Internal Server Error — ошибка сервера |

---

## Примеры запросов

### Вход
```bash
curl -X POST https://business-crm-iu04.onrender.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+992901234567", "password": "admin123"}'
```

### Получить сотрудников
```bash
curl https://business-crm-iu04.onrender.com/api/employees \
  -H "Authorization: Bearer <token>"
```

### Создать сотрудника
```bash
curl -X POST https://business-crm-iu04.onrender.com/api/employees \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Иван",
    "lastName": "Иванов",
    "phone": "+992901234568",
    "position": "Менеджер",
    "projectId": "uuid-проекта",
    "serviceType": "LUNCH"
  }'
```

### Импершонация
```bash
# Войти как другой пользователь
curl -X POST https://business-crm-iu04.onrender.com/api/auth/impersonate/{userId} \
  -H "Authorization: Bearer <super_admin_token>"

# Вернуться в свой аккаунт
curl -X POST https://business-crm-iu04.onrender.com/api/auth/stop-impersonation \
  -H "Authorization: Bearer <impersonated_token>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Заморозить обед
```bash
curl -X POST https://business-crm-iu04.onrender.com/api/meal-subscriptions/assignments/{id}/freeze \
  -H "Authorization: Bearer <token>"
```
