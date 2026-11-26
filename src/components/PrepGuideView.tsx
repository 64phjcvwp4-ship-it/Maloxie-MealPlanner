import React, { useMemo } from 'react';
import {
  Check,
  ChefHat,
  Layers,
  Leaf,
  DollarSign,
  CornerDownRight,
  Clock,
} from 'lucide-react';
import { DayPlan, MealSlotType, Recipe } from '../types/mealPlanner';
import {
  generateGroceryList,
  generateSundayPrepTasks,
  generateWasteReductionTips,
  GROCERY_CATEGORY_ORDER,
} from '../utils/groceryUtils';
import { addDaysISO, formatWeekRangeLabel } from '../utils/dateUtils';
import { BubbleButton } from './BubbleControls';

interface PrepGuideViewProps {
  weeksDates: string[][];
  activeWeekIndex: number;
  onSelectWeek: (idx: number) => void;
  daysMap: Record<string, DayPlan>;
  recipes: Recipe[];
  recipesMap: Record<string, Recipe>;
  householdMultiplier: number;
  weeklyBudget: number;
  completedPrepTaskIds: Set<string>;
  onTogglePrepTask: (id: string) => void;
  onAssignBatchWithLeftover: (
    cookDate: string,
    slot: MealSlotType,
    recipeId: string,
    leftoverDate: string
  ) => void;
}

export const PrepGuideView: React.FC<PrepGuideViewProps> = ({
  weeksDates,
  activeWeekIndex,
  onSelectWeek,
  daysMap,
  recipes,
  recipesMap,
  householdMultiplier,
  weeklyBudget,
  completedPrepTaskIds,
  onTogglePrepTask,
  onAssignBatchWithLeftover,
}) => {
  const weekDates = weeksDates[activeWeekIndex] || weeksDates[0] || [];

  const prepTasks = useMemo(
    () => generateSundayPrepTasks(weekDates, daysMap, recipesMap),
    [weekDates, daysMap, recipesMap]
  );

  const wasteTips = useMemo(
    () => generateWasteReductionTips(weekDates, daysMap, recipesMap),
    [weekDates, daysMap, recipesMap]
  );

  const groceryItems = useMemo(
    () => generateGroceryList(weekDates, daysMap, recipesMap, householdMultiplier, []),
    [weekDates, daysMap, recipesMap, householdMultiplier]
  );

  const categorySpend = useMemo(() => {
    const map = new Map<string, number>();
    for (const cat of GROCERY_CATEGORY_ORDER) map.set(cat, 0);
    for (const item of groceryItems) {
      map.set(item.category, (map.get(item.category) || 0) + item.estimatedPrice);
    }
    return Array.from(map.entries()).filter(([, val]) => val > 0);
  }, [groceryItems]);

  const totalWeekSpend = useMemo(
    () => groceryItems.reduce((s, i) => s + i.estimatedPrice, 0),
    [groceryItems]
  );

  const totalMealsPlanned = useMemo(() => {
    let count = 0;
    for (const d of weekDates) {
      const day = daysMap[d];
      if (!day) continue;
      count +=
        day.slots.breakfast.length +
        day.slots.lunch.length +
        day.slots.dinner.length +
        day.slots.snacks.length;
    }
    return count;
  }, [weekDates, daysMap]);

  const batchSuggestions = useMemo(() => {
    return recipes
      .filter((r) => r.dietaryTags.includes('Batch Friendly') || (r.storageDays || 0) >= 3)
      .slice(0, 4);
  }, [recipes]);

  const totalPrepMins = prepTasks.reduce((s, t) => s + t.estimatedMinutes, 0);
  const completedCount = prepTasks.filter((t) => completedPrepTaskIds.has(t.id)).length;

  return (
    <div className="space-y-6">
      {/* Week Header */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] rounded-xl overflow-x-auto">
          {weeksDates.map((dates, idx) => (
            <BubbleButton
              key={idx}
              variant={activeWeekIndex === idx ? 'dark' : 'default'}
              size="sm"
              onClick={() => onSelectWeek(idx)}
            >
              Week {idx + 1} · {formatWeekRangeLabel(dates)}
            </BubbleButton>
          ))}
        </div>

        <div className="text-xs font-mono tabular-nums text-[#4B5563] flex items-center gap-4">
          <span>
            Sunday Prep: <strong className="text-[#111827]">{totalPrepMins} min</strong>
          </span>
          <span>
            Est. Cost/Meal:{' '}
            <strong className="text-[#111827]">
              ${totalMealsPlanned > 0 ? (totalWeekSpend / totalMealsPlanned).toFixed(2) : '0.00'}
            </strong>
          </span>
        </div>
      </div>

      {/* Main Two-Column Studio */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 1. Sunday Meal Prep Guide */}
        <section className="lg:col-span-7 bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ChefHat className="w-4 h-4 text-[#15803D]" />
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">
                  Sunday Meal Prep Guide
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Actionable prep checklist built from Week {activeWeekIndex + 1} meals
                </p>
              </div>
            </div>
            <span className="font-mono text-xs tabular-nums text-[#15803D] font-medium">
              {completedCount}/{prepTasks.length} done
            </span>
          </div>

          {prepTasks.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B7280]">
              Add meals to Week {activeWeekIndex + 1} on the calendar to generate your Sunday prep timeline.
            </div>
          ) : (
            <div className="divide-y divide-[#E5E7EB]">
              {prepTasks.map((task) => {
                const done = completedPrepTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`px-5 py-4 flex items-start gap-3.5 transition-colors ${
                      done ? 'bg-[#F9FAFB]' : 'hover:bg-[#FAFAFA]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onTogglePrepTask(task.id)}
                      aria-label={`Toggle prep task ${task.title}`}
                      className={`mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                        done
                          ? 'bg-[#15803D] border-[#15803D] text-white'
                          : 'bg-white border-[#D1D5DB] hover:border-[#15803D]'
                      }`}
                    >
                      {done && <Check className="w-3.5 h-3.5" />}
                    </button>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`text-sm font-medium ${
                            done ? 'line-through text-[#9CA3AF]' : 'text-[#111827]'
                          }`}
                        >
                          {task.title}
                        </span>
                        <span className="font-mono text-xs tabular-nums text-[#6B7280] flex items-center gap-1 shrink-0">
                          <Clock className="w-3 h-3" />
                          {task.estimatedMinutes}m
                        </span>
                      </div>
                      <p className="text-xs text-[#4B5563] leading-relaxed">{task.detail}</p>
                      <div className="text-[11px] text-[#6B7280]">
                        Phase: {task.phase}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Right Column: Budget Breakdown + Waste Reduction */}
        <div className="lg:col-span-5 space-y-6">
          {/* Shopping Budget Tracker */}
          <section className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-[#15803D]" />
                <h2 className="text-sm font-semibold text-[#111827]">
                  Weekly Budget Breakdown
                </h2>
              </div>
              <span
                className={`font-mono text-xs font-semibold tabular-nums ${
                  totalWeekSpend > weeklyBudget ? 'text-[#DC2626]' : 'text-[#15803D]'
                }`}
              >
                ${totalWeekSpend.toFixed(2)} / ${weeklyBudget}
              </span>
            </div>

            <div className="p-5 space-y-3">
              {categorySpend.length === 0 ? (
                <p className="text-xs text-[#6B7280]">No grocery spend estimated yet.</p>
              ) : (
                categorySpend.map(([cat, amount]) => {
                  const pct = Math.round((amount / Math.max(1, totalWeekSpend)) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#374151] font-medium">{cat}</span>
                        <span className="font-mono tabular-nums text-[#111827]">
                          ${amount.toFixed(2)} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-[#15803D]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Waste Reduction Tips */}
          <section className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center gap-2">
              <Leaf className="w-4 h-4 text-[#15803D]" />
              <div>
                <h2 className="text-sm font-semibold text-[#111827]">
                  Smart Waste Reduction Tips
                </h2>
                <p className="text-xs text-[#6B7280]">
                  Storage & cross-use advice for your week&apos;s fresh produce
                </p>
              </div>
            </div>

            <div className="divide-y divide-[#E5E7EB]">
              {wasteTips.length === 0 ? (
                <div className="p-6 text-xs text-[#6B7280]">
                  Add meals to see personalized ingredient storage and zero-waste tips.
                </div>
              ) : (
                wasteTips.map((tip) => (
                  <div key={tip.id} className="px-5 py-3.5 space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#111827]">{tip.ingredient}</span>
                      <span className="text-[#15803D] font-mono tabular-nums">
                        Used in {tip.usedInCount} meal{tip.usedInCount > 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-[#4B5563] leading-relaxed">{tip.tip}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Batch Cooking Suggestions */}
      <section className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#15803D]" />
            <div>
              <h2 className="text-sm font-semibold text-[#111827]">
                Batch Cooking Suggestions
              </h2>
              <p className="text-xs text-[#6B7280]">
                Cook once and auto-assign next-day leftovers to cut weeknight prep in half.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#E5E7EB]">
          {batchSuggestions.map((recipe, idx) => {
            const cookDay = weekDates[idx % Math.max(1, weekDates.length - 1)] || weekDates[0];
            const leftoverDay = addDaysISO(cookDay, 1);

            return (
              <div key={recipe.id} className="p-5 flex flex-col justify-between gap-4 border-b border-[#E5E7EB] md:border-b-0">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6B7280]">
                    <span>Yields {recipe.servings} servings</span>
                    <span className="font-mono tabular-nums">
                      Keeps {recipe.storageDays || 4} days
                    </span>
                  </div>
                  <h3 className="font-display text-base font-semibold text-[#111827]">
                    {recipe.title}
                  </h3>
                  <p className="text-xs text-[#4B5563] leading-relaxed">
                    {recipe.batchTip || recipe.subtitle}
                  </p>
                </div>

                <div className="flex items-center justify-between gap-3 pt-2 border-t border-[#E5E7EB]">
                  <span className="text-xs font-mono tabular-nums text-[#6B7280]">
                    {recipe.macrosPerServing.calories} kcal · {recipe.macrosPerServing.protein}g P
                  </span>
                  <BubbleButton
                    variant="sage"
                    size="sm"
                    onClick={() =>
                      onAssignBatchWithLeftover(cookDay, 'dinner', recipe.id, leftoverDay)
                    }
                  >
                    <CornerDownRight className="w-3.5 h-3.5" />
                    <span>Schedule Cook + Next-Day Leftover</span>
                  </BubbleButton>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
