"use client";

import { useMemo } from "react";
import {
  format,
  addDays,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  isWeekend,
  isBefore,
  startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { DayOfWeek } from "@/lib/api/employees";
import { DEFAULT_WORKING_DAYS } from "@/lib/constants/employee";

interface DaySelectorProps {
  startDate: Date;
  endDate: Date;
  selectedDates: Date[];
  onDatesChange: (dates: Date[]) => void;
  employeeWorkingDays?: DayOfWeek[];
  className?: string;
}

const QUICK_PRESETS = [
  { label: "Пн—Пт", getDays: (d: DayOfWeek) => DEFAULT_WORKING_DAYS.includes(d) },
  { label: "Пн—Сб", getDays: (d: DayOfWeek) => [1, 2, 3, 4, 5, 6].includes(d) },
  { label: "Пн, Ср, Пт", getDays: (d: DayOfWeek) => [1, 3, 5].includes(d) },
];

const DAY_LABELS = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

export function DaySelector({
  startDate,
  endDate,
  selectedDates,
  onDatesChange,
  employeeWorkingDays = DEFAULT_WORKING_DAYS,
  className,
}: DaySelectorProps) {
  const today = startOfDay(new Date());

  // Generate weeks between start and end date
  const weeks = useMemo(() => {
    const result: Date[][] = [];
    let currentWeekStart = startOfWeek(startDate, { weekStartsOn: 1 });
    const lastDate = endOfWeek(endDate, { weekStartsOn: 1 });

    while (isBefore(currentWeekStart, lastDate) || isSameDay(currentWeekStart, lastDate)) {
      const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
      const days = eachDayOfInterval({ start: currentWeekStart, end: weekEnd });
      result.push(days);
      currentWeekStart = addDays(weekEnd, 1);
    }

    return result;
  }, [startDate, endDate]);

  const isInRange = (date: Date) => {
    return !isBefore(date, startOfDay(startDate)) && !isBefore(endOfDay(endDate), date);
  };

  const isSelected = (date: Date) => {
    return selectedDates.some((d) => isSameDay(d, date));
  };

  const isWorkingDay = (date: Date) => {
    const dayOfWeek = date.getDay() as DayOfWeek;
    return employeeWorkingDays.includes(dayOfWeek);
  };

  const toggleDate = (date: Date) => {
    if (!isInRange(date) || isBefore(date, today)) return;

    if (isSelected(date)) {
      onDatesChange(selectedDates.filter((d) => !isSameDay(d, date)));
    } else {
      onDatesChange([...selectedDates, date].sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const toggleDayOfWeek = (dayIndex: number) => {
    const allDatesOfDay = weeks
      .flat()
      .filter((d) => d.getDay() === dayIndex && isInRange(d) && !isBefore(d, today));

    const allSelected = allDatesOfDay.every((d) => isSelected(d));

    if (allSelected) {
      onDatesChange(
        selectedDates.filter(
          (d) => d.getDay() !== dayIndex || !isInRange(d)
        )
      );
    } else {
      const newDates = [...selectedDates];
      allDatesOfDay.forEach((d) => {
        if (!newDates.some((nd) => isSameDay(nd, d))) {
          newDates.push(d);
        }
      });
      onDatesChange(newDates.sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const toggleWeek = (weekDates: Date[]) => {
    const selectableDates = weekDates.filter(
      (d) => isInRange(d) && !isBefore(d, today)
    );
    const allSelected = selectableDates.every((d) => isSelected(d));

    if (allSelected) {
      onDatesChange(
        selectedDates.filter(
          (d) => !selectableDates.some((wd) => isSameDay(wd, d))
        )
      );
    } else {
      const newDates = [...selectedDates];
      selectableDates.forEach((d) => {
        if (!newDates.some((nd) => isSameDay(nd, d))) {
          newDates.push(d);
        }
      });
      onDatesChange(newDates.sort((a, b) => a.getTime() - b.getTime()));
    }
  };

  const applyPreset = (getDays: (d: DayOfWeek) => boolean) => {
    const allDates = weeks.flat().filter((d) => isInRange(d) && !isBefore(d, today));
    const filteredDates = allDates.filter((d) => getDays(d.getDay() as DayOfWeek));
    onDatesChange(filteredDates.sort((a, b) => a.getTime() - b.getTime()));
  };

  const selectWorkingDays = () => {
    const allDates = weeks.flat().filter((d) => isInRange(d) && !isBefore(d, today));
    const workingDates = allDates.filter((d) => isWorkingDay(d));
    onDatesChange(workingDates.sort((a, b) => a.getTime() - b.getTime()));
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Quick presets */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Шаблоны:
        </span>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PRESETS.map((preset) => (
            <Button
              key={preset.label}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 transition-colors"
              onClick={() => applyPreset(preset.getDays)}
            >
              {preset.label}
            </Button>
          ))}
          {employeeWorkingDays.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs font-medium border-amber-400/50 text-amber-700 bg-amber-50/50 hover:bg-amber-100 hover:border-amber-400"
              onClick={selectWorkingDays}
            >
              Рабочие дни
            </Button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="rounded-xl border overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] bg-muted/40 border-b">
          <div className="p-2.5 text-center">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Нед.
            </span>
          </div>
          {DAY_ORDER.map((dayIndex) => {
            const isWeekendDay = dayIndex === 0 || dayIndex === 6;
            return (
              <button
                key={dayIndex}
                type="button"
                onClick={() => toggleDayOfWeek(dayIndex)}
                className={cn(
                  "p-2.5 text-center text-xs font-semibold transition-colors",
                  "hover:bg-amber-100/50 active:bg-amber-200/50",
                  isWeekendDay
                    ? "text-muted-foreground/60"
                    : "text-foreground"
                )}
              >
                {DAY_LABELS[dayIndex]}
              </button>
            );
          })}
        </div>

        {/* Weeks */}
        {weeks.map((weekDates, weekIndex) => {
          const weekStart = weekDates[0];
          const weekLabel = format(weekStart, "d MMM", { locale: ru });
          const selectableInWeek = weekDates.filter(
            (d) => isInRange(d) && !isBefore(d, today)
          );
          const selectedInWeek = selectableInWeek.filter((d) => isSelected(d));
          const isFullySelected = selectableInWeek.length > 0 && selectedInWeek.length === selectableInWeek.length;

          return (
            <div
              key={weekIndex}
              className={cn(
                "grid grid-cols-[56px_repeat(7,1fr)] border-b last:border-b-0 transition-colors",
                isFullySelected && "bg-amber-50/30"
              )}
            >
              {/* Week label */}
              <button
                type="button"
                onClick={() => toggleWeek(weekDates)}
                className={cn(
                  "p-2 text-center transition-colors",
                  "hover:bg-amber-100/50 active:bg-amber-200/50",
                  "flex flex-col items-center justify-center gap-0.5"
                )}
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {weekLabel}
                </span>
                {selectableInWeek.length > 0 && (
                  <span className={cn(
                    "text-[9px] font-semibold",
                    isFullySelected ? "text-amber-600" : "text-muted-foreground/60"
                  )}>
                    {selectedInWeek.length}/{selectableInWeek.length}
                  </span>
                )}
              </button>

              {/* Days */}
              {DAY_ORDER.map((dayIndex) => {
                const date = weekDates.find((d) => d.getDay() === dayIndex);
                if (!date) return <div key={dayIndex} className="p-1" />;

                const inRange = isInRange(date);
                const isPast = isBefore(date, today);
                const selected = isSelected(date);
                const weekend = isWeekend(date);
                const working = isWorkingDay(date);
                const disabled = !inRange || isPast;
                const isToday = isSameDay(date, today);

                return (
                  <button
                    key={dayIndex}
                    type="button"
                    disabled={disabled}
                    onClick={() => toggleDate(date)}
                    className={cn(
                      "p-1.5 flex items-center justify-center transition-all",
                      disabled && "opacity-25 cursor-not-allowed",
                      !disabled && "cursor-pointer group"
                    )}
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center text-sm font-medium transition-all duration-150",
                        // Selected state
                        selected && "bg-amber-500 text-white shadow-sm",
                        // Not selected states
                        !selected && !disabled && [
                          weekend && "text-muted-foreground/50",
                          !weekend && working && "text-foreground ring-1 ring-amber-300/50",
                          !weekend && !working && "text-foreground",
                          "group-hover:ring-2 group-hover:ring-amber-400 group-hover:bg-amber-50",
                        ],
                        // Today marker
                        isToday && !selected && "ring-2 ring-amber-500",
                      )}
                    >
                      {format(date, "d")}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Selection summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge 
            variant={selectedDates.length > 0 ? "default" : "secondary"}
            className={cn(
              "font-semibold",
              selectedDates.length > 0 && "bg-amber-500 hover:bg-amber-600"
            )}
          >
            {selectedDates.length} {selectedDates.length === 1 ? "день" : selectedDates.length < 5 ? "дня" : "дней"}
          </Badge>
          <span className="text-xs text-muted-foreground">выбрано</span>
        </div>
        {selectedDates.length > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground hover:text-destructive"
            onClick={() => onDatesChange([])}
          >
            Сбросить
          </Button>
        )}
      </div>
    </div>
  );
}

function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
