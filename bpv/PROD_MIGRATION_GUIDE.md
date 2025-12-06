# 🚀 Гайд по миграции на Production

## Дата: 6 декабря 2024
## Версия: develop → main

---

## ⚠️ КРИТИЧНО: Выполнять в указанном порядке!

### Шаг 1: Применить миграции БД (ПЕРВЫМ!)

Подключиться к **PROD базе** и выполнить:

```sql
-- ═══════════════════════════════════════════════════════════════
-- МИГРАЦИЯ 1: Добавить поля в lunch_subscriptions
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE lunch_subscriptions 
ADD COLUMN IF NOT EXISTS start_date DATE,
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS total_days INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_price NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Активна',
ADD COLUMN IF NOT EXISTS schedule_type TEXT DEFAULT 'EVERY_DAY',
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS paused_days_count INTEGER DEFAULT 0;

COMMENT ON COLUMN lunch_subscriptions.start_date IS 'Дата начала подписки';
COMMENT ON COLUMN lunch_subscriptions.end_date IS 'Дата окончания подписки';
COMMENT ON COLUMN lunch_subscriptions.total_days IS 'Общее количество дней подписки';
COMMENT ON COLUMN lunch_subscriptions.total_price IS 'Общая стоимость подписки';
COMMENT ON COLUMN lunch_subscriptions.status IS 'Статус: Активна, Приостановлена, Завершена';
COMMENT ON COLUMN lunch_subscriptions.schedule_type IS 'Тип графика: EVERY_DAY, EVERY_OTHER_DAY, CUSTOM';

-- ═══════════════════════════════════════════════════════════════
-- МИГРАЦИЯ 2: Изменить service_type на массив в projects
-- ═══════════════════════════════════════════════════════════════
ALTER TABLE projects 
  ALTER COLUMN service_type DROP DEFAULT,
  ALTER COLUMN service_type TYPE TEXT[] USING ARRAY[service_type];

ALTER TABLE projects 
  ALTER COLUMN service_type SET DEFAULT ARRAY['LUNCH']::TEXT[];

ALTER TABLE projects RENAME COLUMN service_type TO service_types;

COMMENT ON COLUMN projects.service_types IS 'Типы услуг проекта: массив из LUNCH и/или COMPENSATION';

-- ═══════════════════════════════════════════════════════════════
-- ПРОВЕРКА: Убедиться что миграции применены
-- ═══════════════════════════════════════════════════════════════
SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'lunch_subscriptions' 
  AND column_name IN ('start_date', 'end_date', 'total_days', 'total_price', 'status');

SELECT 
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'projects' 
  AND column_name = 'service_types';
```

### Шаг 2: Заполнить данные подписок (опционально)

Если нужно заполнить существующие подписки датами:

```sql
-- Заполняем подписки которые не имеют дат
UPDATE lunch_subscriptions
SET 
  start_date = CURRENT_DATE - INTERVAL '5 days',
  end_date = CURRENT_DATE + INTERVAL '25 days',
  total_days = 30,
  total_price = CASE 
    WHEN combo_type = 'Комбо 25' THEN 1350.00
    WHEN combo_type = 'Комбо 35' THEN 1890.00
    ELSE 1350.00
  END,
  status = CASE 
    WHEN is_active = true THEN 'Активна'
    ELSE 'Приостановлена'
  END,
  schedule_type = 'EVERY_DAY'
WHERE start_date IS NULL OR end_date IS NULL;
```

### Шаг 3: Merge develop → main

```bash
git checkout main
git pull origin main
git merge develop
git push origin main
```

### Шаг 4: Дождаться деплоев

1. **Vercel** (frontend) — автоматически при push в main
2. **Render** (backend) — автоматически при push в main

### Шаг 5: Проверить работоспособность

- [ ] Логин работает
- [ ] Страница сотрудников загружается
- [ ] Профиль отображается (read-only)
- [ ] Типы услуг проекта показываются как бейджи

---

## 📝 Список изменений

### Backend
| Файл | Изменение |
|------|-----------|
| `LunchSubscription.cs` | +8 новых полей (dates, price, status) |
| `Project.cs` | `ServiceType` → `ServiceTypes` (array) |
| `AppDbContext.cs` | Маппинг новых колонок |
| `ProjectsService.cs` | Работа с массивом serviceTypes |
| `EmployeesService.cs` | Fallback на serviceTypes |
| `CompensationService.cs` | `.Contains("COMPENSATION")` |
| `AuthService.cs` | +projectServiceTypes в ответах |
| DTOs | serviceType → serviceTypes везде |

### Frontend
| Файл | Изменение |
|------|-----------|
| `profile/page.tsx` | Read-only профиль админа |
| `auth-store.ts` | +projectServiceTypes |
| `projects-store.ts` | serviceTypes массив |
| `employees-store.ts` | Улучшенная обработка ошибок |
| `home-store.ts` | Улучшенная обработка ошибок |
| `employees/page.tsx` | UI ошибок с кнопкой "Повторить" |
| `page.tsx` (home) | UI ошибок с кнопкой "Повторить" |

---

## 🔄 Откат (если что-то пошло не так)

```sql
-- Откат service_types обратно в service_type
ALTER TABLE projects RENAME COLUMN service_types TO service_type;
ALTER TABLE projects 
  ALTER COLUMN service_type TYPE TEXT USING service_type[1];
ALTER TABLE projects 
  ALTER COLUMN service_type SET DEFAULT 'LUNCH';
```

---

## ✅ Чек-лист после деплоя

- [ ] БД миграции применены
- [ ] Backend деплой завершён (Render)
- [ ] Frontend деплой завершён (Vercel)
- [ ] Тест логина
- [ ] Тест страницы сотрудников
- [ ] Тест профиля (должен быть read-only)
- [ ] Тест создания/редактирования сотрудника

