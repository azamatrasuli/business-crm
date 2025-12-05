# Деплой

## Frontend (Vercel)

1. Подключите репозиторий на [vercel.com](https://vercel.com)
2. Root Directory: `frontend`
3. Переменные:
   ```
   NEXT_PUBLIC_API_BASE_URL=https://api.yalla.tj/api
   ```

## Backend (.NET)

### Docker

```bash
cd backend
docker build -t yalla-api .
docker run -p 5000:8080 \
  -e ConnectionStrings__DefaultConnection="Host=...;Database=...;Username=...;Password=..." \
  -e Jwt__Secret="your-secret-32-chars" \
  yalla-api
```

### Docker Compose

```yaml
version: '3.8'
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: yalla
      POSTGRES_PASSWORD: password
      POSTGRES_DB: yalla_db
    volumes:
      - pgdata:/var/lib/postgresql/data

  api:
    build: ./backend
    ports:
      - "5000:8080"
    environment:
      ConnectionStrings__DefaultConnection: Host=postgres;Database=yalla_db;Username=yalla;Password=password
      Jwt__Secret: your-super-secret-key-32-chars
    depends_on:
      - postgres

volumes:
  pgdata:
```

### Systemd

```bash
dotnet publish -c Release -o /opt/yalla/api
```

```ini
# /etc/systemd/system/yalla-api.service
[Unit]
Description=Yalla API
After=network.target

[Service]
WorkingDirectory=/opt/yalla/api
ExecStart=/usr/bin/dotnet YallaBusinessAdmin.Api.dll
Restart=always
Environment=ASPNETCORE_URLS=http://localhost:5000
Environment=ConnectionStrings__DefaultConnection=Host=localhost;Database=yalla_db;Username=yalla;Password=password
Environment=Jwt__Secret=your-secret-32-chars

[Install]
WantedBy=multi-user.target
```

## База данных

Схема в `supabase/migrations/`. Применить:

```bash
supabase db push
```
