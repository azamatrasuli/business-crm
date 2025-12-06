# API Документация

**Base URL:** `https://business-crm-iu04.onrender.com/api`  
**Локально:** `http://localhost:5000/api`

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

## Коды ошибок

| Код | Описание |
|-----|----------|
| 400 | Неверные параметры запроса |
| 401 | Требуется авторизация |
| 403 | Доступ запрещён |
| 404 | Ресурс не найден |
| 409 | Конфликт (например, телефон уже занят) |
| 500 | Внутренняя ошибка сервера |

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

### Импершонация
```bash
# Войти как другой пользователь
curl -X POST https://business-crm-iu04.onrender.com/api/auth/impersonate/{userId} \
  -H "Authorization: Bearer <super_admin_token>"

# Вернуться в свой аккаунт
curl -X POST https://business-crm-iu04.onrender.com/api/auth/stop-impersonation \
  -H "Authorization: Bearer <impersonated_token>"
```
