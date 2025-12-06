# Yalla Business Admin — Backend

> ASP.NET Core 8 Web API с Clean Architecture

## Структура проекта

```
backend/
├── src/
│   ├── YallaBusinessAdmin.Api/           # Контроллеры, Program.cs
│   ├── YallaBusinessAdmin.Application/   # DTOs, интерфейсы сервисов
│   ├── YallaBusinessAdmin.Domain/        # Entities, Enums
│   └── YallaBusinessAdmin.Infrastructure/# EF Core, реализации сервисов
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

**API:** http://localhost:5000/api  
**Swagger:** http://localhost:5000/swagger

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
  "FrontendUrl": "http://localhost:3000"
}
```

## Docker

```bash
# Сборка
docker build -t yalla-api .

# Запуск
docker run -p 5000:8080 \
  -e ConnectionStrings__DefaultConnection="..." \
  -e Jwt__Secret="..." \
  yalla-api
```

## Архитектура

### Clean Architecture слои

1. **Domain** — Entities, Enums (без зависимостей)
2. **Application** — DTOs, интерфейсы сервисов (зависит от Domain)
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

## База данных

- **СУБД:** PostgreSQL 15 (Supabase)
- **ORM:** Entity Framework Core 8
- **Миграции:** Через Supabase SQL Editor или MCP

### Основные таблицы

| Таблица | Описание |
|---------|----------|
| `companies` | Компании (холдинги) |
| `projects` | Проекты (филиалы) |
| `admin_users` | Пользователи B2B кабинета |
| `employees` | Сотрудники компаний |
| `employee_budgets` | Бюджеты сотрудников |
| `orders` | Заказы на обеды |
| `company_subscriptions` | Подписки проектов |
| `employee_meal_assignments` | Назначения обедов |
| `audit_logs` | Аудит действий |

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
