import React, { useState } from 'react';
import {
  Plus,
  Minus,
  Trash2,
  CornerDownRight,
  GripVertical,
  LayoutGrid,
  Calendar,
  Sparkles,
  PanelRightOpen,
  PanelRightClose,
  Heart,
  StickyNote,
  RefreshCw,
} from 'lucide-react';
import {
  DayPlan,
  MealSlotType,
  NutritionTargets,
  PlannedMealEntry,
  Recipe,
} from '../types/mealPlanner';
import {
  formatShortDayHeader,
  formatWeekRangeLabel,
  addDaysISO,
} from '../utils/dateUtils';
import { computeDayMacros, MEAL_SLOT_LABELS } from '../utils/groceryUtils';
import { BubbleButton } from './BubbleControls';

interface CalendarViewProps {
  weeksDates: string[][];
  activeWeekIndex: number;
  onSelectWeek: (idx: number) => void;
  planningHorizonWeeks: number;
  onChangeHorizon: (weeks: number) => void;
  daysMap: Record<string, DayPlan>;
  recipes: Recipe[];
  recipesMap: Record<string, Recipe>;
  favoriteIds: Set<string>;
  targets: NutritionTargets;
  onOpenAssignModal: (date: string, slot: MealSlotType) => void;
  onAssignMeal: (
    date: string,
    slot: MealSlotType,
    recipeId: string,
    servings: number,
    isLeftover?: boolean,
    leftoverFromDate?: string
  ) => void;
  onMoveMeal: (
    fromDate: string,
    fromSlot: MealSlotType,
    instanceId: string,
    toDate: string,
    toSlot: MealSlotType
  ) => void;
  onRemoveMeal: (date: string, slot: MealSlotType, instanceId: string) => void;
  onUpdateServings: (date: string, slot: MealSlotType, instanceId: string, delta: number) => void;
  onToggleLeftover: (date: string, slot: MealSlotType, instanceId: string) => void;
  onUpdateNote: (date: string, note: string) => void;
  onOpenRecipeDetail: (recipe: Recipe) => void;
  onOpenTemplates: () => void;
  onClearWeek: (weekDates: string[]) => void;
}

const SLOTS: MealSlotType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const CalendarView: React.FC<CalendarViewProps> = ({
  weeksDates,
  activeWeekIndex,
  onSelectWeek,
  planningHorizonWeeks,
  onChangeHorizon,
  daysMap,
  recipes,
  recipesMap,
  favoriteIds,
  targets,
  onOpenAssignModal,
  onAssignMeal,
  onMoveMeal,
  onRemoveMeal,
  onUpdateServings,
  onToggleLeftover,
  onUpdateNote,
  onOpenRecipeDetail,
  onOpenTemplates,
  onClearWeek,
}) => {
  const [viewMode, setViewMode] = useState<'week' | 'multi'>('week');
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [drawerFilter, setDrawerFilter] = useState<'all' | 'favorites' | 'quick'>('all');
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  const currentWeekDates = weeksDates[activeWeekIndex] || weeksDates[0] || [];

  const drawerRecipes = recipes.filter((r) => {
    if (drawerFilter === 'favorites') return favoriteIds.has(r.id);
    if (drawerFilter === 'quick') return r.prepTimeMinutes + r.cookTimeMinutes <= 22;
    return true;
  });

  const handleDragStartRecipe = (e: React.DragEvent, recipeId: string) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ kind: 'recipe', recipeId })
    );
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDragStartEntry = (
    e: React.DragEvent,
    fromDate: string,
    fromSlot: MealSlotType,
    instanceId: string
  ) => {
    e.dataTransfer.setData(
      'application/json',
      JSON.stringify({ kind: 'entry', fromDate, fromSlot, instanceId })
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDropOnCell = (e: React.DragEvent, toDate: string, toSlot: MealSlotType) => {
    e.preventDefault();
    setDragOverKey(null);
    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const payload = JSON.parse(raw);
      if (payload.kind === 'recipe' && payload.recipeId) {
        onAssignMeal(toDate, toSlot, payload.recipeId, 1, false);
      } else if (payload.kind === 'entry') {
        if (payload.fromDate === toDate && payload.fromSlot === toSlot) return;
        onMoveMeal(payload.fromDate, payload.fromSlot, payload.instanceId, toDate, toSlot);
      }
    } catch {
      // Ignore malformed drag payload
    }
  };

  const sendLeftoverToTomorrow = (
    sourceDate: string,
    sourceSlot: MealSlotType,
    entry: PlannedMealEntry
  ) => {
    const nextDate = addDaysISO(sourceDate, 1);
    const targetSlot: MealSlotType =
      sourceSlot === 'dinner' ? 'lunch' : sourceSlot;
    onAssignMeal(nextDate, targetSlot, entry.recipeId, 1, true, sourceDate);
  };

  return (
    <div className="space-y-5">
      {/* Toolbar: Horizon, Week Tabs, View Switcher, Templates */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] rounded-xl flex-wrap">
            {weeksDates.map((dates, idx) => (
              <BubbleButton
                key={idx}
                variant={viewMode === 'week' && activeWeekIndex === idx ? 'dark' : 'default'}
                size="sm"
                onClick={() => {
                  onSelectWeek(idx);
                  setViewMode('week');
                }}
              >
                Wk {idx + 1} · {formatWeekRangeLabel(dates)}
              </BubbleButton>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-[#4B5563]">
            <span>Plan ahead:</span>
            <select
              aria-label="Planning horizon weeks"
              value={planningHorizonWeeks}
              onChange={(e) => onChangeHorizon(Number(e.target.value))}
              className="px-2.5 py-1.5 text-xs font-medium text-[#111827] bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]"
            >
              <option value={1}>1 Week</option>
              <option value={2}>2 Weeks</option>
              <option value={3}>3 Weeks</option>
              <option value={4}>4 Weeks</option>
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] rounded-xl">
            <BubbleButton
              variant={viewMode === 'week' ? 'dark' : 'default'}
              size="sm"
              onClick={() => setViewMode('week')}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Week Detail</span>
            </BubbleButton>
            <BubbleButton
              variant={viewMode === 'multi' ? 'dark' : 'default'}
              size="sm"
              onClick={() => setViewMode('multi')}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>All {planningHorizonWeeks} Weeks</span>
            </BubbleButton>
          </div>

          <BubbleButton
            variant="sage"
            size="sm"
            onClick={onOpenTemplates}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Meal Templates</span>
          </BubbleButton>

          {viewMode === 'week' && (
            <BubbleButton
              variant="default"
              size="sm"
              onClick={() => setDrawerOpen((o) => !o)}
              className="hidden 2xl:inline-flex"
            >
              {drawerOpen ? (
                <PanelRightClose className="w-3.5 h-3.5" />
              ) : (
                <PanelRightOpen className="w-3.5 h-3.5" />
              )}
              <span>Drag Tray</span>
            </BubbleButton>
          )}
        </div>
      </div>

      {/* Main Content: Either Single-Week Detail Grid (+ Drag Tray) OR Multi-Week Matrix */}
      {viewMode === 'multi' ? (
        <div className="space-y-6">
          {weeksDates.map((weekDates, wIdx) => (
            <div key={wIdx} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold text-[#111827]">
                    Week {wIdx + 1} · {formatWeekRangeLabel(weekDates)}
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <BubbleButton
                    variant="danger"
                    size="xs"
                    onClick={() => onClearWeek(weekDates)}
                  >
                    Clear Week
                  </BubbleButton>
                  <BubbleButton
                    variant="sage"
                    size="xs"
                    onClick={() => {
                      onSelectWeek(wIdx);
                      setViewMode('week');
                    }}
                  >
                    Edit Week {wIdx + 1}
                  </BubbleButton>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB]">
                {weekDates.map((date) => {
                  const { weekday, dayNum, monthShort } = formatShortDayHeader(date);
                  const day = daysMap[date];
                  const macros = computeDayMacros(day, recipesMap);
                  return (
                    <div key={date} className="p-3 space-y-2.5 flex flex-col justify-between min-h-[190px]">
                      <div>
                        <div className="flex items-baseline justify-between border-b border-[#E5E7EB] pb-1.5 mb-2">
                          <span className="text-xs font-semibold text-[#111827]">
                            {weekday} {monthShort} {dayNum}
                          </span>
                          <span className="font-mono text-[11px] tabular-nums text-[#6B7280]">
                            {macros.calories} kcal
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {SLOTS.map((slot) => {
                            const entries = day?.slots[slot] || [];
                            if (entries.length === 0) {
                              return (
                                <button
                                  key={slot}
                                  type="button"
                                  onClick={() => onOpenAssignModal(date, slot)}
                                  className="w-full text-left text-[11px] text-[#9CA3AF] hover:text-[#15803D] py-0.5 truncate"
                                >
                                  + {MEAL_SLOT_LABELS[slot]}
                                </button>
                              );
                            }
                            return entries.map((entry) => {
                              const rec = recipesMap[entry.recipeId];
                              if (!rec) return null;
                              return (
                                <div
                                  key={entry.instanceId}
                                  className="text-[11px] leading-snug text-[#374151] flex items-start justify-between gap-1 group"
                                >
                                  <button
                                    type="button"
                                    onClick={() => onOpenRecipeDetail(rec)}
                                    className="text-left hover:text-[#15803D] truncate flex-1"
                                  >
                                    <span className="text-[#9CA3AF] mr-1">
                                      {MEAL_SLOT_LABELS[slot][0]}:
                                    </span>
                                    {entry.isLeftover && (
                                      <span className="text-[#B45309] font-medium mr-1">
                                        [Leftover]
                                      </span>
                                    )}
                                    {rec.title}
                                  </button>
                                </div>
                              );
                            });
                          })}
                        </div>
                      </div>
                      {day?.note && (
                        <div className="text-[11px] text-[#6B7280] pt-1.5 border-t border-dashed border-[#E5E7EB] truncate">
                          {day.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col 2xl:flex-row gap-5 items-start">
          {/* 7-Day Detailed Grid */}
          <div className="flex-1 w-full overflow-x-auto">
            <div className="min-w-[1060px] grid grid-cols-7 gap-3">
              {currentWeekDates.map((date) => {
                const { weekday, dayNum, monthShort } = formatShortDayHeader(date);
                const day = daysMap[date];
                const macros = computeDayMacros(day, recipesMap);
                const calPct = Math.min(100, Math.round((macros.calories / Math.max(1, targets.calories)) * 100));
                const overCal = macros.calories > targets.calories * 1.1;

                return (
                  <div
                    key={date}
                    className="bg-white border border-[#E5E7EB] rounded-xl flex flex-col overflow-hidden"
                  >
                    {/* Day Header & Mini Nutrition Bar */}
                    <div className="p-3 border-b border-[#E5E7EB] bg-[#FAFAFA] space-y-2">
                      <div className="flex items-baseline justify-between">
                        <div>
                          <span className="text-xs font-semibold text-[#111827]">{weekday}</span>
                          <span className="text-xs text-[#6B7280] ml-1.5">
                            {monthShort} {dayNum}
                          </span>
                        </div>
                        <span
                          className={`font-mono text-[11px] font-medium tabular-nums ${
                            overCal ? 'text-[#DC2626]' : 'text-[#374151]'
                          }`}
                        >
                          {macros.calories} kcal
                        </span>
                      </div>

                      <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            overCal ? 'bg-[#DC2626]' : 'bg-[#15803D]'
                          }`}
                          style={{ width: `${calPct}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-mono tabular-nums text-[#6B7280]">
                        <span>P {macros.protein}g</span>
                        <span>C {macros.carbs}g</span>
                        <span>F {macros.fat}g</span>
                      </div>
                    </div>

                    {/* 4 Meal Slots */}
                    <div className="flex-1 divide-y divide-[#E5E7EB]">
                      {SLOTS.map((slot) => {
                        const entries = day?.slots[slot] || [];
                        const cellKey = `${date}::${slot}`;
                        const isDragOver = dragOverKey === cellKey;

                        return (
                          <div
                            key={slot}
                            onDragOver={(e) => {
                              e.preventDefault();
                              if (dragOverKey !== cellKey) setDragOverKey(cellKey);
                            }}
                            onDragLeave={() => {
                              if (dragOverKey === cellKey) setDragOverKey(null);
                            }}
                            onDrop={(e) => handleDropOnCell(e, date, slot)}
                            className={`p-2.5 min-h-[104px] transition-colors flex flex-col justify-between ${
                              isDragOver ? 'bg-[#F0FDF4]' : 'bg-white'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-medium text-[#6B7280]">
                                  {MEAL_SLOT_LABELS[slot]}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onOpenAssignModal(date, slot)}
                                  aria-label={`Add ${MEAL_SLOT_LABELS[slot]} on ${date}`}
                                  className="p-0.5 text-[#9CA3AF] hover:text-[#15803D] rounded"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>

                              {entries.length === 0 ? (
                                <button
                                  type="button"
                                  onClick={() => onOpenAssignModal(date, slot)}
                                  className="w-full py-3 border border-dashed border-[#E5E7EB] hover:border-[#15803D]/50 rounded-lg text-[11px] text-[#9CA3AF] hover:text-[#15803D] transition-colors"
                                >
                                  + Assign meal
                                </button>
                              ) : (
                                <div className="space-y-2">
                                  {entries.map((entry) => {
                                    const recipe = recipesMap[entry.recipeId];
                                    if (!recipe) return null;
                                    const slotCals = Math.round(
                                      recipe.macrosPerServing.calories * entry.servings
                                    );

                                    return (
                                      <div
                                        key={entry.instanceId}
                                        draggable
                                        onDragStart={(e) =>
                                          handleDragStartEntry(e, date, slot, entry.instanceId)
                                        }
                                        className={`p-2 rounded-lg border text-xs group transition-colors ${
                                          entry.isLeftover
                                            ? 'bg-[#FFFBEB] border-[#FDE68A]'
                                            : 'bg-[#F9FAFB] border-[#E5E7EB] hover:border-[#D1D5DB]'
                                        }`}
                                      >
                                        <div className="flex items-start gap-1">
                                          <GripVertical className="w-3 h-3 text-[#9CA3AF] mt-0.5 shrink-0 cursor-grab" />
                                          <button
                                            type="button"
                                            onClick={() => onOpenRecipeDetail(recipe)}
                                            className="text-left font-medium text-[#111827] hover:text-[#15803D] leading-snug flex-1 line-clamp-2"
                                          >
                                            {recipe.title}
                                          </button>
                                        </div>

                                        {entry.isLeftover && (
                                          <div className="mt-1 text-[10px] font-medium text-[#B45309] flex items-center gap-1">
                                            <RefreshCw className="w-2.5 h-2.5" />
                                            <span>Leftover · No cook</span>
                                          </div>
                                        )}

                                        <div className="mt-1.5 flex items-center justify-between text-[10px] text-[#6B7280] font-mono tabular-nums">
                                          <span>
                                            {slotCals} kcal · {entry.servings}x
                                          </span>

                                          <div className="flex items-center gap-0.5">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onUpdateServings(date, slot, entry.instanceId, -1)
                                              }
                                              title="Decrease servings"
                                              className="p-0.5 hover:text-[#111827]"
                                            >
                                              <Minus className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onUpdateServings(date, slot, entry.instanceId, 1)
                                              }
                                              title="Increase servings"
                                              className="p-0.5 hover:text-[#111827]"
                                            >
                                              <Plus className="w-2.5 h-2.5" />
                                            </button>
                                          </div>
                                        </div>

                                        <div className="mt-1.5 pt-1.5 border-t border-black/5 flex items-center justify-between gap-1 text-[10px]">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onToggleLeftover(date, slot, entry.instanceId)
                                            }
                                            className="text-[#4B5563] hover:text-[#111827] truncate"
                                          >
                                            {entry.isLeftover ? 'Mark fresh' : 'Mark leftover'}
                                          </button>

                                          <div className="flex items-center gap-1 shrink-0">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                sendLeftoverToTomorrow(date, slot, entry)
                                              }
                                              title="Send leftover to tomorrow"
                                              className="p-0.5 text-[#6B7280] hover:text-[#15803D]"
                                            >
                                              <CornerDownRight className="w-3 h-3" />
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                onRemoveMeal(date, slot, entry.instanceId)
                                              }
                                              title="Remove meal"
                                              className="p-0.5 text-[#6B7280] hover:text-[#DC2626]"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Daily Note Input */}
                    <div className="p-2.5 border-t border-[#E5E7EB] bg-[#FAFAFA]">
                      <div className="flex items-start gap-1.5">
                        <StickyNote className="w-3.5 h-3.5 text-[#9CA3AF] mt-1 shrink-0" />
                        <textarea
                          rows={2}
                          value={day?.note || ''}
                          onChange={(e) => onUpdateNote(date, e.target.value)}
                          placeholder="Day note..."
                          className="w-full text-[11px] text-[#374151] placeholder:text-[#9CA3AF] bg-transparent resize-none focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick-Assign Drag Tray */}
          {drawerOpen && (
            <aside className="w-full 2xl:w-[270px] shrink-0 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="p-3.5 border-b border-[#E5E7EB] bg-[#FAFAFA] space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-[#111827]">
                    Quick-Assign Meal Tray
                  </h3>
                  <span className="text-[11px] text-[#6B7280]">Drag to calendar</span>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#E5E7EB]/60 rounded-xl">
                  {(['all', 'favorites', 'quick'] as const).map((f) => (
                    <BubbleButton
                      key={f}
                      variant={drawerFilter === f ? 'dark' : 'default'}
                      size="xs"
                      onClick={() => setDrawerFilter(f)}
                      className="flex-1"
                    >
                      {f === 'all' ? 'All' : f === 'favorites' ? 'Favorites' : '≤ 20m'}
                    </BubbleButton>
                  ))}
                </div>
              </div>

              <div className="max-h-[620px] overflow-y-auto divide-y divide-[#E5E7EB]">
                {drawerRecipes.map((recipe) => (
                  <div
                    key={recipe.id}
                    draggable
                    onDragStart={(e) => handleDragStartRecipe(e, recipe.id)}
                    className="p-3 hover:bg-[#F9FAFB] cursor-grab active:cursor-grabbing flex items-start gap-2 transition-colors"
                  >
                    <GripVertical className="w-3.5 h-3.5 text-[#9CA3AF] mt-0.5 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenRecipeDetail(recipe)}
                          className="text-xs font-medium text-[#111827] hover:text-[#15803D] truncate text-left"
                        >
                          {recipe.title}
                        </button>
                        {favoriteIds.has(recipe.id) && (
                          <Heart className="w-3 h-3 text-[#DC2626] fill-[#DC2626] shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-[#6B7280] mt-0.5 font-mono tabular-nums">
                        {recipe.macrosPerServing.calories} kcal · {recipe.macrosPerServing.protein}g P ·{' '}
                        {recipe.prepTimeMinutes + recipe.cookTimeMinutes}m
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
};
