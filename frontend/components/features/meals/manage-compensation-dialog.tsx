"use client";

import { useState, useEffect, useMemo } from "react";
import { format, addDays, differenceInDays, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import { 
  Wallet, Search, Loader2, Users, AlertCircle, RefreshCw, 
  Info, Calendar, Calculator, Flame, ArrowRightLeft 
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { parseError, ErrorCodes } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { servicesApi } from "@/lib/api/services";
import type { Employee, EmployeeDetail } from "@/lib/api/employees";

interface CompensationSummary {
  id: string;
  dailyLimit: number;
  totalBudget: number;
  startDate: string;
  endDate: string;
  status: string;
  usedAmount?: number;
  carryOver?: boolean;
  autoRenew?: boolean;
}

interface ManageCompensationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "individual" | "bulk";
  employee?: Employee | EmployeeDetail;
  employees?: Employee[];
  existingCompensation?: CompensationSummary | null;
  onSuccess?: () => void;
}

const DAILY_LIMIT_PRESETS = [50, 75, 100, 150];

export function ManageCompensationDialog({
  open, onOpenChange, mode, employee, employees = [], existingCompensation, onSuccess,
}: ManageCompensationDialogProps) {
  const isEditing = Boolean(existingCompensation);
  const [dailyLimit, setDailyLimit] = useState("100");
  const [totalBudgetInput, setTotalBudgetInput] = useState("");
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [carryOver, setCarryOver] = useState(false);
  const [autoRenew, setAutoRenew] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Валидация для individual mode: проверяем что сотрудник подходит для компенсации
  const individualValidation = useMemo(() => {
    if (mode !== "individual" || !employee || isEditing) {
      return { isValid: true, reason: null };
    }
    
    // Тип услуги должен быть COMPENSATION
    if (employee.serviceType !== "COMPENSATION") {
      return { 
        isValid: false, 
        reason: employee.serviceType === "LUNCH" 
          ? "Сотрудник настроен на обеды, а не на компенсацию. Измените тип услуги в настройках сотрудника."
          : "У сотрудника не указан тип услуги. Выберите «Компенсация» в настройках сотрудника."
      };
    }
    
    // Нельзя если есть активная подписка на ланч
    if (employee.activeLunchSubscriptionId) {
      return { 
        isValid: false, 
        reason: "У сотрудника активна подписка на обеды. Дождитесь её завершения или отмените."
      };
    }
    
    // Уже есть активная компенсация
    if (employee.activeCompensationId) {
      return { 
        isValid: false, 
        reason: "У сотрудника уже есть активная компенсация."
      };
    }
    
    return { isValid: true, reason: null };
  }, [mode, employee, isEditing]);

  // Deprecated: keep for backward compatibility but use individualValidation instead
  const hasActiveLunch = mode === "individual" && employee?.serviceType === "LUNCH";

  useEffect(() => {
    if (open) {
      if (existingCompensation) {
        setDailyLimit(existingCompensation.dailyLimit.toString());
        setTotalBudgetInput(existingCompensation.totalBudget.toString());
        setDateRange({
          from: new Date(existingCompensation.startDate),
          to: new Date(existingCompensation.endDate),
        });
        setCarryOver(existingCompensation.carryOver || false);
        setAutoRenew(existingCompensation.autoRenew || false);
      } else {
        setDailyLimit("100");
        setTotalBudgetInput("");
        setDateRange(undefined);
        setCarryOver(false);
        setAutoRenew(false);
      }
      if (mode === "individual" && employee) {
        setSelectedEmployeeIds([employee.id]);
      } else {
        setSelectedEmployeeIds([]);
      }
      setSearchQuery("");
    }
  }, [open, existingCompensation, mode, employee]);

  const startDate = dateRange?.from;
  const endDate = dateRange?.to;
  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0;
  const dailyLimitNum = parseFloat(dailyLimit) || 0;
  
  const totalBudget = totalBudgetInput 
    ? parseFloat(totalBudgetInput) || 0 
    : totalDays * dailyLimitNum;
  
  const totalCost = totalBudget * (mode === "bulk" ? selectedEmployeeIds.length : 1);

  const canSubmit = dailyLimitNum > 0 && startDate && endDate && totalDays >= 5 && 
    (mode === "individual" || selectedEmployeeIds.length > 0) && 
    (mode !== "individual" || individualValidation.isValid);

  // В bulk режиме показываем только сотрудников:
  // 1. Активных с принятым приглашением
  // 2. С типом услуги COMPENSATION (настроенных на компенсацию)
  // 3. БЕЗ активной подписки на ланч (ланч и компенсация взаимоисключающие)
  // 4. БЕЗ активной компенсации (чтобы можно было создать новую)
  const availableEmployees = employees.filter(e => {
    // Базовые требования
    if (!e.isActive) return false;
    if (e.inviteStatus !== "Принято") return false;
    
    // Тип услуги должен быть COMPENSATION
    if (e.serviceType !== "COMPENSATION") return false;
    
    // Нет активной подписки на ланч (взаимоисключающие услуги)
    if (e.activeLunchSubscriptionId) return false;
    
    // Нет активной компенсации (чтобы создать новую)
    if (e.activeCompensationId) return false;
    
    return true;
  });
  
  const filteredEmployees = availableEmployees.filter(e => 
    e.fullName.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Определяем причину пустого списка с диагностикой
  const getEmptyReason = () => {
    if (employees.length === 0) return "Сотрудники не загружены";
    
    const activeCount = employees.filter(e => e.isActive).length;
    if (activeCount === 0) return "Нет активных сотрудников";
    
    const acceptedCount = employees.filter(e => e.isActive && e.inviteStatus === "Принято").length;
    if (acceptedCount === 0) return "Нет сотрудников с принятыми приглашениями";
    
    // Проверяем тип услуги
    const compensationTypeCount = employees.filter(e => 
      e.isActive && e.inviteStatus === "Принято" && e.serviceType === "COMPENSATION"
    ).length;
    if (compensationTypeCount === 0) return "Нет сотрудников с типом услуги «Компенсация»";
    
    // Проверяем блокировку из-за активного ланча
    const blockedByLunchCount = employees.filter(e => 
      e.isActive && e.inviteStatus === "Принято" && 
      e.serviceType === "COMPENSATION" && e.activeLunchSubscriptionId
    ).length;
    if (blockedByLunchCount > 0) {
      const withoutLunch = employees.filter(e => 
        e.isActive && e.inviteStatus === "Принято" && 
        e.serviceType === "COMPENSATION" && !e.activeLunchSubscriptionId
      ).length;
      if (withoutLunch === 0) return "У всех сотрудников активна подписка на обеды";
    }
    
    // Проверяем активную компенсацию
    const withActiveComp = employees.filter(e => 
      e.isActive && e.inviteStatus === "Принято" && 
      e.serviceType === "COMPENSATION" && !e.activeLunchSubscriptionId && e.activeCompensationId
    ).length;
    const withoutActiveComp = employees.filter(e => 
      e.isActive && e.inviteStatus === "Принято" && 
      e.serviceType === "COMPENSATION" && !e.activeLunchSubscriptionId && !e.activeCompensationId
    ).length;
    if (withoutActiveComp === 0 && withActiveComp > 0) return "У всех сотрудников уже есть активная компенсация";
    
    if (searchQuery && filteredEmployees.length === 0) return "Не найдено по запросу";
    
    return "Нет доступных сотрудников";
  };

  const handleSubmit = async () => {
    if (!startDate || !endDate) return;
    
    setIsSubmitting(true);
    try {
      // IMPORTANT: Use local date formatting to avoid timezone shift
      const formatDate = (d: Date) => format(d, 'yyyy-MM-dd');
      
      if (isEditing && existingCompensation) {
        await servicesApi.updateCompensation(existingCompensation.id, {
          dailyLimit: dailyLimitNum,
          carryOver,
          autoRenew,
        });
        toast.success("Компенсация обновлена");
      } else {
        const result = await servicesApi.createCompensations({
          employeeIds: mode === "individual" && employee ? [employee.id] : selectedEmployeeIds,
          dailyLimit: dailyLimitNum,
          startDate: formatDate(startDate),
          endDate: formatDate(endDate),
          carryOver,
          autoRenew,
        });
        
        if (result.errors && result.errors.length > 0) {
          toast.warning(`Создано ${result.compensations.length} компенсаций. Ошибок: ${result.errors.length}`);
        } else {
          toast.success(`Назначено компенсаций: ${result.compensations.length}`);
        }
      }
      
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      const appError = parseError(error);
      logger.error("Failed to save compensation", error instanceof Error ? error : new Error(appError.message), {
        errorCode: appError.code,
      });
      toast.error(appError.message, { description: appError.action });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-5 border-b shrink-0">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg font-semibold">
                {isEditing 
                  ? "Управление компенсацией" 
                  : "Назначение компенсации"
                }
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {isEditing || mode === "individual" 
                  ? employee?.fullName 
                  : "Установите бюджет и период для сотрудников"
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-6 space-y-6">
            {/* Validation Error for Individual Mode */}
            {mode === "individual" && !isEditing && !individualValidation.isValid && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="leading-relaxed">
                  {individualValidation.reason}
                </AlertDescription>
              </Alert>
            )}

            {/* Employee Selection for Bulk */}
            {mode === "bulk" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-emerald-600" />
                    Выберите сотрудников
                  </h3>
                  <Badge variant="secondary">{selectedEmployeeIds.length} выбрано</Badge>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Поиск по имени..." 
                    value={searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="pl-10"
                  />
                </div>
                <ScrollArea className="h-[160px] rounded-xl border">
                  <div className="p-2 space-y-1">
                    {filteredEmployees.map(emp => (
                      <Label 
                        key={emp.id} 
                        className={cn(
                          "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors",
                          selectedEmployeeIds.includes(emp.id) 
                            ? "bg-emerald-500/10" 
                            : "hover:bg-muted/50"
                        )}
                      >
                        <Checkbox
                          checked={selectedEmployeeIds.includes(emp.id)}
                          onCheckedChange={(checked) => {
                            if (checked) setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                            else setSelectedEmployeeIds(selectedEmployeeIds.filter(id => id !== emp.id));
                          }}
                          className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                        />
                        <span className="font-medium flex-1">{emp.fullName}</span>
                      </Label>
                    ))}
                    {filteredEmployees.length === 0 && (
                      <div className="text-center py-6 space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          {getEmptyReason()}
                        </p>
                        {availableEmployees.length === 0 && employees.length > 0 && (
                          <p className="text-xs text-muted-foreground/70">
                            Всего: {employees.filter(e => e.isActive).length} активных, 
                            {" "}{employees.filter(e => e.inviteStatus === "Принято").length} принято, 
                            {" "}{employees.filter(e => e.serviceType === "COMPENSATION").length} с типом «Компенсация», 
                            {" "}{employees.filter(e => e.serviceType === "COMPENSATION" && !e.activeCompensationId).length} без активной компенсации
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}

            {/* Period Selection */}
            <div className="space-y-4">
              <div className="text-center space-y-1">
                <h3 className="text-lg font-semibold">Выберите период</h3>
                <p className={cn(
                  "text-sm font-medium",
                  totalDays >= 5 ? "text-emerald-600" : "text-destructive"
                )}>
                  {startDate && endDate ? (
                    <>
                      {format(startDate, "d MMMM", { locale: ru })} — {format(endDate, "d MMMM yyyy", { locale: ru })}
                      <span className="mx-2">•</span>
                      <span className="font-bold">{totalDays} дней</span>
                      {totalDays < 5 && <span className="text-destructive ml-2">(мин. 5)</span>}
                    </>
                  ) : (
                    <span className="text-muted-foreground">Минимум 5 дней</span>
                  )}
                </p>
              </div>
              <div className="flex justify-center">
                <CalendarComponent
                  mode="range"
                  selected={dateRange}
                  onSelect={(range) => {
                    if (range?.from && !range?.to) {
                      setDateRange({ from: range.from, to: addDays(range.from, 29) });
                    } else {
                      setDateRange(range);
                    }
                  }}
                  numberOfMonths={2}
                  disabled={(date) => date < startOfDay(new Date())}
                  locale={ru}
                  className="rounded-xl border p-4"
                  classNames={{
                    months: "flex flex-col sm:flex-row gap-4 relative",
                    range_start: "bg-emerald-500 text-white rounded-l-md",
                    range_end: "bg-emerald-500 text-white rounded-r-md",
                    range_middle: "bg-emerald-100 dark:bg-emerald-900/30",
                    today: "ring-1 ring-emerald-500",
                  }}
                />
              </div>
            </div>

            {/* Daily Limit */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Calculator className="h-4 w-4 text-emerald-600" />
                Дневной лимит
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {DAILY_LIMIT_PRESETS.map(val => (
                  <Button
                    key={val}
                    type="button"
                    variant={dailyLimit === val.toString() ? "default" : "outline"}
                    onClick={() => setDailyLimit(val.toString())}
                    className={cn(
                      dailyLimit === val.toString() && "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    {val} TJS
                  </Button>
                ))}
              </div>
              <div className="relative">
                <Input
                  type="number"
                  value={dailyLimit}
                  onChange={e => setDailyLimit(e.target.value)}
                  placeholder="Или введите свою сумму"
                  min={1}
                  className="pr-20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  TJS/день
                </span>
              </div>
            </div>

            {/* Total Budget */}
            <div className="space-y-3">
              <h3 className="font-semibold flex items-center gap-2">
                <Wallet className="h-4 w-4 text-emerald-600" />
                Общий бюджет на период
              </h3>
              <div className="relative">
                <Input
                  type="number"
                  value={totalBudgetInput || (totalBudget > 0 ? totalBudget.toString() : "")}
                  onChange={e => setTotalBudgetInput(e.target.value)}
                  placeholder={totalBudget > 0 ? `${totalBudget} (авторасчёт)` : "Введите сумму"}
                  min={1}
                  className="pr-12"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  TJS
                </span>
              </div>
              {!totalBudgetInput && totalDays > 0 && dailyLimitNum > 0 && (
                <p className="text-sm text-muted-foreground">
                  Авторасчёт: {totalDays} дней × {dailyLimitNum} TJS = {totalBudget} TJS
                </p>
              )}
            </div>

            {/* Carry Over Option */}
            <div className="space-y-3">
              <h3 className="font-semibold">Остаток дневного лимита</h3>
              <RadioGroup 
                value={carryOver ? "carry" : "burn"} 
                onValueChange={(v) => setCarryOver(v === "carry")}
                className="space-y-2"
              >
                <Label className={cn(
                  "flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all",
                  !carryOver ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border"
                )}>
                  <RadioGroupItem value="burn" />
                  <Flame className={cn("h-5 w-5", !carryOver ? "text-emerald-600" : "text-muted-foreground")} />
                  <div>
                    <p className="font-semibold">Сгорает в конце дня</p>
                    <p className="text-sm text-muted-foreground">Неиспользованный остаток не переносится</p>
                  </div>
                </Label>
                <Label className={cn(
                  "flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-all",
                  carryOver ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border"
                )}>
                  <RadioGroupItem value="carry" />
                  <ArrowRightLeft className={cn("h-5 w-5", carryOver ? "text-emerald-600" : "text-muted-foreground")} />
                  <div>
                    <p className="font-semibold">Переносится на следующий день</p>
                    <p className="text-sm text-muted-foreground">В рамках текущего периода</p>
                  </div>
                </Label>
              </RadioGroup>
            </div>

            {/* Auto Renew */}
            <Label className={cn(
              "flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all",
              autoRenew ? "border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20" : "border-border"
            )}>
              <div className="flex items-center gap-4">
                <RefreshCw className={cn("h-5 w-5", autoRenew ? "text-emerald-600" : "text-muted-foreground")} />
                <div>
                  <p className="font-semibold">Автопродление</p>
                  <p className="text-sm text-muted-foreground">Автоматически продлевать на следующий период</p>
                </div>
              </div>
              <Checkbox 
                checked={autoRenew} 
                onCheckedChange={(checked) => setAutoRenew(checked === true)}
                className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
              />
            </Label>

            {/* Summary */}
            <div className="p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent border-2 border-emerald-500/20">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-emerald-500/10">
                  <Calculator className="h-8 w-8 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Итого к назначению</p>
                  <p className="text-3xl font-bold">
                    {(mode === "bulk" && selectedEmployeeIds.length > 1 ? totalCost : totalBudget).toLocaleString()} TJS
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dailyLimitNum} TJS/день × {totalDays} дней
                    {mode === "bulk" && selectedEmployeeIds.length > 1 && ` × ${selectedEmployeeIds.length} сотр.`}
                  </p>
                </div>
              </div>
            </div>

            {/* Info */}
            <Alert className="border-blue-500/30 bg-blue-50/50 dark:bg-blue-950/20">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Сотрудник сможет тратить бюджет в ресторанах-партнёрах через Client App
              </AlertDescription>
            </Alert>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t bg-muted/20 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isSubmitting || !canSubmit}
            className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[120px]"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Сохранение...</>
            ) : isEditing ? (
              "Сохранить"
            ) : (
              "Назначить"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
