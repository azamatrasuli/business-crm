# API

**Base URL:** `http://localhost:5000/api`

## Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Вход (phone + password) |
| POST | `/auth/logout` | Выход (revokes refresh token) |
| POST | `/auth/refresh` | Обновить токен |
| POST | `/auth/forgot-password` | Забыли пароль |
| POST | `/auth/reset-password` | Сброс пароля |
| POST | `/auth/change-password` | Смена пароля |
| PUT | `/auth/profile` | Обновить профиль |
| GET | `/auth/me` | Текущий пользователь |

## Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users` | Список (page, pageSize, search, status, role) |
| GET | `/users/:id` | Получить по ID |
| POST | `/users` | Создать |
| PUT | `/users/:id` | Обновить |
| DELETE | `/users/:id` | Удалить (soft delete) |
| GET | `/users/permissions/routes` | Доступные роуты |

## Employees

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/employees` | Список (page, pageSize, search, status, inviteStatus, orderStatus, minBudget, maxBudget, hasSubscription) |
| GET | `/employees/:id` | Получить по ID |
| POST | `/employees` | Создать |
| PUT | `/employees/:id` | Обновить |
| DELETE | `/employees/:id` | Удалить (soft delete) |
| PATCH | `/employees/:id/activate` | Активировать/деактивировать |
| PUT | `/employees/:id/budget` | Обновить бюджет |
| GET | `/employees/:id/orders` | История заказов (page, pageSize, dateFrom, dateTo, status) |
| POST | `/employees/batch-budget` | Массовое обновление бюджета |
| GET | `/employees/export` | Экспорт в CSV |

## Dashboard (Home)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/home/dashboard` | Статистика (включая сравнение с вчера) |
| GET | `/home/orders` | Заказы (page, pageSize, search, status, date, address, orderType) |
| GET | `/home/orders/export` | Экспорт заказов в CSV |
| GET | `/home/addresses` | Адреса |
| POST | `/home/addresses` | Создать адрес |
| PUT | `/home/addresses/:id` | Обновить адрес |
| DELETE | `/home/addresses/:id` | Удалить адрес |
| PATCH | `/home/addresses/:id/default` | Установить по умолчанию |
| POST | `/home/guest-orders` | Гостевой заказ |
| POST | `/home/assign-meals` | Назначить обеды |
| POST | `/home/bulk-action` | Массовые действия (pause, resume, changeAddress, cancel, changeCombo) |
| PUT | `/home/subscriptions/:id` | Обновить подписку |
| POST | `/home/subscriptions/bulk` | Массовое обновление подписок |
| GET | `/home/cutoff-time` | Время отсечки |
| PUT | `/home/cutoff-time` | Обновить время отсечки |

## Subscriptions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/subscriptions` | Список подписок |
| GET | `/subscriptions/:id` | Получить по ID |
| POST | `/subscriptions` | Создать |
| PUT | `/subscriptions/:id` | Обновить |
| DELETE | `/subscriptions/:id` | Удалить |
| POST | `/subscriptions/:id/pause` | Приостановить |
| POST | `/subscriptions/:id/resume` | Возобновить |
| POST | `/subscriptions/bulk/pause` | Массовая приостановка |
| POST | `/subscriptions/bulk/resume` | Массовое возобновление |
| GET | `/subscriptions/:id/price-preview` | Предпросмотр цены |

## Invoices

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/invoices` | Список счетов |
| GET | `/invoices/:id` | Получить по ID |

## Transactions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/transactions` | История транзакций |

## Documents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/documents` | Список документов |

## News

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/news` | Список новостей |
| GET | `/news/:id` | Получить по ID |
| POST | `/news/:id/read` | Отметить как прочитанную |

## Авторизация

```
Authorization: Bearer <token>
```

Токены:
- **Access Token**: 24 часа
- **Refresh Token**: 7 дней

## Ошибки

| Код | Описание |
|-----|----------|
| 400 | Bad Request - неверные параметры |
| 401 | Unauthorized - требуется авторизация |
| 403 | Forbidden - нет доступа |
| 404 | Not Found - не найдено |
| 409 | Conflict - конфликт (напр. телефон занят) |
| 500 | Server Error - ошибка сервера |
