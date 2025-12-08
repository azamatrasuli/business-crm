#!/bin/bash
# ===========================================
# Yalla Business Admin - Development Launcher
# ===========================================
# 
# СТАНДАРТНЫЕ ПОРТЫ:
#   Backend:  http://localhost:4000
#   Frontend: http://localhost:3000
#
# Использование:
#   ./dev.sh              - запустить всё (development mode)
#   ./dev.sh prod         - запустить с production feature flags
#   ./dev.sh wifi         - запустить с WiFi доступом
#   ./dev.sh prod wifi    - production + WiFi
#   ./dev.sh backend      - только backend
#   ./dev.sh frontend     - только frontend  
#   ./dev.sh frontend prod- frontend в prod режиме
#   ./dev.sh stop         - остановить всё
#
# Режимы:
#   dev (default)  - все feature flags включены
#   prod           - feature flags из config.json (как в продакшене)
# ===========================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=4000
FRONTEND_PORT=3000
WIFI_MODE=false
PROD_MODE=false

# Цвета
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

log_info() { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Парсим аргументы
for arg in "$@"; do
    case "$arg" in
        wifi|--wifi|-w)
            WIFI_MODE=true
            ;;
        prod|--prod|-p|production)
            PROD_MODE=true
            ;;
    esac
done

stop_services() {
    log_info "Останавливаю сервисы..."
    pkill -f "dotnet.*YallaBusinessAdmin" 2>/dev/null
    pkill -f "next-server" 2>/dev/null
    lsof -ti:$BACKEND_PORT | xargs kill -9 2>/dev/null
    lsof -ti:$FRONTEND_PORT | xargs kill -9 2>/dev/null
    sleep 2
    log_success "Сервисы остановлены"
}

start_backend() {
    log_info "Запускаю Backend на порту $BACKEND_PORT..."
    cd "$SCRIPT_DIR/backend"
    export PATH="$PATH:/usr/local/share/dotnet"
    dotnet run --project src/YallaBusinessAdmin.Api --launch-profile Development &
    sleep 5
    if curl -s http://localhost:$BACKEND_PORT/api/auth/login -X POST -H "Content-Type: application/json" -d '{}' >/dev/null 2>&1; then
        log_success "Backend запущен: http://localhost:$BACKEND_PORT"
    else
        log_warn "Backend запускается... подождите"
    fi
}

start_frontend() {
    log_info "Запускаю Frontend на порту $FRONTEND_PORT..."
    cd "$SCRIPT_DIR/frontend"
    
    # Собираем команду
    local cmd="npm run dev"
    local env_vars=""
    
    # Production режим (feature flags из config.json)
    if [ "$PROD_MODE" = true ]; then
        env_vars="NEXT_PUBLIC_APP_ENV=production"
        log_info "🏭 Production mode - feature flags из config.json"
    else
        log_info "🔧 Development mode - все feature flags включены"
    fi
    
    # WiFi режим
    if [ "$WIFI_MODE" = true ]; then
        cmd="$cmd -- --hostname 0.0.0.0"
        log_info "📶 WiFi режим включен - доступ из сети"
    fi
    
    # Запускаем с env переменными
    if [ -n "$env_vars" ]; then
        env $env_vars $cmd &
    else
        $cmd &
    fi
    
    sleep 3
    log_success "Frontend запущен: http://localhost:$FRONTEND_PORT"
}

show_info() {
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    if [ "$PROD_MODE" = true ]; then
        echo -e "${GREEN}  Yalla Business Admin - ${PURPLE}PRODUCTION${GREEN}${NC}"
    else
        echo -e "${GREEN}  Yalla Business Admin - ${BLUE}DEVELOPMENT${GREEN}${NC}"
    fi
    if [ "$WIFI_MODE" = true ]; then
        echo -e "${YELLOW}  📶 WiFi Mode${NC}"
    fi
    echo -e "${GREEN}=========================================${NC}"
    echo ""
    echo -e "  ${BLUE}Backend:${NC}  http://localhost:$BACKEND_PORT"
    echo -e "  ${BLUE}Frontend:${NC} http://localhost:$FRONTEND_PORT"
    echo ""
    
    # Режим работы
    if [ "$PROD_MODE" = true ]; then
        echo -e "  ${PURPLE}🏭 Mode:${NC} Production (feature flags из config.json)"
        echo -e "     - compensation: disabled"
        echo -e "     - passwordReset: disabled"
    else
        echo -e "  ${BLUE}🔧 Mode:${NC} Development (все feature flags ON)"
    fi
    echo ""
    
    # Показываем WiFi адрес только если включен WiFi режим
    if [ "$WIFI_MODE" = true ]; then
        LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}')
        if [ -n "$LOCAL_IP" ]; then
            echo -e "  ${YELLOW}📱 Network:${NC} http://$LOCAL_IP:$FRONTEND_PORT"
        fi
        echo ""
    fi
    
    echo -e "  ${BLUE}Логин:${NC} +992901234567 / admin123"
    echo ""
    echo -e "${GREEN}=========================================${NC}"
    echo ""
}

# Получаем первый аргумент (команду)
CMD="$1"

# Если первый аргумент это флаг (wifi/prod), то команда - запуск всего
case "$CMD" in
    wifi|--wifi|-w|prod|--prod|-p|production)
        CMD="all"
        ;;
esac

case "$CMD" in
    stop)
        stop_services
        ;;
    backend)
        stop_services
        start_backend
        show_info
        wait
        ;;
    frontend)
        stop_services
        start_frontend
        show_info
        wait
        ;;
    dev)
        # Явно development режим
        PROD_MODE=false
        stop_services
        start_backend
        start_frontend
        show_info
        wait
        ;;
    *)
        # По умолчанию или "all"
        stop_services
        start_backend
        start_frontend
        show_info
        wait
        ;;
esac
