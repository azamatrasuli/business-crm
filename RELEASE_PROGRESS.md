# 🚀 Production Release Progress

> Этот файл отслеживает прогресс подготовки к production релизу.
> Если контекст чата сбросится — читай этот файл чтобы понять где мы.

## Статус: ✅ ГОТОВО К РЕЛИЗУ

**Дата начала:** 2025-12-05  
**Дата готовности:** 2025-12-05  
**Цель:** MVP релиз с Lunch функционалом (без Compensation)

---

## 📋 Чеклист

### Phase 1: Feature Flags System ✅
- [x] `frontend/lib/features.config.ts` — конфиг фич
- [x] `frontend/components/features/feature-gate.tsx` — компонент-обёртка
- [x] `frontend/components/features/coming-soon-page.tsx` — заглушка "Скоро"

### Phase 2: UI Blocking (Production) ✅
- [x] Sidebar — показывать заблокированные пункты с badge "Скоро"
- [x] `/payments` — заблокировать страницу
- [x] `/analytics` — заблокировать страницу
- [x] `/news` — заблокировать страницу
- [x] `/partners` — заблокировать страницу
- [x] Dashboard — убрать кнопку "Управлять компенсациями"
- [x] Dashboard — скрыть колонку serviceType (все LUNCH)
- [x] Employees — скрыть кнопку компенсации

### Phase 3: Environment Configs ✅
- [x] Документация по .env переменным (см. секцию ниже)
- [x] Vercel env vars настроены (NEXT_PUBLIC_APP_ENV=production)
- [x] Render env vars настроены (Database URL, JWT Secret)

### Phase 4: Infrastructure ✅
- [x] Supabase — production проект создан (qwkpqbfldvuxcxugxcmj)
- [x] Vercel — деплой работает (business-crm-git-main-azamatrasuli-protonmes-projects.vercel.app)
- [x] Render — деплой работает (business-crm-iu04.onrender.com)
- [x] GitHub — репозиторий создан (azamatrasuli/business-crm)

### Phase 5: Git & Deployment ✅
- [x] Push main на GitHub
- [x] Создать ветку `develop` для тестовой среды
- [x] Настроить Vercel preview deployments (develop → staging)
- [x] Настроить Render staging service (business-crm-staging.onrender.com)

### Phase 6: Data Migration ✅
- [x] Получены credentials от CRM (yalla-lunch)
- [x] Проанализирована структура: companies, payment_operations, contacts
- [x] Мигрированы компании (6 активных) с проектами и транзакциями
- [x] Создан супер-админ (admin@yalla.tj / admin123)

---

## 🔑 Credentials & URLs

### 🔴 Production Environment
| Сервис | URL |
|--------|-----|
| Frontend | https://business-crm-git-main-azamatrasuli-protonmes-projects.vercel.app |
| Backend API | https://business-crm-iu04.onrender.com |
| Database | Supabase `qwkpqbfldvuxcxugxcmj` |

### 🟡 Staging Environment
| Сервис | URL |
|--------|-----|
| Frontend | https://business-crm-git-develop-azamatrasuli-protonmes-projects.vercel.app |
| Backend API | https://business-crm-staging.onrender.com |
| Database | Supabase `psuiiifwntvjhuzxronr` |

### 🔐 Учётные данные (Production)
```
Email: admin@yalla.tj
Password: admin123
```

### GitHub Repository
```
https://github.com/azamatrasuli/business-crm
Branches: main (production), develop (staging)
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

### 2025-12-05
- ✅ Phase 1-2: Feature Flags + UI Blocking
- ✅ Phase 3: Environment конфиги для Vercel/Render
- ✅ Phase 4: Infrastructure (Supabase, Vercel, Render, GitHub)
- ✅ Phase 5: Git branching (main + develop) + staging окружения
- ✅ Phase 6: Миграция данных из Yalla CRM
  - Мигрированы: 6 компаний, проекты, транзакции
  - Создан супер-админ: admin@yalla.tj

---

## 🚀 Следующие шаги (Post-Release)

### Готово к релизу — можно начинать!
1. [ ] **E2E тестирование** — протестировать все MVP сценарии
2. [ ] **Кастомный домен** — настроить business.yalla.tj
3. [ ] **SSL сертификаты** — проверить HTTPS
4. [ ] **Мониторинг** — настроить алерты на ошибки

### Phase 2 (следующая неделя)
1. [ ] Compensation функционал — включить после готовности Client Web + Merchant Lite
2. [ ] Payments / Analytics / News / Partners — по мере готовности

---

## 🆘 Если контекст сбросился

1. Прочитай этот файл целиком
2. Все фазы завершены — проект готов к релизу!
3. Для доступа: admin@yalla.tj / admin123

