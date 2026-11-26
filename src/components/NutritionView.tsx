import React, { useMemo, useState } from 'react';
import { Target, CheckCircle2, AlertTriangle } from 'lucide-react';
import { DayPlan, NutritionTargets, Recipe } from '../types/mealPlanner';
import { computeDayMacros } from '../utils/groceryUtils';
import { formatShortDayHeader, formatWeekRangeLabel } from '../utils/dateUtils';
import { BubbleButton } from './BubbleControls';
import AnimatedContent from '../../components/AnimatedContent';

interface NutritionViewProps {
  weeksDates: string[][];
  activeWeekIndex: number;
  onSelectWeek: (idx: number) => void;
  daysMap: Record<string, DayPlan>;
  recipesMap: Record<string, Recipe>;
  targets: NutritionTargets;
  onUpdateTargets: (next: NutritionTargets) => void;
}

const GOAL_PRESETS: Array<{ label: string; calories: number; protein: number; carbs: number; fat: number }> = [
  { label: 'Fat Loss (1,650)', calories: 1650, protein: 145, carbs: 145, fat: 55 },
  { label: 'Balanced (2,000)', calories: 2000, protein: 140, carbs: 215, fat: 65 },
  { label: 'High Protein (2,200)', calories: 2200, protein: 180, carbs: 210, fat: 70 },
  { label: 'Low Carb (1,800)', calories: 1800, protein: 155, carbs: 90, fat: 90 },
];

export const NutritionView: React.FC<NutritionViewProps> = ({
  weeksDates,
  activeWeekIndex,
  onSelectWeek,
  daysMap,
  recipesMap,
  targets,
  onUpdateTargets,
}) => {
  const [editingTargets, setEditingTargets] = useState(false);
  const weekDates = weeksDates[activeWeekIndex] || weeksDates[0] || [];

  const dailyStats = useMemo(() => {
    return weekDates.map((date) => {
      const day = daysMap[date];
      const macros = computeDayMacros(day, recipesMap);
      const mealCount = day
        ? day.slots.breakfast.length +
          day.slots.lunch.length +
          day.slots.dinner.length +
          day.slots.snacks.length
        : 0;
      return {
        date,
        header: formatShortDayHeader(date),
        macros,
        mealCount,
      };
    });
  }, [weekDates, daysMap, recipesMap]);

  const weeklyTotals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({
        calories: acc.calories + d.macros.calories,
        protein: acc.protein + d.macros.protein,
        carbs: acc.carbs + d.macros.carbs,
        fat: acc.fat + d.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );
  }, [dailyStats]);

  const activeDaysCount = Math.max(
    1,
    dailyStats.filter((d) => d.macros.calories > 0).length
  );

  const avgDaily = {
    calories: Math.round(weeklyTotals.calories / activeDaysCount),
    protein: Math.round(weeklyTotals.protein / activeDaysCount),
    carbs: Math.round(weeklyTotals.carbs / activeDaysCount),
    fat: Math.round(weeklyTotals.fat / activeDaysCount),
  };

  const totalMacroCals = Math.max(
    1,
    avgDaily.protein * 4 + avgDaily.carbs * 4 + avgDaily.fat * 9
  );
  const pctP = Math.round(((avgDaily.protein * 4) / totalMacroCals) * 100);
  const pctC = Math.round(((avgDaily.carbs * 4) / totalMacroCals) * 100);
  const pctF = Math.max(0, 100 - pctP - pctC);

  const maxChartCal = Math.max(
    targets.calories * 1.25,
    ...dailyStats.map((d) => d.macros.calories),
    1000
  );

  return (
    <div className="space-y-6">
      {/* Week Switcher & Target Controls */}
      <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0]/75 rounded-full overflow-x-auto">
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

        <BubbleButton
          variant="sage"
          size="md"
          onClick={() => setEditingTargets((v) => !v)}
        >
          <Target className="w-3.5 h-3.5" />
          <span>{editingTargets ? 'Hide Target Editor' : 'Customize Targets'}</span>
        </BubbleButton>
      </div>

      {/* Custom Targets Editor */}
      {editingTargets && (
        <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[#2E2D24]">
                Daily Calorie & Macro Targets
              </h3>
              <p className="text-xs text-[#6A6754]">
                Pick a preset or enter custom daily targets.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GOAL_PRESETS.map((p) => (
                <BubbleButton
                  key={p.label}
                  variant="default"
                  size="xs"
                  onClick={() =>
                    onUpdateTargets({
                      ...targets,
                      calories: p.calories,
                      protein: p.protein,
                      carbs: p.carbs,
                      fat: p.fat,
                    })
                  }
                >
                  {p.label}
                </BubbleButton>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {(
              [
                { key: 'calories', label: 'Daily Calories (kcal)' },
                { key: 'protein', label: 'Protein Target (g)' },
                { key: 'carbs', label: 'Carbs Target (g)' },
                { key: 'fat', label: 'Fat Target (g)' },
              ] as const
            ).map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-[#4A483A] mb-1">
                  {field.label}
                </label>
                <input
                  type="number"
                  min={0}
                  step={field.key === 'calories' ? 50 : 5}
                  value={targets[field.key]}
                  onChange={(e) =>
                    onUpdateTargets({
                      ...targets,
                      [field.key]: Math.max(0, Number(e.target.value)),
                    })
                  }
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 4-Column KPI Summary vs Goal */}
      <AnimatedContent
        distance={20}
        direction="vertical"
        duration={0.35}
        ease="power3.out"
        blur={0}
        stagger={0.03}
        trigger="mount"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {(
          [
            {
              label: 'Avg Daily Calories',
              value: avgDaily.calories,
              target: targets.calories,
              unit: 'kcal',
              accent: 'bg-[#6A6754]',
            },
            {
              label: 'Avg Daily Protein',
              value: avgDaily.protein,
              target: targets.protein,
              unit: 'g',
              accent: 'bg-[#4A483A]',
            },
            {
              label: 'Avg Daily Carbs',
              value: avgDaily.carbs,
              target: targets.carbs,
              unit: 'g',
              accent: 'bg-[#908B6F]',
            },
            {
              label: 'Avg Daily Fat',
              value: avgDaily.fat,
              target: targets.fat,
              unit: 'g',
              accent: 'bg-[#C4B9B1]',
            },
          ] as const
        ).map((metric) => {
          const pct = Math.min(100, Math.round((metric.value / Math.max(1, metric.target)) * 100));
          const diff = metric.value - metric.target;
          const isOver = metric.value > metric.target * 1.1;

          return (
            <div
              key={metric.label}
              className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-4 space-y-2.5 shadow-sm"
            >
              <div className="text-xs font-medium text-[#6A6754]">{metric.label}</div>
              <div className="flex items-baseline justify-between">
                <span className="font-mono text-2xl font-semibold tabular-nums text-[#2E2D24]">
                  {metric.value.toLocaleString()}
                  <span className="text-xs font-normal text-[#6A6754] ml-1">
                    {metric.unit}
                  </span>
                </span>
                <span className="font-mono text-xs tabular-nums text-[#6A6754]">
                  / {metric.target.toLocaleString()}
                </span>
              </div>
              <div className="w-full h-2 bg-[#EAE4E0] rounded-full overflow-hidden">
                <div
                  className={`h-full ${isOver ? 'bg-[#B43C2E]' : metric.accent}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div
                className={`text-xs font-medium ${
                  isOver ? 'text-[#B43C2E]' : 'text-[#4A483A]'
                }`}
              >
                {diff === 0
                  ? 'On target'
                  : diff > 0
                  ? `+${diff} ${metric.unit} over target`
                  : `${Math.abs(diff)} ${metric.unit} below target`}
              </div>
            </div>
          );
        })}
      </AnimatedContent>

      {/* Calorie Overview Chart + Caloric Macro Split */}
      <AnimatedContent
        distance={20}
        direction="vertical"
        duration={0.35}
        ease="power3.out"
        blur={0}
        stagger={0.03}
        trigger="mount"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5"
      >
        <div className="lg:col-span-8 bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#2E2D24]">
                Daily Calorie Intake vs Goal
              </h3>
              <p className="text-xs text-[#6A6754]">
                Weekly total: {weeklyTotals.calories.toLocaleString()} kcal across {activeDaysCount} planned days
              </p>
            </div>
            <span className="font-mono text-xs tabular-nums text-[#6A6754]">
              Target: {targets.calories.toLocaleString()} kcal
            </span>
          </div>

          <div className="relative h-56 pt-4 pb-2">
            {/* Target reference line */}
            <div
              className="absolute left-0 right-0 border-t border-dashed border-[#6A6754]/70 pointer-events-none z-10"
              style={{
                bottom: `${Math.min(95, (targets.calories / maxChartCal) * 100)}%`,
              }}
            >
              <span className="text-[10px] font-mono text-[#6A6754] bg-[#FAF8F6] px-1 -mt-2.5 inline-block">
                Goal {targets.calories}
              </span>
            </div>

            <div className="h-full grid grid-cols-7 gap-3 items-end">
              {dailyStats.map((d) => {
                const heightPct = Math.max(
                  2,
                  Math.round((d.macros.calories / maxChartCal) * 100)
                );
                const over = d.macros.calories > targets.calories * 1.1;

                return (
                  <div key={d.date} className="h-full flex flex-col justify-end items-center gap-1.5">
                    <span className="font-mono text-[11px] tabular-nums text-[#4A483A]">
                      {d.macros.calories > 0 ? d.macros.calories : '—'}
                    </span>
                    <div className="w-full max-w-[44px] flex-1 flex items-end bg-[#EAE4E0] rounded-md overflow-hidden">
                      <div
                        className={`w-full rounded-t-md transition-all ${
                          d.macros.calories === 0
                            ? 'bg-transparent'
                            : over
                            ? 'bg-[#B43C2E]'
                            : 'bg-[#6A6754]'
                        }`}
                        style={{ height: `${d.macros.calories === 0 ? 0 : heightPct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-[#4A483A]">
                      {d.header.weekday}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Caloric Split */}
        <div className="lg:col-span-4 bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-5 flex flex-col justify-between space-y-5 shadow-sm">
          <div>
            <h3 className="text-sm font-semibold text-[#2E2D24]">Macro Caloric Split</h3>
            <p className="text-xs text-[#6A6754] mt-0.5">
              Energy share from Protein, Carbs, and Fat
            </p>
          </div>

          <div className="space-y-4">
            <div className="w-full h-4 rounded-full overflow-hidden flex bg-[#EAE4E0]">
              <div style={{ width: `${pctP}%` }} className="bg-[#4A483A]" />
              <div style={{ width: `${pctC}%` }} className="bg-[#908B6F]" />
              <div style={{ width: `${pctF}%` }} className="bg-[#C4B9B1]" />
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#4A483A]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#4A483A]" />
                  Protein (4 kcal/g)
                </span>
                <span className="font-mono font-medium tabular-nums text-[#2E2D24]">
                  {pctP}% · {avgDaily.protein}g
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#4A483A]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#908B6F]" />
                  Carbs (4 kcal/g)
                </span>
                <span className="font-mono font-medium tabular-nums text-[#2E2D24]">
                  {pctC}% · {avgDaily.carbs}g
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[#4A483A]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[#C4B9B1]" />
                  Fat (9 kcal/g)
                </span>
                <span className="font-mono font-medium tabular-nums text-[#2E2D24]">
                  {pctF}% · {avgDaily.fat}g
                </span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-[#D9D0CB] text-xs text-[#6A6754] flex items-center justify-between font-mono tabular-nums">
            <span>Weekly Protein Total</span>
            <span className="font-semibold text-[#2E2D24]">{weeklyTotals.protein}g</span>
          </div>
        </div>
      </AnimatedContent>

      {/* 7-Day Tabular Breakdown */}
      <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3.5 border-b border-[#D9D0CB]/80 bg-[#F3EFEC]/70">
          <h3 className="text-sm font-semibold text-[#2E2D24]">Daily Nutrition Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#D9D0CB] text-xs font-medium text-[#6A6754]">
                <th className="py-3 px-5">Day</th>
                <th className="py-3 px-4 text-right">Meals</th>
                <th className="py-3 px-4 text-right">Calories</th>
                <th className="py-3 px-4 text-right">Protein</th>
                <th className="py-3 px-4 text-right">Carbs</th>
                <th className="py-3 px-4 text-right">Fat</th>
                <th className="py-3 px-5 text-right">Target Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D9D0CB] text-xs">
              {dailyStats.map((d) => {
                const diff = d.macros.calories - targets.calories;
                const onTrack =
                  d.macros.calories > 0 &&
                  Math.abs(diff) <= Math.round(targets.calories * 0.12);
                const over = d.macros.calories > targets.calories * 1.12;

                return (
                  <tr key={d.date} className="hover:bg-[#F3EFEC]">
                    <td className="py-3 px-5 font-medium text-[#2E2D24]">
                      {d.header.weekday}, {d.header.monthShort} {d.header.dayNum}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A]">
                      {d.mealCount}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-medium tabular-nums text-[#2E2D24]">
                      {d.macros.calories.toLocaleString()} kcal
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#6A6754] font-medium">
                      {d.macros.protein}g
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A]">
                      {d.macros.carbs}g
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A]">
                      {d.macros.fat}g
                    </td>
                    <td className="py-3 px-5 text-right">
                      {d.macros.calories === 0 ? (
                        <span className="text-[#908B6F]">No meals planned</span>
                      ) : over ? (
                        <span className="inline-flex items-center gap-1 text-[#B43C2E] font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          +{diff} kcal over
                        </span>
                      ) : onTrack ? (
                        <span className="inline-flex items-center gap-1 text-[#6A6754] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          On target
                        </span>
                      ) : (
                        <span className="text-[#4A483A]">
                          {diff > 0 ? `+${diff}` : diff} kcal
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
