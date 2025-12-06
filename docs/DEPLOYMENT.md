# Руководство по деплою

## Текущая инфраструктура

| Сервис | Провайдер | Описание |
|--------|-----------|----------|
| Frontend | Vercel | Next.js + автодеплой из GitHub |
| Backend | Render | Docker + ASP.NET Core |
| База данных | Supabase | PostgreSQL 15 |
| Репозиторий | GitHub | `azamatrasuli/business-crm` |

---

## Frontend (Vercel)

### Автоматический деплой

1. Подключите репозиторий на [vercel.com](https://vercel.com)
2. Root Directory: `frontend`
3. Framework Preset: Next.js
4. Настройте переменные окружения:

```
NEXT_PUBLIC_API_BASE_URL=https://business-crm-iu04.onrender.com/api
NEXT_PUBLIC_APP_ENV=production
```

### Ветки
- `main` → production
- `develop` → staging (preview)

### Deployment Protection

По умолчанию Vercel защищает preview деплои авторизацией. Чтобы отключить:
1. Project Settings → General → Deployment Protection
2. Vercel Authentication → Only Production (или отключить)

---

## Backend (Render)

### Docker деплой

1. Создайте Web Service на [render.com](https://render.com)
2. Source: GitHub репозиторий
3. Root Directory: `backend`
4. Runtime: Docker
5. Branch: `main` (production) или `develop` (staging)

### Переменные окружения

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Host=...;Port=5432;Database=postgres;Username=...;Password=...;SSL Mode=Require;Trust Server Certificate=true
Jwt__Secret=ваш-секретный-ключ-минимум-32-символа
FrontendUrl=https://yalla-business-crm.vercel.app
```

### Локальный Docker

```bash
cd backend
docker build -t yalla-api .
docker run -p 5000:8080 \
  -e ConnectionStrings__DefaultConnection="Host=localhost;Database=yalla;Username=postgres;Password=..." \
  -e Jwt__Secret="your-secret-key-32-chars-minimum" \
  yalla-api
```

---

## База данных (Supabase)

### Проекты

| Среда | Project ID | Регион |
|-------|------------|--------|
| Production | `qwkpqbfldvuxcxugxcmj` | West EU |
| Development | `psuiiifwntvjhuzxronr` | West EU |

### Миграции

Миграции применяются через Supabase SQL Editor или MCP.

**Пример миграции:**
```sql
-- Добавление новой колонки
ALTER TABLE employees 
ADD COLUMN IF NOT EXISTS department TEXT;
```

### Актуальная схема БД

#### projects
```sql
service_types TEXT[] DEFAULT ARRAY['LUNCH']::TEXT[]
```

#### employees
```sql
service_type TEXT DEFAULT 'LUNCH'
```

#### lunch_subscriptions
```sql
start_date DATE,
end_date DATE,
total_days INTEGER DEFAULT 0,
total_price NUMERIC(10,2) DEFAULT 0,
status TEXT DEFAULT 'Активна',
schedule_type TEXT DEFAULT 'EVERY_DAY',
paused_at TIMESTAMP WITH TIME ZONE,
paused_days_count INTEGER DEFAULT 0
```

---

## Docker Compose (локальная разработка)

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: yalla
      POSTGRES_PASSWORD: password
      POSTGRES_DB: yalla_db
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./backend
    ports:
      - "5000:8080"
    environment:
      ConnectionStrings__DefaultConnection: Host=postgres;Database=yalla_db;Username=yalla;Password=password
      Jwt__Secret: development-secret-key-32-chars
      ASPNETCORE_ENVIRONMENT: Development
    depends_on:
      - postgres

volumes:
  pgdata:
```

Запуск:
```bash
docker-compose up -d
```

---

## CI/CD

### GitHub Actions (опционально)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main, develop]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./frontend
```

---

## Мониторинг

### Render
- Логи: Dashboard → Logs
- Метрики: Dashboard → Metrics

### Vercel
- Логи: Dashboard → Deployments → View Function Logs
- Analytics: Dashboard → Analytics

### Supabase
- Логи: Dashboard → Database → Logs
- Метрики: Dashboard → Reports

---

## Процесс релиза (develop → main)

### 1. Применить миграции БД (PROD)

```sql
-- Проверить что миграции не применены
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'projects' AND column_name = 'service_types';

-- Если пусто — применить миграции
-- (см. актуальные миграции в разделе "Актуальная схема БД")
```

### 2. Merge в main

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

### 3. Дождаться деплоев

- Vercel: ~2 мин
- Render: ~5 мин

### 4. Проверить работоспособность

- [ ] Логин работает
- [ ] Dashboard загружается
- [ ] Сотрудники отображаются
- [ ] Создание сотрудника работает
- [ ] Профиль read-only

---

## Troubleshooting

### Backend не стартует на Render

1. Проверьте логи в Render Dashboard
2. Убедитесь, что `ConnectionStrings__DefaultConnection` корректный
3. Проверьте SSL режим: `SSL Mode=Require;Trust Server Certificate=true`

### Frontend не видит API

1. Проверьте `NEXT_PUBLIC_API_BASE_URL`
2. Убедитесь, что CORS настроен на бэкенде
3. Проверьте, что API доступен: `curl https://business-crm-iu04.onrender.com/api/health`

### Ошибки БД

1. Проверьте подключение через Supabase Dashboard → SQL Editor
2. Убедитесь, что миграции применены
3. Проверьте права пользователя

### Frontend показывает "Backend недоступен"

1. Убедитесь что Render сервис запущен
2. Проверьте логи на Render
3. Попробуйте `curl` к API напрямую
