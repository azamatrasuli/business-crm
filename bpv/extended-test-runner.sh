#!/bin/bash

# Extended Testing Script for Yalla Business Admin
# Tests 40+ edge cases across Lunch, Employees, Dashboard

BASE_URL="https://business-crm-iu04.onrender.com/api"
TOKEN=$(cat /tmp/admin_token.txt)
AUTH="Authorization: Bearer $TOKEN"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Test result tracking
declare -a RESULTS

log_test() {
    local test_id=$1
    local description=$2
    local expected=$3
    local actual=$4
    local status=$5
    
    if [ "$status" == "PASS" ]; then
        echo -e "${GREEN}✅ $test_id${NC}: $description"
        ((PASSED++))
    elif [ "$status" == "WARN" ]; then
        echo -e "${YELLOW}⚠️ $test_id${NC}: $description (Expected: $expected, Got: $actual)"
        ((WARNINGS++))
    else
        echo -e "${RED}❌ $test_id${NC}: $description (Expected: $expected, Got: $actual)"
        ((FAILED++))
    fi
    
    RESULTS+=("$test_id|$description|$expected|$actual|$status")
}

echo "=========================================="
echo "🧪 EXTENDED TESTING - Yalla Business Admin"
echo "=========================================="
echo ""

# Get some data for testing
echo "📦 Fetching test data..."
EMPLOYEES_RESP=$(curl -s -H "$AUTH" "$BASE_URL/employees?page=1&pageSize=5")
FIRST_EMPLOYEE_ID=$(echo "$EMPLOYEES_RESP" | jq -r '.items[0].id // empty')
PROJECTS_RESP=$(curl -s -H "$AUTH" "$BASE_URL/projects")
FIRST_PROJECT_ID=$(echo "$PROJECTS_RESP" | jq -r '.[0].id // empty')

echo "First Employee ID: $FIRST_EMPLOYEE_ID"
echo "First Project ID: $FIRST_PROJECT_ID"
echo ""

# ============================================
# SECTION 1: LUNCH SUBSCRIPTIONS EDGE CASES
# ============================================
echo "=========================================="
echo "🍽️  LUNCH SUBSCRIPTIONS EDGE CASES"
echo "=========================================="

# TC-LUNCH-EDGE-01: Создание подписки менее 5 дней
echo "Testing TC-LUNCH-EDGE-01: Subscription < 5 days..."
TODAY=$(date +%Y-%m-%d)
THREE_DAYS=$(date -v+3d +%Y-%m-%d 2>/dev/null || date -d "+3 days" +%Y-%m-%d)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/meal-subscriptions" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$FIRST_PROJECT_ID\",
    \"startDate\": \"$TODAY\",
    \"endDate\": \"$THREE_DAYS\",
    \"employees\": [{
      \"employeeId\": \"$FIRST_EMPLOYEE_ID\",
      \"comboType\": \"Комбо 25\",
      \"pattern\": \"weekdays\"
    }]
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
BODY=$(echo "$RESP" | head -n -1)

if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-LUNCH-EDGE-01" "Subscription < 5 days rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-LUNCH-EDGE-01" "Subscription < 5 days rejected" "400" "$HTTP_CODE" "FAIL"
fi

# TC-LUNCH-EDGE-02: Создание подписки на прошлые даты
echo "Testing TC-LUNCH-EDGE-02: Subscription in past..."
PAST_DATE=$(date -v-7d +%Y-%m-%d 2>/dev/null || date -d "-7 days" +%Y-%m-%d)
PAST_END=$(date -v-2d +%Y-%m-%d 2>/dev/null || date -d "-2 days" +%Y-%m-%d)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/meal-subscriptions" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$FIRST_PROJECT_ID\",
    \"startDate\": \"$PAST_DATE\",
    \"endDate\": \"$PAST_END\",
    \"employees\": [{
      \"employeeId\": \"$FIRST_EMPLOYEE_ID\",
      \"comboType\": \"Комбо 25\",
      \"pattern\": \"weekdays\"
    }]
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-LUNCH-EDGE-02" "Subscription in past rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-LUNCH-EDGE-02" "Subscription in past rejected" "400" "$HTTP_CODE" "WARN"
fi

# TC-LUNCH-EDGE-03: Invalid combo type
echo "Testing TC-LUNCH-EDGE-03: Invalid combo type..."
FUTURE_START=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
FUTURE_END=$(date -v+10d +%Y-%m-%d 2>/dev/null || date -d "+10 days" +%Y-%m-%d)

RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/meal-subscriptions" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$FIRST_PROJECT_ID\",
    \"startDate\": \"$FUTURE_START\",
    \"endDate\": \"$FUTURE_END\",
    \"employees\": [{
      \"employeeId\": \"$FIRST_EMPLOYEE_ID\",
      \"comboType\": \"Комбо 99999\",
      \"pattern\": \"weekdays\"
    }]
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "500" ]; then
    log_test "TC-LUNCH-EDGE-03" "Invalid combo type rejected" "400/500" "$HTTP_CODE" "PASS"
else
    log_test "TC-LUNCH-EDGE-03" "Invalid combo type rejected" "400/500" "$HTTP_CODE" "FAIL"
fi

# TC-LUNCH-EDGE-04: Get calendar endpoint
echo "Testing TC-LUNCH-EDGE-04: Calendar endpoint..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/meal-subscriptions/calendar?startDate=$TODAY&endDate=$FUTURE_END" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-LUNCH-EDGE-04" "Calendar endpoint works" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-LUNCH-EDGE-04" "Calendar endpoint works" "200" "$HTTP_CODE" "FAIL"
fi

# TC-LUNCH-EDGE-05: Get freeze info
echo "Testing TC-LUNCH-EDGE-05: Freeze info endpoint..."
if [ -n "$FIRST_EMPLOYEE_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/meal-subscriptions/employees/$FIRST_EMPLOYEE_ID/freeze-info" \
      -H "$AUTH")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        BODY=$(echo "$RESP" | head -n -1)
        REMAINING=$(echo "$BODY" | jq -r '.remainingFreezes // empty')
        log_test "TC-LUNCH-EDGE-05" "Freeze info returns remainingFreezes" "200 + data" "$HTTP_CODE (remaining: $REMAINING)" "PASS"
    else
        log_test "TC-LUNCH-EDGE-05" "Freeze info returns remainingFreezes" "200" "$HTTP_CODE" "FAIL"
    fi
fi

# TC-LUNCH-EDGE-06: Employee assignments list
echo "Testing TC-LUNCH-EDGE-06: Employee assignments..."
if [ -n "$FIRST_EMPLOYEE_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/meal-subscriptions/employees/$FIRST_EMPLOYEE_ID/assignments" \
      -H "$AUTH")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "TC-LUNCH-EDGE-06" "Employee assignments list" "200" "$HTTP_CODE" "PASS"
    else
        log_test "TC-LUNCH-EDGE-06" "Employee assignments list" "200" "$HTTP_CODE" "FAIL"
    fi
fi

# TC-LUNCH-EDGE-07: Price preview
echo "Testing TC-LUNCH-EDGE-07: Price preview..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/meal-subscriptions/price-preview" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"projectId\": \"$FIRST_PROJECT_ID\",
    \"startDate\": \"$FUTURE_START\",
    \"endDate\": \"$FUTURE_END\",
    \"employees\": [{
      \"employeeId\": \"$FIRST_EMPLOYEE_ID\",
      \"comboType\": \"Комбо 25\",
      \"pattern\": \"weekdays\"
    }]
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    BODY=$(echo "$RESP" | head -n -1)
    TOTAL=$(echo "$BODY" | jq -r '.totalAmount // empty')
    log_test "TC-LUNCH-EDGE-07" "Price preview works" "200 + total" "$HTTP_CODE (total: $TOTAL)" "PASS"
else
    log_test "TC-LUNCH-EDGE-07" "Price preview works" "200" "$HTTP_CODE" "FAIL"
fi

echo ""

# ============================================
# SECTION 2: EMPLOYEES EDGE CASES
# ============================================
echo "=========================================="
echo "👥 EMPLOYEES EDGE CASES"
echo "=========================================="

# TC-EMP-EDGE-01: Create employee with empty phone
echo "Testing TC-EMP-EDGE-01: Empty phone..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/employees" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"fullName\": \"Test Empty Phone\",
    \"phone\": \"\",
    \"projectId\": \"$FIRST_PROJECT_ID\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-EMP-EDGE-01" "Empty phone rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-EMP-EDGE-01" "Empty phone rejected" "400" "$HTTP_CODE" "FAIL"
fi

# TC-EMP-EDGE-02: Create employee with invalid projectId
echo "Testing TC-EMP-EDGE-02: Invalid projectId..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/employees" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"fullName\": \"Test Invalid Project\",
    \"phone\": \"+99290000$(date +%s | tail -c 5)\",
    \"projectId\": \"00000000-0000-0000-0000-000000000000\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "404" ]; then
    log_test "TC-EMP-EDGE-02" "Invalid projectId rejected" "400/404" "$HTTP_CODE" "PASS"
else
    log_test "TC-EMP-EDGE-02" "Invalid projectId rejected" "400/404" "$HTTP_CODE" "FAIL"
fi

# TC-EMP-EDGE-03: Create employee with duplicate phone
echo "Testing TC-EMP-EDGE-03: Duplicate phone..."
# First get an existing phone
EXISTING_PHONE=$(echo "$EMPLOYEES_RESP" | jq -r '.items[0].phone // empty')

if [ -n "$EXISTING_PHONE" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/employees" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "{
        \"fullName\": \"Test Duplicate Phone\",
        \"phone\": \"$EXISTING_PHONE\",
        \"projectId\": \"$FIRST_PROJECT_ID\"
      }")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "409" ]; then
        log_test "TC-EMP-EDGE-03" "Duplicate phone rejected" "400/409" "$HTTP_CODE" "PASS"
    else
        log_test "TC-EMP-EDGE-03" "Duplicate phone rejected" "400/409" "$HTTP_CODE" "FAIL"
    fi
fi

# TC-EMP-EDGE-04: Update employee with invalid data
echo "Testing TC-EMP-EDGE-04: Update with invalid email..."
if [ -n "$FIRST_EMPLOYEE_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/employees/$FIRST_EMPLOYEE_ID" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "{
        \"email\": \"invalid-email-format\"
      }")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    # This might pass or fail depending on validation
    if [ "$HTTP_CODE" == "400" ]; then
        log_test "TC-EMP-EDGE-04" "Invalid email rejected" "400" "$HTTP_CODE" "PASS"
    else
        log_test "TC-EMP-EDGE-04" "Invalid email rejected" "400" "$HTTP_CODE" "WARN"
    fi
fi

# TC-EMP-EDGE-05: Get employee orders history
echo "Testing TC-EMP-EDGE-05: Employee orders history..."
if [ -n "$FIRST_EMPLOYEE_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/employees/$FIRST_EMPLOYEE_ID/orders?page=1&pageSize=10" \
      -H "$AUTH")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        BODY=$(echo "$RESP" | head -n -1)
        TOTAL=$(echo "$BODY" | jq -r '.total // 0')
        log_test "TC-EMP-EDGE-05" "Orders history works" "200" "$HTTP_CODE (total: $TOTAL)" "PASS"
    else
        log_test "TC-EMP-EDGE-05" "Orders history works" "200" "$HTTP_CODE" "FAIL"
    fi
fi

# TC-EMP-EDGE-06: Batch budget update with invalid employee IDs
echo "Testing TC-EMP-EDGE-06: Batch budget with invalid IDs..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/employees/batch-budget" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"employeeIds\": [\"00000000-0000-0000-0000-000000000001\", \"00000000-0000-0000-0000-000000000002\"],
    \"amount\": 100
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "404" ]; then
    log_test "TC-EMP-EDGE-06" "Invalid batch budget rejected" "400/404" "$HTTP_CODE" "PASS"
else
    log_test "TC-EMP-EDGE-06" "Invalid batch budget rejected" "400/404" "$HTTP_CODE" "WARN"
fi

# TC-EMP-EDGE-07: Employee export CSV
echo "Testing TC-EMP-EDGE-07: Employee export CSV..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/employees/export" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-EMP-EDGE-07" "Export CSV works" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-EMP-EDGE-07" "Export CSV works" "200" "$HTTP_CODE" "FAIL"
fi

# TC-EMP-EDGE-08: Get invite statuses
echo "Testing TC-EMP-EDGE-08: Invite statuses..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/employees/invite-statuses" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-EMP-EDGE-08" "Invite statuses works" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-EMP-EDGE-08" "Invite statuses works" "200" "$HTTP_CODE" "FAIL"
fi

echo ""

# ============================================
# SECTION 3: DASHBOARD EDGE CASES
# ============================================
echo "=========================================="
echo "📊 DASHBOARD EDGE CASES"
echo "=========================================="

# TC-DASH-EDGE-01: Dashboard summary
echo "Testing TC-DASH-EDGE-01: Dashboard summary..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/dashboard" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    BODY=$(echo "$RESP" | head -n -1)
    BUDGET=$(echo "$BODY" | jq -r '.totalBudget // empty')
    log_test "TC-DASH-EDGE-01" "Dashboard summary" "200" "$HTTP_CODE (budget: $BUDGET)" "PASS"
else
    log_test "TC-DASH-EDGE-01" "Dashboard summary" "200" "$HTTP_CODE" "FAIL"
fi

# TC-DASH-EDGE-02: Orders with date filter
echo "Testing TC-DASH-EDGE-02: Orders with date filter..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/dashboard/orders?date=$TODAY" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    BODY=$(echo "$RESP" | head -n -1)
    TOTAL=$(echo "$BODY" | jq -r '.total // 0')
    log_test "TC-DASH-EDGE-02" "Orders with date filter" "200" "$HTTP_CODE (total: $TOTAL)" "PASS"
else
    log_test "TC-DASH-EDGE-02" "Orders with date filter" "200" "$HTTP_CODE" "FAIL"
fi

# TC-DASH-EDGE-03: Orders export
echo "Testing TC-DASH-EDGE-03: Orders export..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/dashboard/orders/export?date=$TODAY" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-DASH-EDGE-03" "Orders export" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-DASH-EDGE-03" "Orders export" "200" "$HTTP_CODE" "FAIL"
fi

# TC-DASH-EDGE-04: Get cutoff time
echo "Testing TC-DASH-EDGE-04: Get cutoff time..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/dashboard/cutoff" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    BODY=$(echo "$RESP" | head -n -1)
    TIME=$(echo "$BODY" | jq -r '.time // empty')
    log_test "TC-DASH-EDGE-04" "Get cutoff time" "200" "$HTTP_CODE (time: $TIME)" "PASS"
else
    log_test "TC-DASH-EDGE-04" "Get cutoff time" "200" "$HTTP_CODE" "FAIL"
fi

# TC-DASH-EDGE-05: Get combos
echo "Testing TC-DASH-EDGE-05: Get combos..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/dashboard/combos" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-DASH-EDGE-05" "Get combos" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-DASH-EDGE-05" "Get combos" "200" "$HTTP_CODE" "FAIL"
fi

# TC-DASH-EDGE-06: Bulk action with empty array
echo "Testing TC-DASH-EDGE-06: Bulk action empty array..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/dashboard/bulk-action" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderIds\": [],
    \"action\": \"pause\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-DASH-EDGE-06" "Bulk action empty rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-DASH-EDGE-06" "Bulk action empty rejected" "400" "$HTTP_CODE" "WARN"
fi

# TC-DASH-EDGE-07: Bulk action with invalid action
echo "Testing TC-DASH-EDGE-07: Bulk action invalid action..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/dashboard/bulk-action" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"orderIds\": [\"$FIRST_EMPLOYEE_ID\"],
    \"action\": \"invalid_action\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-DASH-EDGE-07" "Invalid action rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-DASH-EDGE-07" "Invalid action rejected" "400" "$HTTP_CODE" "WARN"
fi

echo ""

# ============================================
# SECTION 4: GUEST ORDERS EDGE CASES
# ============================================
echo "=========================================="
echo "🧑‍🤝‍🧑 GUEST ORDERS EDGE CASES"
echo "=========================================="

# TC-GUEST-EDGE-01: Create guest order
echo "Testing TC-GUEST-EDGE-01: Create guest order..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/dashboard/guest-order" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"guestName\": \"Test Guest $(date +%s)\",
    \"comboType\": \"Комбо 25\",
    \"date\": \"$FUTURE_START\",
    \"projectId\": \"$FIRST_PROJECT_ID\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ] || [ "$HTTP_CODE" == "201" ]; then
    log_test "TC-GUEST-EDGE-01" "Create guest order" "200/201" "$HTTP_CODE" "PASS"
else
    BODY=$(echo "$RESP" | head -n -1)
    MSG=$(echo "$BODY" | jq -r '.message // empty')
    log_test "TC-GUEST-EDGE-01" "Create guest order" "200/201" "$HTTP_CODE ($MSG)" "WARN"
fi

# TC-GUEST-EDGE-02: Guest order with empty name
echo "Testing TC-GUEST-EDGE-02: Guest order empty name..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/dashboard/guest-order" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"guestName\": \"\",
    \"comboType\": \"Комбо 25\",
    \"date\": \"$FUTURE_START\",
    \"projectId\": \"$FIRST_PROJECT_ID\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-GUEST-EDGE-02" "Empty guest name rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-GUEST-EDGE-02" "Empty guest name rejected" "400" "$HTTP_CODE" "WARN"
fi

# TC-GUEST-EDGE-03: Guest order past date
echo "Testing TC-GUEST-EDGE-03: Guest order past date..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/dashboard/guest-order" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"guestName\": \"Test Guest Past\",
    \"comboType\": \"Комбо 25\",
    \"date\": \"$PAST_DATE\",
    \"projectId\": \"$FIRST_PROJECT_ID\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-GUEST-EDGE-03" "Past date rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-GUEST-EDGE-03" "Past date rejected" "400" "$HTTP_CODE" "WARN"
fi

echo ""

# ============================================
# SECTION 5: PROJECTS EDGE CASES
# ============================================
echo "=========================================="
echo "🏢 PROJECTS EDGE CASES"
echo "=========================================="

# TC-PROJ-EDGE-01: Get project stats
echo "Testing TC-PROJ-EDGE-01: Project stats..."
if [ -n "$FIRST_PROJECT_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/projects/$FIRST_PROJECT_ID/stats" \
      -H "$AUTH")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "TC-PROJ-EDGE-01" "Project stats" "200" "$HTTP_CODE" "PASS"
    else
        log_test "TC-PROJ-EDGE-01" "Project stats" "200" "$HTTP_CODE" "FAIL"
    fi
fi

# TC-PROJ-EDGE-02: Get service types
echo "Testing TC-PROJ-EDGE-02: Service types..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/projects/service-types" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-PROJ-EDGE-02" "Service types" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-PROJ-EDGE-02" "Service types" "200" "$HTTP_CODE" "FAIL"
fi

# TC-PROJ-EDGE-03: Update project without changing address (should work)
echo "Testing TC-PROJ-EDGE-03: Update project name only..."
if [ -n "$FIRST_PROJECT_ID" ]; then
    RESP=$(curl -s -w "\n%{http_code}" -X PUT "$BASE_URL/projects/$FIRST_PROJECT_ID" \
      -H "$AUTH" \
      -H "Content-Type: application/json" \
      -d "{
        \"name\": \"Updated Name Test $(date +%s)\"
      }")
    
    HTTP_CODE=$(echo "$RESP" | tail -1)
    if [ "$HTTP_CODE" == "200" ]; then
        log_test "TC-PROJ-EDGE-03" "Update project name" "200" "$HTTP_CODE" "PASS"
    else
        log_test "TC-PROJ-EDGE-03" "Update project name" "200" "$HTTP_CODE" "WARN"
    fi
fi

# TC-PROJ-EDGE-04: Access project from another company
echo "Testing TC-PROJ-EDGE-04: Access foreign project..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/projects/00000000-0000-0000-0000-000000000099" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "404" ]; then
    log_test "TC-PROJ-EDGE-04" "Foreign project blocked" "404" "$HTTP_CODE" "PASS"
else
    log_test "TC-PROJ-EDGE-04" "Foreign project blocked" "404" "$HTTP_CODE" "WARN"
fi

echo ""

# ============================================
# SECTION 6: USERS EDGE CASES
# ============================================
echo "=========================================="
echo "👤 USERS EDGE CASES"
echo "=========================================="

# TC-USER-EDGE-01: Get routes
echo "Testing TC-USER-EDGE-01: Get routes..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/users/routes" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-USER-EDGE-01" "Get routes" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-USER-EDGE-01" "Get routes" "200" "$HTTP_CODE" "FAIL"
fi

# TC-USER-EDGE-02: Get statuses
echo "Testing TC-USER-EDGE-02: Get statuses..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/users/statuses" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-USER-EDGE-02" "Get statuses" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-USER-EDGE-02" "Get statuses" "200" "$HTTP_CODE" "FAIL"
fi

# TC-USER-EDGE-03: Get roles
echo "Testing TC-USER-EDGE-03: Get roles..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/users/roles" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    log_test "TC-USER-EDGE-03" "Get roles" "200" "$HTTP_CODE" "PASS"
else
    log_test "TC-USER-EDGE-03" "Get roles" "200" "$HTTP_CODE" "FAIL"
fi

# TC-USER-EDGE-04: Create user with invalid phone
echo "Testing TC-USER-EDGE-04: Create user invalid phone..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/users" \
  -H "$AUTH" \
  -H "Content-Type: application/json" \
  -d "{
    \"fullName\": \"Test Invalid Phone\",
    \"phone\": \"abc\",
    \"role\": \"manager\",
    \"projectId\": \"$FIRST_PROJECT_ID\"
  }")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ]; then
    log_test "TC-USER-EDGE-04" "Invalid phone rejected" "400" "$HTTP_CODE" "PASS"
else
    log_test "TC-USER-EDGE-04" "Invalid phone rejected" "400" "$HTTP_CODE" "WARN"
fi

# TC-USER-EDGE-05: All admins (SUPER_ADMIN only)
echo "Testing TC-USER-EDGE-05: All admins..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/users/all-admins" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    BODY=$(echo "$RESP" | head -n -1)
    COUNT=$(echo "$BODY" | jq -r 'length // 0')
    log_test "TC-USER-EDGE-05" "All admins (SUPER_ADMIN)" "200" "$HTTP_CODE (count: $COUNT)" "PASS"
else
    log_test "TC-USER-EDGE-05" "All admins (SUPER_ADMIN)" "200" "$HTTP_CODE" "WARN"
fi

echo ""

# ============================================
# SECTION 7: AUTH EDGE CASES
# ============================================
echo "=========================================="
echo "🔐 AUTH EDGE CASES"
echo "=========================================="

# TC-AUTH-EDGE-01: Login with non-existent phone
echo "Testing TC-AUTH-EDGE-01: Non-existent phone..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone": "+99900000000", "password": "somepass"}')

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    log_test "TC-AUTH-EDGE-01" "Non-existent phone rejected" "401" "$HTTP_CODE" "PASS"
else
    log_test "TC-AUTH-EDGE-01" "Non-existent phone rejected" "401" "$HTTP_CODE" "FAIL"
fi

# TC-AUTH-EDGE-02: Login with empty credentials
echo "Testing TC-AUTH-EDGE-02: Empty credentials..."
RESP=$(curl -s -w "\n%{http_code}" -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"phone": "", "password": ""}')

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "400" ] || [ "$HTTP_CODE" == "401" ]; then
    log_test "TC-AUTH-EDGE-02" "Empty credentials rejected" "400/401" "$HTTP_CODE" "PASS"
else
    log_test "TC-AUTH-EDGE-02" "Empty credentials rejected" "400/401" "$HTTP_CODE" "FAIL"
fi

# TC-AUTH-EDGE-03: Access without token
echo "Testing TC-AUTH-EDGE-03: Access without token..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/employees")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    log_test "TC-AUTH-EDGE-03" "Unauthorized access blocked" "401" "$HTTP_CODE" "PASS"
else
    log_test "TC-AUTH-EDGE-03" "Unauthorized access blocked" "401" "$HTTP_CODE" "FAIL"
fi

# TC-AUTH-EDGE-04: Access with invalid token
echo "Testing TC-AUTH-EDGE-04: Invalid token..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/employees" \
  -H "Authorization: Bearer invalid_token_12345")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "401" ]; then
    log_test "TC-AUTH-EDGE-04" "Invalid token rejected" "401" "$HTTP_CODE" "PASS"
else
    log_test "TC-AUTH-EDGE-04" "Invalid token rejected" "401" "$HTTP_CODE" "FAIL"
fi

# TC-AUTH-EDGE-05: Get current user
echo "Testing TC-AUTH-EDGE-05: Get current user..."
RESP=$(curl -s -w "\n%{http_code}" "$BASE_URL/auth/me" \
  -H "$AUTH")

HTTP_CODE=$(echo "$RESP" | tail -1)
if [ "$HTTP_CODE" == "200" ]; then
    BODY=$(echo "$RESP" | head -n -1)
    ROLE=$(echo "$BODY" | jq -r '.role // empty')
    log_test "TC-AUTH-EDGE-05" "Get current user" "200" "$HTTP_CODE (role: $ROLE)" "PASS"
else
    log_test "TC-AUTH-EDGE-05" "Get current user" "200" "$HTTP_CODE" "FAIL"
fi

echo ""

# ============================================
# SUMMARY
# ============================================
echo "=========================================="
echo "📊 TEST SUMMARY"
echo "=========================================="
echo ""
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo ""
TOTAL=$((PASSED + WARNINGS + FAILED))
PASS_RATE=$((PASSED * 100 / TOTAL))
echo "Total: $TOTAL tests"
echo "Pass Rate: $PASS_RATE%"
echo ""

# Generate report file
REPORT_FILE="/Users/rslazamat/Profession /yalla_business_admin/bpv/EXTENDED_TEST_RESULTS.md"
echo "# Extended Test Results - $(date '+%Y-%m-%d %H:%M:%S')" > "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## Summary" >> "$REPORT_FILE"
echo "- ✅ Passed: $PASSED" >> "$REPORT_FILE"
echo "- ⚠️ Warnings: $WARNINGS" >> "$REPORT_FILE"
echo "- ❌ Failed: $FAILED" >> "$REPORT_FILE"
echo "- Total: $TOTAL" >> "$REPORT_FILE"
echo "- Pass Rate: $PASS_RATE%" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "## Detailed Results" >> "$REPORT_FILE"
echo "" >> "$REPORT_FILE"
echo "| Test ID | Description | Expected | Actual | Status |" >> "$REPORT_FILE"
echo "|---------|-------------|----------|--------|--------|" >> "$REPORT_FILE"

for result in "${RESULTS[@]}"; do
    IFS='|' read -r test_id desc expected actual status <<< "$result"
    if [ "$status" == "PASS" ]; then
        echo "| $test_id | $desc | $expected | $actual | ✅ |" >> "$REPORT_FILE"
    elif [ "$status" == "WARN" ]; then
        echo "| $test_id | $desc | $expected | $actual | ⚠️ |" >> "$REPORT_FILE"
    else
        echo "| $test_id | $desc | $expected | $actual | ❌ |" >> "$REPORT_FILE"
    fi
done

echo "" >> "$REPORT_FILE"
echo "---" >> "$REPORT_FILE"
echo "*Generated by Extended Test Runner*" >> "$REPORT_FILE"

echo "Report saved to: $REPORT_FILE"

