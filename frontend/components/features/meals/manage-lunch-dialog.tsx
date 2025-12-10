"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  UtensilsCrossed, Calendar, Check, ChevronRight, ChevronLeft,
  Search, Loader2, Users, Calculator, AlertTriangle, Trash2,
  Clock, Sun, Moon, Info
} from "lucide-react";
import { DEFAULT_WORKING_DAYS, getEffectiveWorkingDays, countWorkingDaysInRange, isWorkingDay as isWorkingDayCheck, formatWorkingDaysDescription } from "@/lib/constants/employee";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { parseError, ErrorCodes } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { DaySelector } from "./day-selector";
import { servicesApi, type ScheduleType, type ComboType } from "@/lib/api/services";
import { employeesApi, type Employee, type EmployeeDetail, type DayOfWeek } from "@/lib/api/employees";
import { COMBO_OPTIONS_EXTENDED } from "@/lib/config";
import { useBusinessConfig } from "@/lib/hooks/use-business-config";

interface LunchSubscriptionSummary {
  id: string;
  comboType: string;
  startDate: string;
  endDate: string;
  scheduleType: ScheduleType;
  customDays?: string[];
  status: string;
  // Данные из БД (после нормализации)
  totalDays?: number;
  totalPrice?: number;
  futureOrdersCount?: number;
  completedOrdersCount?: number;
}

interface ManageLunchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "individual" | "bulk";
  employee?: Employee | EmployeeDetail;
  employees?: Employee[];
  existingSubscription?: LunchSubscriptionSummary | null;
  onSuccess?: () => void;
}

// From centralized config
const COMBO_OPTIONS = COMBO_OPTIONS_EXTENDED.map(opt => ({
  value: opt.value as ComboType,
  price: opt.price,
  items: [...opt.items],
}));

const STEP_LABELS = ["Комбо", "Период", "График", "Итого"];

const DAY_NAMES_SHORT: Record<DayOfWeek, string> = {
  0: "Вс", 1: "Пн", 2: "Вт", 3: "Ср", 4: "Чт", 5: "Пт", 6: "Сб"
};

const formatWorkingDays = (days: DayOfWeek[] | undefined): string => {
  if (!days || days.length === 0) return "Пн — Пт";
  const sortedDays = [...days].sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));
  // Check for weekdays (Mon-Fri)
  if (sortedDays.length === 5 && sortedDays.every(d => d >= 1 && d <= 5)) {
    return "Пн — Пт";
  }
  return sortedDays.map(d => DAY_NAMES_SHORT[d]).join(", ");
};

const formatShiftType = (shift: "DAY" | "NIGHT" | null | undefined): string => {
  if (shift === "NIGHT") return "Ночная смена";
  return "Дневная смена";
};

const formatTimeRange = (start: string | null | undefined, end: string | null | undefined): string => {
  if (!start && !end) return "Не указано";
  if (start && end) return `${start} — ${end}`;
  if (start) return `с ${start}`;
  return `до ${end}`;
};

export function ManageLunchDialog({
  open, onOpenChange, mode, employee, employees: propEmployees = [], existingSubscription, onSuccess,
}: ManageLunchDialogProps) {
  const isEditing = Boolean(existingSubscription);

  // Business config for dynamic minDays validation
  const { config: businessConfig } = useBusinessConfig();
  const minSubscriptionDays = businessConfig.subscription.minDays;

  // Debug: логируем данные подписки при открытии
  useEffect(() => {
    if (open && existingSubscription) {
      console.log('[ManageLunchDialog] existingSubscription data:', {
        id: existingSubscription.id,
        totalDays: existingSubscription.totalDays,
        totalPrice: existingSubscription.totalPrice,
        futureOrdersCount: existingSubscription.futureOrdersCount,
        completedOrdersCount: existingSubscription.completedOrdersCount,
        startDate: existingSubscription.startDate,
        endDate: existingSubscription.endDate,
      });
    }
  }, [open, existingSubscription]);

  const [step, setStep] = useState(1);
  const [comboType, setComboType] = useState<ComboType>("Комбо 25");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [scheduleType, setScheduleType] = useState<ScheduleType>("EVERY_DAY");
  const [customDates, setCustomDates] = useState<Date[]>([]);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Загрузка ВСЕХ сотрудников для bulk mode (не ограничиваемся 20 из store)
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);

  // В bulk mode ВСЕГДА используем загруженных сотрудников (до 500)
  // Используем useMemo чтобы React перерисовывал при изменении allEmployees
  const employees = useMemo(() => {
    // В bulk mode используем загруженные данные если они есть
    if (mode === "bulk" && allEmployees.length > 0) {
      return allEmployees;
    }
    // Иначе используем пропсы (для individual mode или пока идёт загрузка)
    return propEmployees;
  }, [mode, allEmployees, propEmployees]);

  // Загружаем ВСЕХ сотрудников при открытии модалки в bulk режиме
  useEffect(() => {
    if (open && mode === "bulk" && !isEditing) {
      setIsLoadingEmployees(true);
      setAllEmployees([]); // Сбросим чтобы показать propEmployees пока идёт загрузка
      employeesApi.getEmployees(1, 500) // Загружаем до 500 сотрудников
        .then(response => {
          setAllEmployees(response.items);
        })
        .catch(err => {
          console.error("Failed to load employees for bulk dialog:", err);
          // При ошибке оставляем propEmployees
        })
        .finally(() => {
          setIsLoadingEmployees(false);
        });
    }
  }, [open, mode, isEditing]);

  // Фильтры для bulk mode на шаге 3
  // Выбор смены определяет время доставки: DAY = 11:30-12:30, NIGHT = 17:30-18:30
  const [shiftFilter, setShiftFilter] = useState<"DAY" | "NIGHT">("DAY");

  // Валидация для individual mode: проверяем что сотрудник подходит для обедов
  const individualValidation = useMemo(() => {
    if (mode !== "individual" || !employee || isEditing) {
      return { isValid: true, reason: null, shiftType: null };
    }

    // Тип услуги должен быть LUNCH
    if (employee.serviceType !== "LUNCH") {
      return {
        isValid: false,
        reason: employee.serviceType === "COMPENSATION"
          ? "Сотрудник настроен на компенсацию, а не на обеды. Измените тип услуги в настройках сотрудника."
          : "У сотрудника не указан тип услуги. Выберите «Обеды» в настройках сотрудника.",
        shiftType: null
      };
    }

    // Уже есть активная подписка
    if (employee.activeLunchSubscriptionId) {
      return {
        isValid: false,
        reason: "У сотрудника уже есть активная подписка на обеды.",
        shiftType: null
      };
    }

    // Рабочие дни должны включать будни
    const workDays = getEffectiveWorkingDays(employee.workingDays);
    const hasWeekdays = workDays.some((d: number) => d >= 1 && d <= 5);
    if (!hasWeekdays) {
      return {
        isValid: false,
        reason: "Сотрудник работает только в выходные. Обеды доставляются в рабочие дни (Пн-Пт).",
        shiftType: null
      };
    }

    // Определяем смену и время доставки
    const empShift = employee.shiftType || "DAY";
    const deliveryTime = empShift === "DAY" ? "11:30 — 12:30" : "17:30 — 18:30";

    return { isValid: true, reason: null, shiftType: empShift, deliveryTime };
  }, [mode, employee, isEditing]);

  useEffect(() => {
    if (open) {
      if (existingSubscription) {
        setComboType(existingSubscription.comboType as ComboType);
        setDateRange({
          from: new Date(existingSubscription.startDate),
          to: new Date(existingSubscription.endDate),
        });
        setScheduleType(existingSubscription.scheduleType);
        if (existingSubscription.customDays) {
          setCustomDates(existingSubscription.customDays.map(d => new Date(d)));
        }
      } else {
        setStep(1);
        setComboType("Комбо 25");
        setDateRange(undefined);
        setScheduleType("EVERY_DAY");
        setCustomDates([]);
        // Сброс фильтра смены (по умолчанию дневная)
        setShiftFilter("DAY");
      }
      if (mode === "individual" && employee) {
        setSelectedEmployeeIds([employee.id]);
      } else {
        setSelectedEmployeeIds([]);
      }
      setSearchQuery("");
    } else {
      // Очистка при закрытии
      setAllEmployees([]);
    }
  }, [open, existingSubscription, mode, employee]);

  const startDate = dateRange?.from;
  const endDate = dateRange?.to;
  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;
  const selectedCombo = COMBO_OPTIONS.find(c => c.value === comboType)!;

  const workingDays = useMemo((): DayOfWeek[] => {
    if (mode === "individual" && employee) {
      return getEffectiveWorkingDays((employee as EmployeeDetail).workingDays);
    }
    return DEFAULT_WORKING_DAYS;
  }, [mode, employee]);

  // Calculate days for individual mode or as default estimate
  // При редактировании - берём реальные данные из БД!
  const calculatedDays = useMemo(() => {
    // При редактировании существующей подписки - используем данные из БД
    if (isEditing && existingSubscription?.totalDays !== undefined) {
      return existingSubscription.totalDays;
    }

    if (!startDate || !endDate) return 0;

    // FIXED: Для CUSTOM фильтруем по рабочим дням сотрудника
    if (scheduleType === "CUSTOM") {
      return customDates.filter(date =>
        workingDays.includes(date.getDay() as DayOfWeek)
      ).length;
    }

    // Use centralized function for accurate calculation
    if (scheduleType === "EVERY_DAY") {
      return countWorkingDaysInRange(workingDays, startDate, endDate);
    }

    // EVERY_OTHER_DAY: Пн, Ср, Пт
    let count = 0;
    let current = new Date(startDate);
    while (current <= endDate) {
      const dow = current.getDay() as DayOfWeek;
      if ([1, 3, 5].includes(dow) && workingDays.includes(dow)) count++;
      current = addDays(current, 1);
    }
    return count;
  }, [isEditing, existingSubscription?.totalDays, startDate, endDate, scheduleType, customDates, workingDays]);

  // В individual mode блокируем весь процесс если сотрудник не подходит
  const canProceedStep1 = Boolean(comboType) && (mode !== "individual" || individualValidation.isValid);
  // FIXED: Check calculated WORKING days, not calendar days
  // calculatedDays respects employee's working days schedule
  // Uses dynamic minDays from business config instead of hardcoded value
  const canProceedStep2 = startDate && endDate && calculatedDays >= minSubscriptionDays;
  // canProceedStep3 and canProceedStep4 defined below after dependencies are declared

  // В bulk режиме показываем только сотрудников:
  // 1. Активных с принятым приглашением
  // 2. С типом услуги LUNCH (настроенных на обеды)
  // 3. БЕЗ активной подписки на ланч (чтобы можно было создать новый)
  // 4. С рабочими днями, включающими будни (Пн-Пт)
  // Фильтрация по смене происходит динамически через shiftFilter
  const availableEmployees = useMemo(() => employees.filter(e => {
    // Базовые требования
    if (!e.isActive) return false;
    if (e.inviteStatus !== "Принято") return false;
    if (e.activeLunchSubscriptionId) return false; // уже есть подписка

    // Тип услуги должен быть LUNCH
    if (e.serviceType !== "LUNCH") return false;

    // Рабочие дни должны включать хотя бы один будний день (1-5 = Пн-Пт)
    const workDays = getEffectiveWorkingDays(e.workingDays);
    const hasWeekdays = workDays.some(d => d >= 1 && d <= 5);
    if (!hasWeekdays) return false;

    return true;
  }), [employees]);

  // Фильтрация по графику доставки (применяется на шаге 3)
  // Проверяем совместимость рабочих дней сотрудника с выбранным графиком
  // CRITICAL: Эта логика должна быть идентична scheduleTypeCounts!
  const scheduleTypeFilteredEmployees = useMemo(() => {
    return availableEmployees.filter(e => {
      const empWorkDays = getEffectiveWorkingDays(e.workingDays);

      if (scheduleType === "EVERY_DAY") {
        // Рабочие дни должны включать все будни (Пн-Пт)
        return DEFAULT_WORKING_DAYS.every(d => empWorkDays.includes(d));
      }

      if (scheduleType === "EVERY_OTHER_DAY") {
        // Рабочие дни должны включать Пн, Ср, Пт
        return ([1, 3, 5] as DayOfWeek[]).every(d => (empWorkDays as DayOfWeek[]).includes(d));
      }

      if (scheduleType === "CUSTOM") {
        // FIXED: Для CUSTOM всегда проверяем пересечение с выбранными датами
        // Если даты не выбраны - никто не проходит (нельзя создать подписку без дней)
        if (customDates.length === 0) {
          return false;
        }
        // Получаем уникальные дни недели из выбранных дат
        const selectedDaysOfWeek = [...new Set(customDates.map(d => d.getDay() as DayOfWeek))];
        // Сотрудник проходит если хотя бы один из его рабочих дней есть в выбранных
        return selectedDaysOfWeek.some(d => (empWorkDays as DayOfWeek[]).includes(d));
      }

      return true;
    });
  }, [availableEmployees, scheduleType, customDates]);

  // FIXED: Для CUSTOM требуем выбора дат И наличия подходящих сотрудников (в bulk mode)
  // BUG #3 FIX: Also validate minDays when schedule type changes (e.g., EVERY_OTHER_DAY reduces days)
  // Moved here because it depends on scheduleTypeFilteredEmployees
  const canProceedStep3 = useMemo(() => {
    // BUG #3 FIX: Check minimum days after schedule type change
    // When switching to EVERY_OTHER_DAY, the calculated days might drop below minimum
    if (calculatedDays < minSubscriptionDays) {
      return false;
    }

    if (scheduleType === "CUSTOM") {
      // Для CUSTOM нужны выбранные даты
      if (customDates.length === 0) return false;
    }
    // В bulk mode нужны подходящие сотрудники после фильтра графика
    if (mode === "bulk") {
      return scheduleTypeFilteredEmployees.length > 0;
    }
    return true;
  }, [scheduleType, customDates.length, mode, scheduleTypeFilteredEmployees.length, calculatedDays, minSubscriptionDays]);

  // Фильтрация по смене (применяется на шаге 3)
  // DAY = дневная смена (доставка 11:30-12:30)
  // NIGHT = ночная смена (доставка 17:30-18:30)
  const shiftFilteredEmployees = useMemo(() => {
    return scheduleTypeFilteredEmployees.filter(e => {
      // Фильтр по смене сотрудника
      const empShift = e.shiftType || "DAY"; // по умолчанию дневная
      return empShift === shiftFilter;
    });
  }, [scheduleTypeFilteredEmployees, shiftFilter]);

  const filteredEmployees = shiftFilteredEmployees.filter(e =>
    e.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ═══════════════════════════════════════════════════════════════
  // IMPROVED: Don't auto-clear selection when filter changes
  // Instead, calculate "invisible" selections and show UI warning
  // ═══════════════════════════════════════════════════════════════
  const validEmployeeIdsSet = useMemo(
    () => new Set(shiftFilteredEmployees.map(e => e.id)),
    [shiftFilteredEmployees]
  );

  // Count selected employees that are NOT visible due to current shift filter
  const invisibleSelectionCount = useMemo(() => {
    if (mode !== "bulk") return 0;
    return selectedEmployeeIds.filter(id => !validEmployeeIdsSet.has(id)).length;
  }, [mode, selectedEmployeeIds, validEmployeeIdsSet]);

  // Count selected employees that ARE visible (match current shift filter)
  const visibleSelectionCount = useMemo(() => {
    if (mode !== "bulk") return 0;
    return selectedEmployeeIds.filter(id => validEmployeeIdsSet.has(id)).length;
  }, [mode, selectedEmployeeIds, validEmployeeIdsSet]);

  // Helper to clear only invisible selections (employees from other shift)
  const clearInvisibleSelections = useCallback(() => {
    setSelectedEmployeeIds(prev => prev.filter(id => validEmployeeIdsSet.has(id)));
  }, [validEmployeeIdsSet]);

  // For bulk mode: calculate total price based on each employee's individual working days
  // CRITICAL: Only count employees that pass current shift filter (shiftFilteredEmployees)
  // MOVED HERE: After shiftFilteredEmployees and visibleSelectionCount are declared
  const bulkCalculatedData = useMemo(() => {
    if (mode !== "bulk" || !startDate || !endDate || visibleSelectionCount === 0) {
      return { totalDays: 0, totalPrice: 0 };
    }

    // Get IDs of employees that pass current shift filter
    const validIds = new Set(shiftFilteredEmployees.map(e => e.id));

    let totalDays = 0;
    let totalPrice = 0;

    for (const empId of selectedEmployeeIds) {
      // Skip employees from other shift
      if (!validIds.has(empId)) continue;

      const emp = employees.find(e => e.id === empId);
      if (!emp) continue;

      const empWorkDays = getEffectiveWorkingDays(emp.workingDays);
      let days = 0;

      if (scheduleType === "CUSTOM") {
        // FIXED: Считаем только дни из customDates, которые совпадают с рабочими днями сотрудника
        days = customDates.filter(date =>
          empWorkDays.includes(date.getDay() as DayOfWeek)
        ).length;
      } else if (scheduleType === "EVERY_DAY") {
        days = countWorkingDaysInRange(empWorkDays, startDate, endDate);
      } else {
        // EVERY_OTHER_DAY
        let current = new Date(startDate);
        while (current <= endDate) {
          const dow = current.getDay() as DayOfWeek;
          if ([1, 3, 5].includes(dow) && empWorkDays.includes(dow)) days++;
          current = addDays(current, 1);
        }
      }

      totalDays += days;
      totalPrice += days * selectedCombo.price;
    }

    return { totalDays, totalPrice };
  }, [mode, startDate, endDate, selectedEmployeeIds, employees, scheduleType, customDates, selectedCombo.price, shiftFilteredEmployees, visibleSelectionCount]);

  // Total price: use bulk calculation for bulk mode, simple calculation for individual
  // При редактировании берём цену из БД если комбо не изменилось
  // MOVED HERE: After bulkCalculatedData is declared
  const totalPrice = useMemo(() => {
    if (mode === "bulk") {
      return bulkCalculatedData.totalPrice;
    }

    // При редактировании с тем же комбо - показываем реальную цену из БД
    if (isEditing && existingSubscription?.totalPrice !== undefined &&
        existingSubscription.comboType === comboType) {
      return existingSubscription.totalPrice;
    }

    // Иначе пересчитываем
    return calculatedDays * selectedCombo.price;
  }, [mode, bulkCalculatedData.totalPrice, isEditing, existingSubscription?.totalPrice, existingSubscription?.comboType, comboType, calculatedDays, selectedCombo.price]);

  // FIXED: Use visibleSelectionCount to only count employees matching current shift filter
  // MOVED HERE: After visibleSelectionCount is declared
  const canProceedStep4 = mode === "individual" || visibleSelectionCount > 0;

  // Подсчёт сотрудников для каждого типа графика (для отображения в UI)
  // CRITICAL: Эта логика должна быть идентична scheduleTypeFilteredEmployees!
  const scheduleTypeCounts = useMemo(() => {
    // Считаем сколько сотрудников подходят под каждый тип графика
    const everyDayCount = availableEmployees.filter(e => {
      const empWorkDays = getEffectiveWorkingDays(e.workingDays);
      return DEFAULT_WORKING_DAYS.every(d => empWorkDays.includes(d));
    }).length;

    const everyOtherDayCount = availableEmployees.filter(e => {
      const empWorkDays = getEffectiveWorkingDays(e.workingDays);
      return ([1, 3, 5] as DayOfWeek[]).every(d => empWorkDays.includes(d));
    }).length;

    // FIXED: Для CUSTOM показываем реальное количество подходящих сотрудников
    // Если даты не выбраны - показываем 0 (выберите дни)
    let customCount = 0;
    if (customDates.length > 0) {
      const selectedDaysOfWeek = [...new Set(customDates.map(d => d.getDay() as DayOfWeek))];
      customCount = availableEmployees.filter(e => {
        const empWorkDays = getEffectiveWorkingDays(e.workingDays);
        return selectedDaysOfWeek.some(d => empWorkDays.includes(d));
      }).length;
    }

    return { everyDayCount, everyOtherDayCount, customCount };
  }, [availableEmployees, customDates]);

  // Сводка по рабочему графику сотрудников для шага 3
  const employeeScheduleSummary = useMemo(() => {
    if (mode === "individual" && employee) {
      const emp = employee as EmployeeDetail;
      return {
        mode: "individual" as const,
        shiftType: emp.shiftType || "DAY",
        workingDays: getEffectiveWorkingDays(emp.workingDays),
        workStartTime: emp.workStartTime || null,
        workEndTime: emp.workEndTime || null,
        employeeName: emp.fullName,
      };
    }

    // Для bulk mode - агрегируем данные с учётом выбранного графика
    if (mode === "bulk" && availableEmployees.length > 0) {
      // Считаем смены среди сотрудников, подходящих под выбранный график
      const shifts = { DAY: 0, NIGHT: 0 };

      scheduleTypeFilteredEmployees.forEach(emp => {
        const shift = emp.shiftType || "DAY";
        shifts[shift]++;
      });

      return {
        mode: "bulk" as const,
        totalAvailable: availableEmployees.length,
        afterScheduleFilter: scheduleTypeFilteredEmployees.length,
        dayShiftCount: shifts.DAY,
        nightShiftCount: shifts.NIGHT,
        finalCount: shiftFilteredEmployees.length,
        selectedShift: shiftFilter,
        deliveryTime: shiftFilter === "DAY" ? "11:30 — 12:30" : "17:30 — 18:30",
      };
    }

    return null;
  }, [mode, employee, availableEmployees, scheduleTypeFilteredEmployees, shiftFilteredEmployees, shiftFilter]);

  // Определяем причину пустого списка с диагностикой
  const getEmptyReasonLunch = () => {
    if (employees.length === 0) return "Сотрудники не загружены";

    const activeCount = employees.filter(e => e.isActive).length;
    if (activeCount === 0) return "Нет активных сотрудников";

    const acceptedCount = employees.filter(e => e.isActive && e.inviteStatus === "Принято").length;
    if (acceptedCount === 0) return "Нет сотрудников с принятыми приглашениями";

    // Проверяем тип услуги
    const lunchTypeCount = employees.filter(e =>
      e.isActive && e.inviteStatus === "Принято" && e.serviceType === "LUNCH"
    ).length;
    if (lunchTypeCount === 0) return "Нет сотрудников с типом услуги «Обеды»";

    const withoutLunchCount = employees.filter(e =>
      e.isActive && e.inviteStatus === "Принято" &&
      e.serviceType === "LUNCH" && !e.activeLunchSubscriptionId
    ).length;
    if (withoutLunchCount === 0) return "У всех сотрудников уже есть подписка на обеды";

    // Проверяем выбранную смену
    const shiftName = shiftFilter === "DAY" ? "дневной" : "ночной";
    const shiftCount = employees.filter(e =>
      e.isActive && e.inviteStatus === "Принято" &&
      e.serviceType === "LUNCH" && !e.activeLunchSubscriptionId &&
      (e.shiftType || "DAY") === shiftFilter
    ).length;
    if (shiftCount === 0) return `Нет сотрудников с ${shiftName} сменой`;

    if (searchQuery && filteredEmployees.length === 0) return "Не найдено по запросу";

    return "Нет доступных сотрудников";
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) return;

    setIsSubmitting(true);
    try {
      // IMPORTANT: Use local date formatting to avoid timezone shift
      // toISOString() would convert to UTC and potentially shift the date by -1 day
      const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');

      // Backend now properly handles all schedule types:
      // - EVERY_DAY: creates orders for all working days (Mon-Fri or employee's schedule)
      // - EVERY_OTHER_DAY: creates orders only for Mon, Wed, Fri
      // - CUSTOM: creates orders only for specified dates
      const customDaysFormatted = scheduleType === "CUSTOM"
        ? customDates.map(d => formatDate(d))
        : undefined;

      if (isEditing && existingSubscription) {
        // NOTE: Backend only supports updating comboType for existing subscriptions
        // To change schedule, user must cancel and create new subscription
        await servicesApi.updateLunchSubscription(existingSubscription.id, {
          comboType,
        });
        toast.success("Подписка обновлена");
      } else {
        // CRITICAL: Filter selectedEmployeeIds by current shift filter to avoid sending
        // employees from wrong shift that might still be in selection after filter change
        const filteredEmployeeIds = mode === "individual" && employee
          ? [employee.id]
          : selectedEmployeeIds.filter(id => validEmployeeIdsSet.has(id));

        const result = await servicesApi.createLunchSubscriptions({
          employeeIds: filteredEmployeeIds,
          comboType,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          scheduleType: scheduleType,
          customDays: customDaysFormatted,
        });

        if (result.errors && result.errors.length > 0) {
          const errorMessages = result.errors.map(e => e.message).join('; ');
          if (result.subscriptions.length === 0) {
            // All failed - show error
            toast.error('Не удалось создать подписки', {
              description: errorMessages,
            });
            return;
          } else {
            // Partial success
            toast.warning(`Создано ${result.subscriptions.length} подписок. Ошибок: ${result.errors.length}`, {
              description: errorMessages,
            });
          }
        } else {
          toast.success(`Создано подписок: ${result.subscriptions.length}`);
        }
      }

      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      const appError = parseError(error);
      logger.error("Failed to save lunch subscription", error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      });

      if (appError.code === ErrorCodes.SUB_MIN_DAYS_REQUIRED) {
        toast.error("Минимальный период подписки — 5 дней", {
          description: "Выберите период не менее 5 рабочих дней",
        });
      } else if (appError.code === ErrorCodes.SUB_PAST_DATE_NOT_ALLOWED) {
        toast.error("Нельзя создать подписку на прошедшие даты", {
          description: "Выберите дату начала сегодня или позже",
        });
      } else if (appError.code === ErrorCodes.BUDGET_INSUFFICIENT) {
        toast.error("Недостаточно бюджета", {
          description: "Обратитесь к администратору для пополнения",
        });
      } else {
        toast.error(appError.message, { description: appError.action });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const remainingDays = useMemo(() => {
    if (!startDate || !endDate) return { total: 0, remaining: 0 };

    // Для новой подписки - все дни являются "оставшимися" (calculatedDays)
    if (!existingSubscription) {
      return { total: calculatedDays, remaining: calculatedDays };
    }

    // При редактировании - берём реальные данные из БД!
    const total = existingSubscription.totalDays ?? calculatedDays;
    const remaining = existingSubscription.futureOrdersCount ?? total;

    return { total, remaining };
  }, [existingSubscription, startDate, endDate, calculatedDays]);

  // FIXED: Use actual price from orders (backend calculates as sum of future order prices)
  // This ensures accurate refund amount even if order prices vary
  const originalPriceForRemaining = useMemo(() => {
    if (!existingSubscription) return 0;
    // Use totalPrice from backend - this is the SUM of actual future order prices!
    // Backend calculates this as: futureOrders.Sum(o => o.Price)
    if (existingSubscription.totalPrice !== undefined && existingSubscription.totalPrice !== null) {
      return existingSubscription.totalPrice;
    }
    // Fallback to calculation if totalPrice not available
    const origCombo = COMBO_OPTIONS.find(c => c.value === existingSubscription.comboType);
    return remainingDays.remaining * (origCombo?.price || 0);
  }, [existingSubscription, remainingDays.remaining]);

  // Новая цена за оставшиеся дни при изменении комбо
  const newPriceForRemaining = useMemo(() => {
    if (!existingSubscription) return 0;
    // Цена за оставшиеся дни по новому комбо
    return remainingDays.remaining * selectedCombo.price;
  }, [existingSubscription, remainingDays.remaining, selectedCombo.price]);

  // Разница в стоимости при смене комбо (только для оставшихся дней!)
  const priceDifference = newPriceForRemaining - originalPriceForRemaining;

  const handleCancelSubscription = async () => {
    if (!existingSubscription) return;
    setIsSubmitting(true);
    try {
      await servicesApi.cancelLunchSubscription(existingSubscription.id);
      toast.success("Подписка отменена. Средства за неиспользованные дни возвращены.");
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      const appError = parseError(error);
      logger.error("Failed to cancel subscription", error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      });

      if (appError.code === ErrorCodes.SUB_ALREADY_CANCELLED) {
        toast.error("Подписка уже отменена");
      } else {
        toast.error(appError.message, { description: appError.action });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ════════════════════════════════════════════════════════════════
  // EDITING MODE - Single screen
  // ════════════════════════════════════════════════════════════════
  if (isEditing) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[520px] max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-5 border-b bg-gradient-to-b from-amber-50/50 to-transparent dark:from-amber-950/20">
            <div className="flex items-start gap-4">
              <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <UtensilsCrossed className="h-5 w-5 text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-lg font-semibold leading-tight">
                  Редактирование подписки
                </DialogTitle>
                {employee && (
                  <p className="text-sm text-muted-foreground mt-1 truncate">
                    {employee.fullName}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>

          {/* Content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-5 space-y-6">
              {/* Combo Type */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Тип комбо
                </h3>
                <RadioGroup
                  value={comboType}
                  onValueChange={(v) => setComboType(v as ComboType)}
                  className="grid grid-cols-2 gap-3"
                >
                  {COMBO_OPTIONS.map(opt => (
                    <Label
                      key={opt.value}
                      className={cn(
                        "relative cursor-pointer rounded-xl border-2 p-4 transition-all duration-200",
                        "hover:border-amber-400/50 hover:shadow-sm",
                        comboType === opt.value
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                          : "border-border"
                      )}
                    >
                      <RadioGroupItem value={opt.value} className="sr-only" />
                      {comboType === opt.value && (
                        <div className="absolute -top-2 -right-2 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      <p className="font-semibold text-lg">{opt.value}</p>
                    </Label>
                  ))}
                </RadioGroup>
              </section>

              {/* Period Info */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  Период подписки
                </h3>
                <div className="rounded-xl border bg-muted/30 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        {startDate && endDate && (
                          `${format(startDate, "d MMM", { locale: ru })} — ${format(endDate, "d MMM yyyy", { locale: ru })}`
                        )}
                      </span>
                    </div>
                  </div>
                  {/* Прогресс подписки */}
                  <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Прогресс:</span>
                      <span className="font-medium">
                        {existingSubscription?.completedOrdersCount ?? (remainingDays.total - remainingDays.remaining)} / {remainingDays.total} дней
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full transition-all"
                        style={{
                          width: `${remainingDays.total > 0
                            ? ((existingSubscription?.completedOrdersCount ?? (remainingDays.total - remainingDays.remaining)) / remainingDays.total) * 100
                            : 0}%`
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Доставлено: {existingSubscription?.completedOrdersCount ?? (remainingDays.total - remainingDays.remaining)}</span>
                      <span className="text-amber-600 font-medium">Осталось: {remainingDays.remaining}</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Schedule - READ ONLY in editing mode */}
              <section className="space-y-3">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  График доставки
                </h3>
                <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">
                      {scheduleType === "EVERY_DAY" ? "Каждый рабочий день" :
                       scheduleType === "EVERY_OTHER_DAY" ? "Через день (Пн, Ср, Пт)" :
                       "Выбранные дни"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    Для изменения графика отмените подписку и создайте новую
                  </p>
                </div>
              </section>

              {/* Price Recalculation - FIXED: показываем стоимость за ОСТАВШИЕСЯ дни */}
              <section className="rounded-xl border-2 border-amber-500/30 bg-gradient-to-br from-amber-50 to-amber-50/30 dark:from-amber-950/30 dark:to-transparent p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Calculator className="h-4 w-4 text-amber-600" />
                  <h3 className="font-semibold">Стоимость оставшихся дней</h3>
                </div>
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      Текущий комбо ({existingSubscription?.comboType})
                    </span>
                    <span className="font-medium">{originalPriceForRemaining.toLocaleString()} TJS</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground text-sm">
                      Новый комбо ({comboType})
                    </span>
                    <span className="text-2xl font-bold">{newPriceForRemaining.toLocaleString()} TJS</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">
                    {remainingDays.remaining} дней × {selectedCombo.price} TJS
                  </p>
                  {priceDifference !== 0 && (
                    <div className={cn(
                      "pt-3 mt-3 border-t text-sm font-medium",
                      priceDifference > 0 ? "text-orange-600" : "text-emerald-600"
                    )}>
                      {/* NOTE: Backend updates order prices but doesn't charge/refund difference */}
                      {priceDifference > 0
                        ? `→ Стоимость увеличится на ${priceDifference.toLocaleString()} TJS (цена заказов будет обновлена)`
                        : `→ Стоимость уменьшится на ${Math.abs(priceDifference).toLocaleString()} TJS (цена заказов будет обновлена)`
                      }
                    </div>
                  )}
                  {priceDifference === 0 && existingSubscription?.comboType === comboType && (
                    <p className="text-xs text-muted-foreground pt-2 border-t mt-2">
                      Комбо не изменён — цены остаются прежними
                    </p>
                  )}
                </div>
              </section>

              {/* Cancel Subscription */}
              <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div>
                      <p className="font-semibold text-destructive">Отменить подписку</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        Возврат за {remainingDays.remaining} неиспользованных дней
                      </p>
                      <p className="text-sm font-medium text-emerald-600 mt-1">
                        {/* Use actual sum from backend, not estimate */}
                        {originalPriceForRemaining.toLocaleString()} TJS к возврату
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleCancelSubscription}
                      disabled={isSubmitting || remainingDays.remaining === 0}
                    >
                      {remainingDays.remaining === 0 ? "Нечего отменять" : "Отменить подписку"}
                    </Button>
                  </div>
                </div>
              </section>
            </div>
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/30 gap-3 sm:gap-3">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1 sm:flex-none"
            >
              Отмена
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || existingSubscription?.comboType === comboType}
              className="flex-1 sm:flex-none bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {existingSubscription?.comboType === comboType ? "Без изменений" : "Сохранить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // CREATION MODE - Wizard
  // ════════════════════════════════════════════════════════════════
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-5 border-b flex-shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
              <UtensilsCrossed className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                {mode === "bulk" ? "Назначение обедов" : "Назначение обеда"}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {mode === "bulk"
                  ? "Создайте подписку на обеды для сотрудников"
                  : employee?.fullName
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step Indicator with Employee Counter */}
        <div className="px-6 py-5 border-b bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-center gap-1 sm:gap-0">
            {[1, 2, 3, 4].map((s, i) => (
              <div key={s} className="flex items-center">
                <div className="flex flex-col items-center gap-2">
                  <div className={cn(
                    "w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300",
                    step > s
                      ? "bg-amber-500 text-white"
                      : step === s
                        ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                        : "bg-muted text-muted-foreground"
                  )}>
                    {step > s ? <Check className="h-4 w-4" /> : s}
                  </div>
                  <span className={cn(
                    "text-xs font-medium transition-colors hidden sm:block",
                    step >= s ? "text-foreground" : "text-muted-foreground"
                  )}>
                    {STEP_LABELS[i]}
                  </span>
                </div>
                {s < 4 && (
                  <div className={cn(
                    "w-8 sm:w-16 h-0.5 mx-1 sm:mx-3 rounded-full transition-colors duration-300",
                    step > s ? "bg-amber-500" : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Dynamic Employee Counter - накопительная фильтрация */}
          {mode === "bulk" && !isLoadingEmployees && (
            <div className="mt-4 flex items-center justify-center">
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50 border text-sm">
                <Users className="h-4 w-4 text-muted-foreground" />
                <div className="flex items-center gap-1.5">
                  {/* Шаг 1-2: базовое количество */}
                  {step <= 2 && (
                    <>
                      <span className="text-muted-foreground">Доступно:</span>
                      <Badge variant="secondary" className="font-semibold">
                        {availableEmployees.length}
                      </Badge>
                      <span className="text-muted-foreground">сотр.</span>
                    </>
                  )}
                  {/* Шаг 3: после фильтра графика + смены */}
                  {step === 3 && (
                    <>
                      <span className="text-muted-foreground">По графику:</span>
                      {/* FIXED: Для CUSTOM показываем подсказку если дни не выбраны */}
                      {scheduleType === "CUSTOM" && customDates.length === 0 ? (
                        <span className="text-muted-foreground/70 text-xs">выберите дни</span>
                      ) : (
                        <span className={cn(
                          "font-semibold",
                          scheduleTypeFilteredEmployees.length === 0 && "text-destructive"
                        )}>
                          {scheduleTypeFilteredEmployees.length}
                        </span>
                      )}
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      <span className="text-muted-foreground">По смене:</span>
                      <Badge className={cn(
                        "font-semibold",
                        shiftFilteredEmployees.length > 0
                          ? shiftFilter === "DAY" ? "bg-amber-500 text-white" : "bg-indigo-500 text-white"
                          : "bg-destructive text-destructive-foreground"
                      )}>
                        {shiftFilteredEmployees.length}
                      </Badge>
                    </>
                  )}
                  {/* Шаг 4: итоговое количество */}
                  {step === 4 && (
                    <>
                      <span className="text-muted-foreground">Доступно к выбору:</span>
                      <Badge className={cn(
                        "font-semibold",
                        shiftFilteredEmployees.length > 0
                          ? shiftFilter === "DAY" ? "bg-amber-500 text-white" : "bg-indigo-500 text-white"
                          : "bg-destructive text-destructive-foreground"
                      )}>
                        {shiftFilteredEmployees.length}
                      </Badge>
                      <span className="text-muted-foreground">|</span>
                      <span className="text-muted-foreground">Выбрано:</span>
                      <Badge variant="outline" className="font-semibold border-foreground/20">
                        {visibleSelectionCount}
                      </Badge>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-6">
            {/* Validation Error for Individual Mode */}
            {mode === "individual" && !isEditing && !individualValidation.isValid && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="leading-relaxed">
                  {individualValidation.reason}
                </AlertDescription>
              </Alert>
            )}

            {/* Step 1: Combo Selection */}
            {step === 1 && (
              <div className="space-y-6 max-w-lg mx-auto">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold">Выберите тип комбо</h2>
                  <p className="text-sm text-muted-foreground">
                    Комбо доставляется ежедневно в обеденное время
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {COMBO_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setComboType(opt.value)}
                      className={cn(
                        "relative p-5 sm:p-6 rounded-2xl border-2 transition-all duration-200 text-left group",
                        "hover:shadow-md hover:border-amber-400",
                        comboType === opt.value
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-md"
                          : "border-border hover:bg-muted/30"
                      )}
                    >
                      {comboType === opt.value && (
                        <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center shadow-lg">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      )}
                      <p className="text-xl sm:text-2xl font-bold text-amber-600">{opt.value}</p>
                      <ul className="mt-3 space-y-1.5">
                        {opt.items.map(item => (
                          <li key={item} className="text-sm text-muted-foreground flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Step 2: Period Selection */}
            {step === 2 && (
              <div className="space-y-5">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold">Выберите период подписки</h2>
                  <p className={cn(
                    "text-sm font-medium transition-colors",
                    calculatedDays >= minSubscriptionDays ? "text-amber-600" : "text-destructive"
                  )}>
                    {startDate && endDate ? (
                      <>
                        {format(startDate, "d MMMM", { locale: ru })} — {format(endDate, "d MMMM yyyy", { locale: ru })}
                        <span className="mx-2 text-muted-foreground">•</span>
                        <span className="font-bold">{calculatedDays} рабочих дней</span>
                      </>
                    ) : (
                      <span className="text-muted-foreground">Минимум {minSubscriptionDays} рабочих дней</span>
                    )}
                  </p>
                </div>

                {/* BUG #2 FIX: Show explicit warning when fewer than minimum days selected */}
                {startDate && endDate && calculatedDays < minSubscriptionDays && (
                  <Alert variant="destructive" className="max-w-md mx-auto">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Недостаточно рабочих дней.</strong><br/>
                      Минимальный период подписки — {minSubscriptionDays} рабочих дней.
                      Выбрано: {calculatedDays}. Увеличьте период.
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex justify-center">
                  <CalendarComponent
                    mode="range"
                    selected={dateRange}
                    onSelect={(range) => {
                      if (range?.from && !range?.to) {
                        setDateRange({ from: range.from, to: addDays(range.from, 4) });
                      } else {
                        setDateRange(range);
                      }
                    }}
                    numberOfMonths={2}
                    disabled={(date) => date < startOfDay(new Date())}
                    locale={ru}
                    className="rounded-xl border p-4 shadow-sm"
                    classNames={{
                      months: "flex flex-col sm:flex-row gap-4 relative",
                      range_start: "bg-amber-500 text-white rounded-l-md",
                      range_end: "bg-amber-500 text-white rounded-r-md",
                      range_middle: "bg-amber-100 dark:bg-amber-900/30",
                      today: "ring-1 ring-amber-500",
                    }}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Schedule */}
            {step === 3 && (
              <div className="space-y-5 max-w-xl mx-auto">
                <div className="text-center space-y-2">
                  <h2 className="text-xl font-semibold">Выберите график доставки</h2>
                  <p className="text-sm text-muted-foreground">
                    В какие дни доставлять обеды
                  </p>
                </div>

                {/* BUG #3 FIX: Show warning when schedule type change reduces days below minimum */}
                {calculatedDays > 0 && calculatedDays < minSubscriptionDays && (
                  <Alert variant="destructive">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Недостаточно рабочих дней для выбранного графика.</strong><br/>
                      При графике «{scheduleType === "EVERY_OTHER_DAY" ? "Через день" : scheduleType === "CUSTOM" ? "Выбранные дни" : "Каждый день"}»
                      получается только {calculatedDays} {calculatedDays === 1 ? "день" : calculatedDays < 5 ? "дня" : "дней"}.
                      Минимум — {minSubscriptionDays}. Измените график или увеличьте период.
                    </AlertDescription>
                  </Alert>
                )}

                <RadioGroup
                  value={scheduleType}
                  onValueChange={(v) => setScheduleType(v as ScheduleType)}
                  className="space-y-3"
                >
                  {[
                    { value: "EVERY_DAY", label: "Каждый рабочий день", desc: formatWorkingDaysDescription(workingDays), count: scheduleTypeCounts.everyDayCount },
                    { value: "EVERY_OTHER_DAY", label: "Через день", desc: "Понедельник, Среда, Пятница", count: scheduleTypeCounts.everyOtherDayCount },
                    { value: "CUSTOM", label: "Выбрать дни вручную", desc: "Отметьте нужные дни в календаре", count: scheduleTypeCounts.customCount },
                  ].map(opt => (
                    <Label
                      key={opt.value}
                      className={cn(
                        "flex items-center gap-4 rounded-xl border-2 p-4 sm:p-5 cursor-pointer transition-all duration-200",
                        "hover:border-amber-400/50 hover:shadow-sm",
                        scheduleType === opt.value
                          ? "border-amber-500 bg-amber-50/50 dark:bg-amber-950/20 shadow-sm"
                          : "border-border"
                      )}
                    >
                      <RadioGroupItem value={opt.value} className="text-amber-600" />
                      <div className="flex-1">
                        <p className="font-semibold">{opt.label}</p>
                        <p className="text-sm text-muted-foreground">{opt.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Счётчик сотрудников для bulk mode */}
                        {mode === "bulk" && (
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            // Для CUSTOM без выбранных дат показываем нейтрально
                            opt.value === "CUSTOM" && customDates.length === 0
                              ? "bg-muted/50 text-muted-foreground/70"
                              : opt.count > 0
                                ? "bg-muted text-muted-foreground"
                                : "bg-destructive/10 text-destructive"
                          )}>
                            {opt.value === "CUSTOM" && customDates.length === 0
                              ? "выберите дни ↓"
                              : `${opt.count} сотр.`
                            }
                          </span>
                        )}
                        {/* Badge с количеством дней когда выбран тип графика */}
                        {scheduleType === opt.value && calculatedDays > 0 && (
                          <Badge className="bg-amber-500 text-white">
                            {calculatedDays} дней
                          </Badge>
                        )}
                      </div>
                    </Label>
                  ))}
                </RadioGroup>

                {/* BUG #3 FIX: Show warning when schedule change drops days below minimum */}
                {startDate && endDate && calculatedDays < minSubscriptionDays && (
                  <Alert variant="destructive" className="mt-4">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Недостаточно рабочих дней для выбранного графика.</strong><br/>
                      Выбрано: {calculatedDays} дней. Минимум: {minSubscriptionDays}.
                      Увеличьте период или выберите другой график.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Выбор смены и времени доставки */}
                {mode === "bulk" && employeeScheduleSummary && employeeScheduleSummary.mode === "bulk" && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-4">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-amber-500" />
                      Рабочая смена сотрудников
                    </div>

                    {/* Выбор смены */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setShiftFilter("DAY")}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                          shiftFilter === "DAY"
                            ? "border-amber-500 bg-amber-50 dark:bg-amber-950/30"
                            : "border-border hover:border-amber-400/50"
                        )}
                      >
                        <Sun className={cn("h-6 w-6", shiftFilter === "DAY" ? "text-amber-500" : "text-muted-foreground")} />
                        <div className="text-center">
                          <p className="font-semibold">Дневная смена</p>
                          <p className="text-xs text-muted-foreground">{employeeScheduleSummary.dayShiftCount} сотрудников</p>
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setShiftFilter("NIGHT")}
                        className={cn(
                          "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all",
                          shiftFilter === "NIGHT"
                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30"
                            : "border-border hover:border-indigo-400/50"
                        )}
                      >
                        <Moon className={cn("h-6 w-6", shiftFilter === "NIGHT" ? "text-indigo-500" : "text-muted-foreground")} />
                        <div className="text-center">
                          <p className="font-semibold">Ночная смена</p>
                          <p className="text-xs text-muted-foreground">{employeeScheduleSummary.nightShiftCount} сотрудников</p>
                        </div>
                      </button>
                    </div>

                    {/* Время доставки */}
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      shiftFilter === "DAY" ? "bg-amber-500/10" : "bg-indigo-500/10"
                    )}>
                      <Clock className={cn("h-5 w-5", shiftFilter === "DAY" ? "text-amber-600" : "text-indigo-600")} />
                      <div>
                        <p className="text-sm font-semibold">
                          Время доставки: {employeeScheduleSummary.deliveryTime}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {shiftFilter === "DAY"
                            ? "Обеды доставляются в обеденный перерыв"
                            : "Обеды доставляются перед началом ночной смены"}
                        </p>
                      </div>
                    </div>

                    {/* Сводка по фильтрации */}
                    <div className="pt-3 border-t space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Подходит по графику:</span>
                        <span className="font-medium">{employeeScheduleSummary.afterScheduleFilter} из {employeeScheduleSummary.totalAvailable}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Итого подходит:</span>
                        <Badge className={cn(
                          "text-sm font-semibold",
                          employeeScheduleSummary.finalCount > 0
                            ? shiftFilter === "DAY" ? "bg-amber-500 text-white" : "bg-indigo-500 text-white"
                            : "bg-destructive text-destructive-foreground"
                        )}>
                          {employeeScheduleSummary.finalCount} сотрудников
                        </Badge>
                      </div>
                      {employeeScheduleSummary.finalCount === 0 && (
                        <p className="text-xs text-destructive mt-2">
                          ⚠️ Нет сотрудников с {shiftFilter === "DAY" ? "дневной" : "ночной"} сменой и выбранным графиком.
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Individual mode - показываем данные конкретного сотрудника */}
                {mode === "individual" && individualValidation.isValid && individualValidation.shiftType && (
                  <div className="rounded-xl border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Info className="h-4 w-4" />
                      Рабочая смена сотрудника
                    </div>

                    {/* Смена сотрудника */}
                    <div className={cn(
                      "flex items-center gap-3 p-3 rounded-lg",
                      individualValidation.shiftType === "DAY" ? "bg-amber-500/10" : "bg-indigo-500/10"
                    )}>
                      {individualValidation.shiftType === "DAY" ? (
                        <Sun className="h-5 w-5 text-amber-600" />
                      ) : (
                        <Moon className="h-5 w-5 text-indigo-600" />
                      )}
                      <div>
                        <p className="font-semibold">
                          {individualValidation.shiftType === "DAY" ? "Дневная смена" : "Ночная смена"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Время доставки: {individualValidation.deliveryTime}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground pt-2 border-t">
                      💡 {individualValidation.shiftType === "DAY"
                        ? "Обеды доставляются в обеденный перерыв"
                        : "Обеды доставляются перед началом ночной смены"}
                    </p>
                  </div>
                )}

                {scheduleType === "CUSTOM" && startDate && endDate && (
                  <div className="mt-4 pt-4 border-t space-y-4">
                    <DaySelector
                      startDate={startDate}
                      endDate={endDate}
                      selectedDates={customDates}
                      onDatesChange={setCustomDates}
                      employeeWorkingDays={workingDays}
                    />

                    {/* Предупреждение если выбраны только нерабочие дни */}
                    {mode === "bulk" && customDates.length > 0 && scheduleTypeFilteredEmployees.length === 0 && (
                      <Alert variant="destructive" className="mt-4">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <strong>Нет сотрудников для выбранных дней.</strong><br/>
                          Выбранные дни ({customDates.map(d =>
                            ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]
                          ).filter((v, i, a) => a.indexOf(v) === i).join(', ')})
                          не совпадают с рабочими днями сотрудников.
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Summary */}
            {step === 4 && (
              <div className="space-y-6">
                {/* Employee Selection for Bulk */}
                {mode === "bulk" && (
                  <section className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold flex items-center gap-2">
                        <Users className="h-4 w-4 text-amber-600" />
                        Выберите сотрудников
                      </h3>
                      <Badge variant="secondary" className="font-semibold">
                        {visibleSelectionCount} выбрано
                      </Badge>
                    </div>

                    {/* Warning: invisible selections from other shift */}
                    {invisibleSelectionCount > 0 && (
                      <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <AlertDescription className="text-sm">
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              {invisibleSelectionCount} сотрудник{invisibleSelectionCount === 1 ? '' : invisibleSelectionCount < 5 ? 'а' : 'ов'} из{' '}
                              {shiftFilter === 'DAY' ? 'ночной' : 'дневной'} смены не показан{invisibleSelectionCount === 1 ? '' : 'ы'}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={clearInvisibleSelections}
                              className="h-7 text-xs hover:bg-amber-100 dark:hover:bg-amber-900/30"
                            >
                              Сбросить
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Поиск по имени..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <ScrollArea className="h-[180px] rounded-xl border">
                      <div className="p-2 space-y-1">
                        {filteredEmployees.map(emp => (
                          <Label
                            key={emp.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                              selectedEmployeeIds.includes(emp.id)
                                ? "bg-amber-500/10 hover:bg-amber-500/15"
                                : "hover:bg-muted/50"
                            )}
                          >
                            <Checkbox
                              checked={selectedEmployeeIds.includes(emp.id)}
                              onCheckedChange={(checked) => {
                                if (checked) setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                                else setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                              }}
                              className="data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
                            />
                            <span className="font-medium flex-1">{emp.fullName}</span>
                            <div className="flex items-center gap-2">
                              {emp.shiftType === "NIGHT" ? (
                                <Moon className="h-3 w-3 text-indigo-500" />
                              ) : (
                                <Sun className="h-3 w-3 text-amber-500" />
                              )}
                              {emp.position && (
                                <span className="text-xs text-muted-foreground">{emp.position}</span>
                              )}
                            </div>
                          </Label>
                        ))}
                        {filteredEmployees.length === 0 && (
                          <div className="text-center py-6 space-y-2">
                            <p className="text-sm font-medium text-muted-foreground">
                              {getEmptyReasonLunch()}
                            </p>
                            <p className="text-xs text-muted-foreground/70">
                              Всего сотрудников: {employees.length}<br/>
                              Активных: {employees.filter(e => e.isActive).length}<br/>
                              С типом «Обеды»: {employees.filter(e => e.serviceType === "LUNCH").length}<br/>
                              Без подписки: {employees.filter(e => e.serviceType === "LUNCH" && !e.activeLunchSubscriptionId).length}<br/>
                              {shiftFilter === "DAY" ? "Дневная" : "Ночная"} смена: {employees.filter(e =>
                                e.serviceType === "LUNCH" && !e.activeLunchSubscriptionId &&
                                (e.shiftType || "DAY") === shiftFilter
                              ).length}
                            </p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </section>
                )}

                {/* Summary Cards */}
                <div className="grid sm:grid-cols-2 gap-4">
                  {/* Период */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5" />
                      Период
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Начало</span>
                        <span className="font-medium">{startDate && format(startDate, "d MMMM yyyy", { locale: ru })}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Окончание</span>
                        <span className="font-medium">{endDate && format(endDate, "d MMMM yyyy", { locale: ru })}</span>
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-muted-foreground">Дней доставки</span>
                        <Badge className="bg-amber-500 text-white">
                          {mode === "bulk" && visibleSelectionCount > 0
                            ? `${bulkCalculatedData.totalDays} (сумм.)`
                            : calculatedDays
                          }
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Комбо и график */}
                  <div className="rounded-xl border bg-card p-4 space-y-3">
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      <UtensilsCrossed className="h-3.5 w-3.5" />
                      Комбо
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Тип</span>
                        <span className="font-medium">{comboType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">График</span>
                        <span className="font-medium">
                          {scheduleType === "EVERY_DAY" ? "Ежедневно" : scheduleType === "EVERY_OTHER_DAY" ? "Пн-Ср-Пт" : "Выборочно"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Цена за день</span>
                        <span className="font-medium">{selectedCombo.price} TJS</span>
                      </div>
                    </div>
                  </div>

                  {/* Смена и доставка */}
                  <div className={cn(
                    "rounded-xl border p-4 space-y-3",
                    mode === "bulk"
                      ? shiftFilter === "DAY" ? "bg-amber-500/5 border-amber-500/30" : "bg-indigo-500/5 border-indigo-500/30"
                      : individualValidation.shiftType === "DAY" ? "bg-amber-500/5 border-amber-500/30" : "bg-indigo-500/5 border-indigo-500/30"
                  )}>
                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                      {(mode === "bulk" ? shiftFilter : individualValidation.shiftType) === "DAY" ? (
                        <Sun className="h-3.5 w-3.5 text-amber-500" />
                      ) : (
                        <Moon className="h-3.5 w-3.5 text-indigo-500" />
                      )}
                      Смена и доставка
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Смена</span>
                        <span className="font-medium">
                          {(mode === "bulk" ? shiftFilter : individualValidation.shiftType) === "DAY" ? "Дневная" : "Ночная"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Время доставки</span>
                        <Badge className={cn(
                          (mode === "bulk" ? shiftFilter : individualValidation.shiftType) === "DAY"
                            ? "bg-amber-500 text-white"
                            : "bg-indigo-500 text-white"
                        )}>
                          {(mode === "bulk" ? shiftFilter : individualValidation.shiftType) === "DAY" ? "11:30 — 12:30" : "17:30 — 18:30"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* Сотрудники (только для bulk) */}
                  {mode === "bulk" && (
                    <div className="rounded-xl border bg-card p-4 space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" />
                        Сотрудники
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Выбрано</span>
                          <Badge variant="secondary" className="font-semibold">{visibleSelectionCount}</Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Доступно (по смене)</span>
                          <span className="font-medium">{shiftFilteredEmployees.length}</span>
                        </div>
                        <div className="flex justify-between text-xs border-t pt-2 mt-2">
                          <span className="text-muted-foreground">Всего LUNCH</span>
                          <span className="text-muted-foreground">{availableEmployees.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">→ по графику</span>
                          <span className="text-muted-foreground">{scheduleTypeFilteredEmployees.length}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">→ по смене ({shiftFilter === "DAY" ? "дневн." : "ночн."})</span>
                          <span className="text-muted-foreground">{shiftFilteredEmployees.length}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Total Price */}
                <div className={cn(
                  "p-6 rounded-2xl border-2",
                  mode === "bulk"
                    ? shiftFilter === "DAY"
                      ? "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30"
                      : "bg-gradient-to-br from-indigo-500/15 via-indigo-500/5 to-transparent border-indigo-500/30"
                    : "bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent border-amber-500/30"
                )}>
                  <div className="flex items-center gap-5">
                    <div className={cn(
                      "p-4 rounded-xl",
                      mode === "bulk"
                        ? shiftFilter === "DAY" ? "bg-amber-500/10" : "bg-indigo-500/10"
                        : "bg-amber-500/10"
                    )}>
                      <Calculator className={cn(
                        "h-8 w-8",
                        mode === "bulk"
                          ? shiftFilter === "DAY" ? "text-amber-600" : "text-indigo-600"
                          : "text-amber-600"
                      )} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-muted-foreground font-medium">Итого к списанию</p>
                      <p className="text-3xl sm:text-4xl font-bold tracking-tight">
                        {totalPrice.toLocaleString()} <span className="text-xl font-semibold text-muted-foreground">TJS</span>
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        {mode === "bulk" && visibleSelectionCount > 0
                          ? `${bulkCalculatedData.totalDays} дней (суммарно) × ${selectedCombo.price} TJS`
                          : `${calculatedDays} дней × ${selectedCombo.price} TJS`
                        }
                      </p>
                    </div>
                  </div>
                </div>

                {/* Warning */}
                <Alert className="border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                    После создания подписки сотрудник{mode === "bulk" && visibleSelectionCount > 1 ? "и" : ""} не
                    сможет{mode === "bulk" && visibleSelectionCount > 1 ? "ут" : ""} использовать компенсацию
                    до её завершения
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 flex-shrink-0">
          <div className="flex items-center justify-between w-full gap-3">
            <div className="flex-1">
              {step > 1 && (
                <Button
                  variant="ghost"
                  onClick={() => setStep(step - 1)}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="hidden sm:inline">Назад</span>
                </Button>
              )}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Отмена
              </Button>
              {step < 4 ? (
                <Button
                  onClick={() => setStep(step + 1)}
                  disabled={step === 1 ? !canProceedStep1 : step === 2 ? !canProceedStep2 : !canProceedStep3}
                  className="bg-amber-600 hover:bg-amber-700 text-white gap-1 min-w-[100px]"
                >
                  Далее
                  <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !canProceedStep4}
                  className="bg-amber-600 hover:bg-amber-700 text-white min-w-[140px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Создание...
                    </>
                  ) : (
                    "Создать подписку"
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
