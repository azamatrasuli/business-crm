# Yalla Business Admin - Backend

ASP.NET Core 8 API с Clean Architecture.

## Структура

```
src/
├── YallaBusinessAdmin.Api/           # Controllers, Program.cs
├── YallaBusinessAdmin.Application/   # DTOs, интерфейсы сервисов
├── YallaBusinessAdmin.Domain/        # Entities, Enums
└── YallaBusinessAdmin.Infrastructure/# EF Core, реализации сервисов
```

## Запуск

```bash
# Настройка переменных окружения
export SUPABASE_DB_URL="postgresql://postgres:[password]@[host]:5432/postgres"
export Jwt__Secret="your-secret-key-32-chars-minimum"

# Запуск
dotnet restore
dotnet run --project src/YallaBusinessAdmin.Api
```

**API:** `http://localhost:5000/api`  
**Swagger:** `http://localhost:5000/swagger`

## База данных

Данные управляются через Supabase. Миграции применяются через Supabase MCP.

## Тестовый вход

- **Телефон:** `+992901234567`
- **Пароль:** `admin123`

## Основные API эндпоинты

| Эндпоинт | Описание |
|----------|----------|
| `POST /api/auth/login` | Вход |
| `POST /api/auth/refresh` | Обновить токен |
| `GET /api/users` | Пользователи |
| `GET /api/employees` | Сотрудники |
| `GET /api/home/dashboard` | Дашборд |
| `GET /api/home/orders` | Заказы |

Полная документация: [docs/API.md](../docs/API.md)
