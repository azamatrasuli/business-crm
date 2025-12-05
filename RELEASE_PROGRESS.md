# 🚀 Production Release Progress

> Этот файл отслеживает прогресс подготовки к production релизу.
> Если контекст чата сбросится — читай этот файл чтобы понять где мы.

## Статус: 🟡 В процессе

**Дата начала:** 2025-01-05  
**Цель:** MVP релиз с Lunch функционалом (без Compensation)

---

## 📋 Чеклист

### Phase 1: Feature Flags System ✅
- [x] `frontend/lib/features.config.ts` — конфиг фич
- [x] `frontend/components/features/feature-gate.tsx` — компонент-обёртка
- [x] `frontend/components/features/coming-soon-page.tsx` — заглушка "Скоро"
- [ ] `backend/.../Features/FeatureFlags.cs` — бэкенд конфиг (опционально)

### Phase 2: UI Blocking (Production) ✅
- [x] Sidebar — показывать заблокированные пункты с badge "Скоро"
- [x] `/payments` — заблокировать страницу
- [x] `/analytics` — заблокировать страницу
- [x] `/news` — заблокировать страницу
- [x] `/partners` — заблокировать страницу
- [x] Dashboard — убрать кнопку "Управлять компенсациями"
- [x] Dashboard — скрыть колонку serviceType (все LUNCH)
- [x] Employees — скрыть кнопку компенсации

### Phase 3: Environment Configs 🟡
- [x] Документация по .env переменным (см. секцию ниже)
- [ ] `frontend/.env.production` — создать при деплое в Vercel
- [ ] `frontend/.env.staging` — создать при деплое в Vercel
- [ ] `backend/appsettings.Production.json` — создать при деплое в Render

### Phase 4: Infrastructure (требует действий пользователя)
- [ ] Supabase — создать production проект
- [ ] Vercel — создать аккаунт и подключить репозиторий
- [ ] Render — создать аккаунт и подключить репозиторий
- [ ] GitHub — настроить branch protection rules

### Phase 5: Git & Deployment
- [ ] Создать ветку `develop` от `main`
- [ ] Push обе ветки на GitHub
- [ ] Настроить Vercel deployments (main → prod, develop → staging)
- [ ] Настроить Render deployments (main → prod, develop → staging)

### Phase 6: Data Migration
- [ ] Получить SQL dump из CRM
- [ ] Проанализировать структуру данных
- [ ] Написать скрипт миграции
- [ ] Импортировать в production БД
- [ ] Создать admin пользователей для клиентов

---

## 🔑 Credentials (заполнить когда будут готовы)

### Supabase Production
```
URL: ___
Anon Key: ___
Service Role Key: ___
Database Password: ___
Connection String: ___
```

### Vercel
```
Project URL (prod): ___
Project URL (staging): ___
```

### Render
```
Backend URL (prod): ___
Backend URL (staging): ___
```

---

## ⚙️ Environment Variables

### Frontend (.env)
Создайте файлы `.env.local` / `.env.production` / `.env.staging`:

```bash
# API Configuration
# Development: http://localhost:5000/api
# Staging: https://yalla-business-api-staging.onrender.com/api
# Production: https://yalla-business-api.onrender.com/api
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api

# App Environment (determines feature flags)
# development | staging | production
NEXT_PUBLIC_APP_ENV=development
```

### Backend (appsettings.Production.json)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=<PROD_HOST>;Port=5432;Database=postgres;Username=<USER>;Password=<PASSWORD>;SSL Mode=Require"
  },
  "Jwt": {
    "Secret": "<SECURE_PRODUCTION_SECRET_MIN_32_CHARS>"
  },
  "FrontendUrl": "https://<PROD_FRONTEND_URL>",
  "SeedOnStartup": false
}
```

### Vercel Environment Variables
В настройках проекта Vercel добавить:
- `NEXT_PUBLIC_API_BASE_URL` - URL бэкенда
- `NEXT_PUBLIC_APP_ENV` - `production` или `staging`

### Render Environment Variables
В настройках сервиса Render добавить:
- `ASPNETCORE_ENVIRONMENT` - `Production`
- `ConnectionStrings__DefaultConnection` - connection string к Supabase
- `Jwt__Secret` - секретный ключ для JWT

---

## 📝 Решения по проекту

### Что включено в MVP (Production):
- ✅ Авторизация и профиль
- ✅ Проекты (филиалы)
- ✅ Пользователи B2B кабинета (RBAC)
- ✅ Сотрудники (HR модуль)
- ✅ Подписки на обеды (Lunch)
- ✅ Dashboard с заказами
- ✅ Гостевые заказы

### Что заблокировано (Phase 2):
- 🚫 Компенсации (Compensation) — ждём Client Web + Merchant Lite
- 🚫 Оплаты (Payments)
- 🚫 Аналитика (Analytics)
- 🚫 Новости (News)
- 🚫 Партнёры (Partners)

### Подход к Feature Flags:
- Используем конфиг-файл `features.config.ts`
- Environment variable `NEXT_PUBLIC_APP_ENV` определяет режим
- В `production` — только MVP фичи
- В `staging/development` — все фичи включены

---

## 📅 Лог обновлений

### 2025-12-05 (сегодня)
- ✅ Создан файл прогресса `RELEASE_PROGRESS.md`
- ✅ Phase 1: Feature Flags System
  - Создан `frontend/lib/features.config.ts`
  - Создан `frontend/components/features/feature-gate.tsx`
  - Создан `frontend/components/features/coming-soon-page.tsx`
- ✅ Phase 2: UI Blocking
  - Обновлён sidebar с badge "Скоро" для заблокированных страниц
  - Страницы `/payments`, `/analytics`, `/news`, `/partners` показывают ComingSoonPage
  - Dashboard: скрыта кнопка "Управлять компенсациями" и колонка serviceType
  - Employees: скрыта кнопка управления компенсациями
- 🟡 Phase 3: Документация по environment variables готова
- ⏳ Ждём: Supabase prod, Vercel/Render аккаунты, SQL dump из CRM

---

## 🆘 Если контекст сбросился

1. Прочитай этот файл целиком
2. Посмотри чеклист — что уже сделано (отмечено [x])
3. Продолжай с первого незавершённого пункта
4. Обнови этот файл когда закончишь задачу

