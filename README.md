# Yalla Business Admin

> 🍽️ B2B платформа для управления корпоративным питанием

## 📋 О проекте

Yalla Business Admin — это комплексная система для управления корпоративными обедами и компенсациями сотрудников. Платформа позволяет компаниям организовать питание для своих сотрудников через подписки на комплексные обеды или систему компенсаций.

## 🏗️ Архитектура

```
├── frontend/          # Next.js 15 + React 19 + TypeScript
├── backend/           # ASP.NET Core 8 Web API
└── docs/              # Документация
```

## ✨ Возможности

### MVP (Production)
- 🔐 **Авторизация** — JWT + Refresh tokens
- 🏢 **Мультипроектность** — Компании с изолированными филиалами и бюджетами
- 👥 **RBAC** — Управление пользователями и ролями
- 👨‍💼 **HR-модуль** — Управление штатом сотрудников
- 🍽️ **Подписки на обеды** — Комплексные обеды (Lunch)
- 📊 **Dashboard** — Операционная панель
- 🛒 **Гостевые заказы** — Разовые заказы без подписки

### Планируется
- 💰 Компенсации (QR-платежи)
- 💳 Модуль оплат
- 📈 Аналитика
- 📰 Новости
- 🤝 Партнёры

## 🚀 Быстрый старт

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
dotnet restore
dotnet run --project src/YallaBusiness.Api
```

## 🔧 Environment Variables

### Frontend (.env.local)
```env
NEXT_PUBLIC_APP_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:5000
NEXT_PUBLIC_SUPABASE_URL=<your_supabase_url>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_supabase_anon_key>
```

### Backend (appsettings.json)
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "<your_connection_string>"
  }
}
```

## 📁 Структура Frontend

```
frontend/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Авторизация
│   ├── (dashboard)/       # Защищённые страницы
│   └── api/               # API routes
├── components/            # React компоненты
│   ├── ui/               # UI kit (shadcn/ui)
│   ├── layout/           # Лейауты
│   └── features/         # Feature flags
├── lib/                   # Утилиты
│   ├── api/              # API клиенты
│   └── features.config.ts # Feature flags
└── hooks/                 # React hooks
```

## 🌍 Окружения

| Окружение | Frontend | Backend | База данных |
|-----------|----------|---------|-------------|
| Development | localhost:3000 | localhost:5000 | Supabase Dev |
| Production | Vercel | Render | Supabase Prod |

## 📄 Лицензия

Proprietary © 2024 Yalla
