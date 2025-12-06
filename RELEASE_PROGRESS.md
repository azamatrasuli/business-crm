# 🚀 Прогресс релиза

> Актуальный статус разработки и релиза Yalla Business Admin.

## Статус: ✅ В ПРОДАКШЕНЕ

**Дата запуска:** 2025-12-05  
**Последнее обновление:** 2025-12-06  
**Версия:** MVP 1.1 (Lunch + Error Handling)

---

## 📊 Текущий статус

### Что работает (MVP)
| Модуль | Статус | Описание |
|--------|--------|----------|
| Авторизация | ✅ | JWT + Refresh tokens + Импершонация |
| Проекты | ✅ | CRUD филиалов с массивом `serviceTypes` |
| Пользователи | ✅ | RBAC с ролями admin/manager |
| Сотрудники | ✅ | HR модуль с бюджетами и подписками |
| Подписки на обеды | ✅ | Комплексные обеды (Комбо 25/35) |
| Dashboard | ✅ | Статистика + управление заказами |
| Гостевые заказы | ✅ | Разовые заказы (адрес из проекта) |
| Импершонация | ✅ | SUPER_ADMIN может войти в любой аккаунт |
| Обработка ошибок | ✅ | Структурированные коды + toast уведомления |
| Логирование | ✅ | Serilog + Correlation ID + Frontend Logger |

### Заблокировано (Phase 2)
| Модуль | Статус | Причина |
|--------|--------|---------|
| Компенсации | 🚫 | Ждём Client Web + Merchant Lite |
| Оплаты | 🚫 | В разработке |
| Аналитика | 🚫 | В разработке |
| Новости | 🚫 | В разработке |
| Партнёры | 🚫 | В разработке |

---

## 🔗 Ссылки на среды

### Production
| Сервис | URL |
|--------|-----|
| Frontend | https://yalla-business-crm.vercel.app |
| Backend API | https://business-crm-iu04.onrender.com |
| База данных | Supabase `qwkpqbfldvuxcxugxcmj` |

### Staging  
| Сервис | URL |
|--------|-----|
| Frontend | https://business-crm-git-develop-azamatrasuli-protonmes-projects.vercel.app |
| Backend API | https://business-crm-staging.onrender.com |
| База данных | Supabase `psuiiifwntvjhuzxronr` |

---

## 🔐 Учётные данные

### Супер-админ (SUPER_ADMIN)
```
Телефон: +992901234567
Пароль: admin123
```

### GitHub
```
Репозиторий: https://github.com/azamatrasuli/business-crm
Ветки: main (production), develop (staging)
```

---

## 📝 Лог изменений

### 2025-12-06 (v1.1)

#### Backend
- ✅ Структурированная обработка ошибок (ErrorCodes, AppException)
- ✅ Global Exception Handler с типизированными ответами
- ✅ Serilog с Correlation ID для трассировки
- ✅ Логирование SQL запросов (EF Core)
- ✅ `projects.service_type` → `projects.service_types` (массив)
- ✅ `lunch_subscriptions` — добавлены поля: start_date, end_date, total_days, total_price, status
- ✅ Исправлен баг freeze лимита (2/неделю теперь работает корректно)
- ✅ Валидация телефонов при создании сотрудников/пользователей

#### Frontend
- ✅ Централизованная обработка ошибок (`lib/errors/index.ts`)
- ✅ Auto-toast для API ошибок через interceptor
- ✅ Frontend Logger (`lib/logger/index.ts`)
- ✅ Inline валидация в формах (phone, email дубликаты)
- ✅ UI "Backend недоступен" с кнопкой "Повторить"
- ✅ Профиль админа теперь read-only
- ✅ Страница сотрудников — новые колонки: График работы, Тип услуги, Статус услуги
- ✅ Гостевой заказ — убран выбор проекта (адрес автоматически из проекта)
- ✅ Исправлен full-screen loading на странице логина

### 2025-12-05 (v1.0)
- ✅ Первый релиз MVP в production
- ✅ Настроены Vercel + Render + Supabase
- ✅ Миграция данных из старой CRM (6 компаний)
- ✅ Создана система Feature Flags

---

## 🛠️ Миграции для PROD

При мерже `develop` → `main` необходимо применить миграции:

```sql
-- 1. Добавить поля в lunch_subscriptions
ALTER TABLE lunch_subscriptions 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Активна',
ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'EVERY_DAY',
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paused_days_count INTEGER DEFAULT 0;

-- 2. Изменить service_type на массив в projects
ALTER TABLE projects 
  ALTER COLUMN service_type DROP DEFAULT,
  ALTER COLUMN service_type TYPE TEXT[] USING ARRAY[service_type];
ALTER TABLE projects 
  ALTER COLUMN service_type SET DEFAULT ARRAY['LUNCH']::TEXT[];
ALTER TABLE projects RENAME COLUMN service_type TO service_types;
```

---

## ⚙️ Переменные окружения

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api
NEXT_PUBLIC_APP_ENV=development  # development | staging | production
```

### Backend (appsettings.json)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=...;Database=...;Username=...;Password=...;SSL Mode=Require"
  },
  "Jwt": {
    "Secret": "минимум-32-символа-секретный-ключ"
  },
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

---

## 🚧 План развития

### Phase 2 (декабрь 2025)
- [ ] Модуль компенсаций (после Client Web)
- [ ] Интеграция с Merchant Lite
- [ ] Аналитика и отчёты

### Phase 3 (январь 2026)
- [ ] Модуль оплат
- [ ] Новости и уведомления
- [ ] Карта партнёров

---

## 🆘 При сбросе контекста

1. Прочитай этот файл
2. Посмотри `docs/API.md` для списка эндпоинтов
3. Вход: `+992901234567` / `admin123`
4. Коды ошибок: `backend/src/YallaBusinessAdmin.Application/Common/Errors/ErrorCodes.cs`
