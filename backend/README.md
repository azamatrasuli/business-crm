# Yalla Business Admin — Backend

> ASP.NET Core 8 Web API с Clean Architecture

## Структура проекта

```
backend/
├── src/
│   ├── YallaBusinessAdmin.Api/           # Контроллеры, Program.cs
│   ├── YallaBusinessAdmin.Application/   # DTOs, интерфейсы, ошибки
│   ├── YallaBusinessAdmin.Domain/        # Entities, Enums
│   └── YallaBusinessAdmin.Infrastructure/# EF Core, сервисы
├── Dockerfile                             # Docker образ
├── Directory.Build.props                  # Общие настройки сборки
└── YallaBusinessAdmin.sln                 # Solution файл
```

## Быстрый старт

```bash
# Переменные окружения
export ConnectionStrings__DefaultConnection="Host=localhost;Database=yalla;Username=postgres;Password=..."
export Jwt__Secret="минимум-32-символа-секретный-ключ"

# Запуск
dotnet restore
dotnet run --project src/YallaBusinessAdmin.Api
```

**API:** http://localhost:4000/api  
**Swagger:** http://localhost:4000/swagger

## Тестовый вход

```
Телефон: +992901234567
Пароль: admin123
Роль: SUPER_ADMIN
```

## Основные эндпоинты

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/auth/login` | Вход |
| `POST /api/auth/refresh` | Обновить токен |
| `POST /api/auth/impersonate/{id}` | Импершонация (SUPER_ADMIN) |
| `GET /api/users` | Пользователи |
| `GET /api/employees` | Сотрудники |
| `GET /api/projects` | Проекты |
| `GET /api/home/dashboard` | Статистика |
| `GET /api/home/orders` | Заказы |
| `GET /api/meal-subscriptions` | Подписки на обеды |

Полная документация: [docs/API.md](../docs/API.md)

## Конфигурация

### appsettings.json

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
  },
  "Jwt": {
    "Secret": "минимум-32-символа",
    "Issuer": "YallaBusinessAdmin",
    "Audience": "YallaBusinessAdminUsers",
    "ExpirationInMinutes": 1440,
    "RefreshTokenExpirationInDays": 7
  },
  "FrontendUrl": "http://localhost:3000",
  "Serilog": {
    "MinimumLevel": {
      "Default": "Information",
      "Override": {
        "Microsoft.EntityFrameworkCore.Database.Command": "Information"
      }
    }
  }
}
```

## Docker (для Render)

`Dockerfile` используется для деплоя на Render. Локально используйте `./dev.sh`.

## Архитектура

### Clean Architecture слои

1. **Domain** — Entities, Enums (без зависимостей)
2. **Application** — DTOs, интерфейсы, ошибки (зависит от Domain)
3. **Infrastructure** — EF Core, реализации (зависит от Application)
4. **Api** — Controllers, конфигурация (зависит от всех)

### Основные сервисы

| Сервис | Описание |
|--------|----------|
| `AuthService` | Аутентификация, JWT, импершонация |
| `UsersService` | CRUD пользователей |
| `EmployeesService` | CRUD сотрудников |
| `ProjectsService` | CRUD проектов |
| `DashboardService` | Статистика, заказы |
| `MealSubscriptionsService` | Подписки на обеды |
| `AuditService` | Логирование действий |

## Обработка ошибок

### Структура ошибок

Все ошибки обрабатываются централизованно через `GlobalExceptionHandler` в `Program.cs`.

**Формат ответа:**
```json
{
  "success": false,
  "error": {
    "code": "EMP_PHONE_EXISTS",
    "message": "Сотрудник с таким телефоном уже существует",
    "type": "Conflict",
    "details": null
  },
  "path": "/api/employees",
  "timestamp": "2024-12-06T10:30:00Z",
  "correlationId": "abc-123"
}
```

### Использование в коде

```csharp
// Способ 1: Бросить исключение (рекомендуется)
throw new InvalidOperationException("Сотрудник с таким телефоном уже существует.");

// Способ 2: Использовать AppException для структурированных ошибок
throw new AppException(
    ErrorCodes.EMP_PHONE_EXISTS,
    "Сотрудник с таким телефоном уже существует",
    ErrorType.Conflict
);
```

### Коды ошибок

Все коды определены в `Application/Common/Errors/ErrorCodes.cs`:

- `AUTH_*` — ошибки аутентификации
- `USER_*` — ошибки пользователей
- `EMP_*` — ошибки сотрудников
- `PROJ_*` — ошибки проектов
- `SUB_*` — ошибки подписок
- `FREEZE_*` — ошибки заморозок
- `ORDER_*` — ошибки заказов
- `BUDGET_*` — ошибки бюджета

## Логирование

Используется **Serilog** со структурированным логированием:

```csharp
Log.Information("User {UserId} logged in from {IP}", userId, ipAddress);
```

### Correlation ID

Каждый запрос получает уникальный `X-Correlation-ID` для трассировки:

```
X-Correlation-ID: 550e8400-e29b-41d4-a716-446655440000
```

### Уровни логирования

| Уровень | Использование |
|---------|--------------|
| `Debug` | Отладочная информация |
| `Information` | Обычные операции |
| `Warning` | Потенциальные проблемы |
| `Error` | Ошибки (с exception) |

## База данных

- **СУБД:** PostgreSQL 15 (Supabase)
- **ORM:** Entity Framework Core 8
- **Миграции:** Через Supabase SQL Editor или MCP

### Основные таблицы

| Таблица | Описание |
|---------|----------|
| `companies` | Компании (холдинги) |
| `projects` | Проекты (филиалы) — `service_types TEXT[]` |
| `admin_users` | Пользователи B2B кабинета |
| `employees` | Сотрудники компаний — `service_type TEXT` |
| `employee_budgets` | Бюджеты сотрудников |
| `orders` | Заказы на обеды |
| `company_subscriptions` | Подписки проектов |
| `lunch_subscriptions` | Подписки на обеды |
| `employee_meal_assignments` | Назначения обедов |
| `employee_freeze_history` | История заморозок |
| `audit_logs` | Аудит действий |

### Бизнес-правило: Service Types

- **Проект** (`projects.service_types`): массив `['LUNCH', 'COMPENSATION']`
- **Сотрудник** (`employees.service_type`): строка `'LUNCH'` или `'COMPENSATION'`

> Проект может поддерживать оба типа, но сотрудник — только один в момент времени.

## Роли и права

| Роль | Описание |
|------|----------|
| `SUPER_ADMIN` | Полный доступ + импершонация |
| `admin` | Админ компании/проекта |
| `manager` | Менеджер с ограниченными правами |

## Разработка

### Добавление нового эндпоинта

1. Создайте DTO в `Application/{Module}/Dtos/`
2. Добавьте метод в интерфейс `Application/{Module}/I{Module}Service.cs`
3. Реализуйте в `Infrastructure/Services/{Module}Service.cs`
4. Создайте контроллер в `Api/Controllers/{Module}Controller.cs`

### Добавление новой сущности

1. Создайте Entity в `Domain/Entities/`
2. Добавьте DbSet в `Infrastructure/Persistence/AppDbContext.cs`
3. Настройте маппинг в `OnModelCreating`
4. Примените миграцию в Supabase

### Добавление кода ошибки

1. Добавьте константу в `Application/Common/Errors/ErrorCodes.cs`
2. Используйте в сервисе через `throw new InvalidOperationException("сообщение")`
3. Фронтенд автоматически отобразит сообщение

## Тестирование API

```bash
# Логин
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone": "+992901234567", "password": "admin123"}'

# Получить сотрудников
curl http://localhost:4000/api/employees \
  -H "Authorization: Bearer <token>"
```
