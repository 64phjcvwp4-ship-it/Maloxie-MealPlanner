import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  Calculator,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  ArrowUpRight,
  Lock,
  Unlock,
} from 'lucide-react';
import {
  DayPlan,
  Macros,
  MealSlotType,
  NutritionTargets,
  PricingConfig,
  Recipe,
} from '../types/mealPlanner';
import {
  MEAL_SLOT_LABELS,
  computeDayMacros,
  generateGroceryList,
} from '../utils/groceryUtils';
import { formatShortDayHeader, formatWeekRangeLabel } from '../utils/dateUtils';
import {
  DEFAULT_PRICING_CONFIG,
  formatCurrency,
  getCurrencyOption,
  getIngredientLocalPrice,
} from '../utils/currencyUtils';
import { BubbleButton } from './BubbleControls';

interface NutritionViewProps {
  weeksDates: string[][];
  activeWeekIndex: number;
  onSelectWeek: (idx: number) => void;
  daysMap: Record<string, DayPlan>;
  recipesMap: Record<string, Recipe>;
  targets: NutritionTargets;
  pricing?: PricingConfig;
  householdMultiplier?: number;
  onUpdateTargets: (next: NutritionTargets) => void;
  onOpenRecipeDetail?: (recipe: Recipe) => void;
  onNavigateToCalendar?: () => void;
}

type ChartMetric = 'calories' | 'macroMix' | 'protein' | 'carbs' | 'fat';
type StudioMode = 'macros' | 'estimator';
type ContributorSort = 'protein' | 'calories' | 'value';

const GOAL_PRESETS: Array<{
  id: string;
  label: string;
  detail: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}> = [
  {
    id: 'fat-loss',
    label: 'Fat Loss',
    detail: '1,650 kcal · High satiety',
    calories: 1650,
    protein: 145,
    carbs: 145,
    fat: 55,
  },
  {
    id: 'balanced',
    label: 'Balanced',
    detail: '2,000 kcal · Daily rhythm',
    calories: 2000,
    protein: 140,
    carbs: 215,
    fat: 65,
  },
  {
    id: 'high-protein',
    label: 'High Protein',
    detail: '2,200 kcal · Lean muscle',
    calories: 2200,
    protein: 180,
    carbs: 210,
    fat: 70,
  },
  {
    id: 'low-carb',
    label: 'Low Carb',
    detail: '1,800 kcal · Steady energy',
    calories: 1800,
    protein: 155,
    carbs: 90,
    fat: 90,
  },
  {
    id: 'performance',
    label: 'Endurance',
    detail: '2,550 kcal · Training load',
    calories: 2550,
    protein: 165,
    carbs: 320,
    fat: 68,
  },
];

const RATIO_PRESETS: Array<{ label: string; p: number; c: number; f: number }> = [
  { label: '30P / 40C / 30F', p: 30, c: 40, f: 30 },
  { label: '40P / 30C / 30F', p: 40, c: 30, f: 30 },
  { label: '35P / 45C / 20F', p: 35, c: 45, f: 20 },
  { label: '30P / 20C / 50F', p: 30, c: 20, f: 50 },
];

const ACTIVITY_OPTIONS: Array<{ id: string; label: string; factor: number }> = [
  { id: 'sedentary', label: 'Sedentary (desk work)', factor: 1.2 },
  { id: 'light', label: 'Light (1–2 workouts/wk)', factor: 1.375 },
  { id: 'moderate', label: 'Moderate (3–4 workouts/wk)', factor: 1.55 },
  { id: 'active', label: 'Active (5+ workouts/wk)', factor: 1.725 },
  { id: 'athlete', label: 'Very Active (daily training)', factor: 1.9 },
];

const GOAL_ADJUSTMENTS: Array<{ id: string; label: string; multiplier: number }> = [
  { id: 'cut', label: 'Fat Loss (-20%)', multiplier: 0.8 },
  { id: 'recomp', label: 'Mild Deficit (-10%)', multiplier: 0.9 },
  { id: 'maintain', label: 'Maintain (0%)', multiplier: 1.0 },
  { id: 'gain', label: 'Lean Gain (+12%)', multiplier: 1.12 },
];

const SLOTS_ORDER: MealSlotType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export const NutritionView: React.FC<NutritionViewProps> = ({
  weeksDates,
  activeWeekIndex,
  onSelectWeek,
  daysMap,
  recipesMap,
  targets,
  pricing = DEFAULT_PRICING_CONFIG,
  householdMultiplier = 1,
  onUpdateTargets,
  onOpenRecipeDetail,
  onNavigateToCalendar,
}) => {
  const [studioOpen, setStudioOpen] = useState(false);
  const [studioMode, setStudioMode] = useState<StudioMode>('macros');
  const [syncCaloriesToMacros, setSyncCaloriesToMacros] = useState(true);
  const [chartMetric, setChartMetric] = useState<ChartMetric>('calories');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [expandedLedgerDate, setExpandedLedgerDate] = useState<string | null>(null);
  const [contributorSort, setContributorSort] = useState<ContributorSort>('protein');

  // TDEE Estimator state (stored as strings so users can clear & type freely)
  const [sex, setSex] = useState<'female' | 'male'>('female');
  const [ageInput, setAgeInput] = useState('30');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [weightInput, setWeightInput] = useState('68');
  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCmInput, setHeightCmInput] = useState('170');
  const [heightFtInput, setHeightFtInput] = useState('5');
  const [heightInInput, setHeightInInput] = useState('7');
  const [activityId, setActivityId] = useState('moderate');
  const [goalId, setGoalId] = useState('maintain');

  // Draft strings for Macro & Budget Studio number inputs so typing never snaps mid-keystroke
  const [macroDrafts, setMacroDrafts] = useState({
    calories: String(targets.calories),
    protein: String(targets.protein),
    carbs: String(targets.carbs),
    fat: String(targets.fat),
    weeklyBudget: String(targets.weeklyBudget),
  });

  useEffect(() => {
    setMacroDrafts({
      calories: String(targets.calories),
      protein: String(targets.protein),
      carbs: String(targets.carbs),
      fat: String(targets.fat),
      weeklyBudget: String(targets.weeklyBudget),
    });
  }, [targets.calories, targets.protein, targets.carbs, targets.fat, targets.weeklyBudget]);

  const weekDates = useMemo(
    () => weeksDates[activeWeekIndex] || weeksDates[0] || [],
    [weeksDates, activeWeekIndex]
  );

  const activeCurrency = useMemo(
    () => getCurrencyOption(pricing.currencyCode),
    [pricing.currencyCode]
  );

  const dailyStats = useMemo(() => {
    return weekDates.map((date) => {
      const day = daysMap[date];
      const macros = computeDayMacros(day, recipesMap);
      const slotBreakdown: Record<
        MealSlotType,
        { macros: Macros; titles: string[]; count: number }
      > = {
        breakfast: { macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, titles: [], count: 0 },
        lunch: { macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, titles: [], count: 0 },
        dinner: { macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, titles: [], count: 0 },
        snacks: { macros: { calories: 0, protein: 0, carbs: 0, fat: 0 }, titles: [], count: 0 },
      };

      let mealCount = 0;
      if (day) {
        for (const slot of SLOTS_ORDER) {
          for (const entry of day.slots[slot] || []) {
            const recipe = recipesMap[entry.recipeId];
            if (!recipe) continue;
            mealCount += 1;
            slotBreakdown[slot].count += 1;
            slotBreakdown[slot].titles.push(
              `${recipe.title}${entry.isLeftover ? ' (Leftover)' : ''}`
            );
            slotBreakdown[slot].macros.calories += Math.round(
              recipe.macrosPerServing.calories * entry.servings
            );
            slotBreakdown[slot].macros.protein += Math.round(
              recipe.macrosPerServing.protein * entry.servings
            );
            slotBreakdown[slot].macros.carbs += Math.round(
              recipe.macrosPerServing.carbs * entry.servings
            );
            slotBreakdown[slot].macros.fat += Math.round(
              recipe.macrosPerServing.fat * entry.servings
            );
          }
        }
      }

      return {
        date,
        header: formatShortDayHeader(date),
        macros,
        mealCount,
        slotBreakdown,
      };
    });
  }, [weekDates, daysMap, recipesMap]);

  const plannedDays = useMemo(
    () => dailyStats.filter((d) => d.macros.calories > 0),
    [dailyStats]
  );

  const weeklyTotals = useMemo(() => {
    return dailyStats.reduce(
      (acc, d) => ({
        calories: acc.calories + d.macros.calories,
        protein: acc.protein + d.macros.protein,
        carbs: acc.carbs + d.macros.carbs,
        fat: acc.fat + d.macros.fat,
        meals: acc.meals + d.mealCount,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 }
    );
  }, [dailyStats]);

  const activeDaysCount = Math.max(1, plannedDays.length);

  const avgDaily = useMemo(
    () => ({
      calories: plannedDays.length > 0 ? Math.round(weeklyTotals.calories / activeDaysCount) : 0,
      protein: plannedDays.length > 0 ? Math.round(weeklyTotals.protein / activeDaysCount) : 0,
      carbs: plannedDays.length > 0 ? Math.round(weeklyTotals.carbs / activeDaysCount) : 0,
      fat: plannedDays.length > 0 ? Math.round(weeklyTotals.fat / activeDaysCount) : 0,
    }),
    [plannedDays.length, weeklyTotals, activeDaysCount]
  );

  // Target percentages
  const targetMacroCals = Math.max(
    1,
    targets.protein * 4 + targets.carbs * 4 + targets.fat * 9
  );
  const targetPctP = Math.round(((targets.protein * 4) / targetMacroCals) * 100);
  const targetPctC = Math.round(((targets.carbs * 4) / targetMacroCals) * 100);
  const targetPctF = Math.max(0, 100 - targetPctP - targetPctC);

  // Actual caloric split
  const actualMacroCals = Math.max(
    1,
    avgDaily.protein * 4 + avgDaily.carbs * 4 + avgDaily.fat * 9
  );
  const actualPctP =
    plannedDays.length > 0 ? Math.round(((avgDaily.protein * 4) / actualMacroCals) * 100) : 0;
  const actualPctC =
    plannedDays.length > 0 ? Math.round(((avgDaily.carbs * 4) / actualMacroCals) * 100) : 0;
  const actualPctF =
    plannedDays.length > 0 ? Math.max(0, 100 - actualPctP - actualPctC) : 0;

  // Adherence and nutrition efficiency
  const adherenceDaysCount = useMemo(() => {
    return plannedDays.filter(
      (d) => Math.abs(d.macros.calories - targets.calories) <= Math.round(targets.calories * 0.12)
    ).length;
  }, [plannedDays, targets.calories]);

  const proteinHitDaysCount = useMemo(() => {
    return plannedDays.filter((d) => d.macros.protein >= targets.protein * 0.9).length;
  }, [plannedDays, targets.protein]);

  const proteinDensity = useMemo(() => {
    if (avgDaily.calories <= 0) return 0;
    return Math.round((avgDaily.protein / avgDaily.calories) * 1000) / 10;
  }, [avgDaily]);

  const weeklyEstimatedCost = useMemo(() => {
    const items = generateGroceryList(
      weekDates,
      daysMap,
      recipesMap,
      householdMultiplier,
      [],
      pricing
    );
    return items.reduce((sum, i) => sum + i.estimatedPrice, 0);
  }, [weekDates, daysMap, recipesMap, householdMultiplier, pricing]);

  const costPer100gProtein = useMemo(() => {
    const totalPersonalProtein = weeklyTotals.protein * householdMultiplier;
    if (totalPersonalProtein <= 0 || weeklyEstimatedCost <= 0) return 0;
    return (weeklyEstimatedCost / totalPersonalProtein) * 100;
  }, [weeklyTotals.protein, householdMultiplier, weeklyEstimatedCost]);

  // Meal slot distribution across planned days
  const slotDistribution = useMemo(() => {
    const sums: Record<MealSlotType, Macros & { meals: number }> = {
      breakfast: { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
      lunch: { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
      dinner: { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
      snacks: { calories: 0, protein: 0, carbs: 0, fat: 0, meals: 0 },
    };

    for (const day of dailyStats) {
      for (const slot of SLOTS_ORDER) {
        const b = day.slotBreakdown[slot];
        sums[slot].calories += b.macros.calories;
        sums[slot].protein += b.macros.protein;
        sums[slot].carbs += b.macros.carbs;
        sums[slot].fat += b.macros.fat;
        sums[slot].meals += b.count;
      }
    }

    const totalCal = Math.max(1, weeklyTotals.calories);
    return SLOTS_ORDER.map((slot) => {
      const s = sums[slot];
      const avgCal = plannedDays.length > 0 ? Math.round(s.calories / activeDaysCount) : 0;
      const avgPro = plannedDays.length > 0 ? Math.round(s.protein / activeDaysCount) : 0;
      const sharePct =
        plannedDays.length > 0 ? Math.round((s.calories / totalCal) * 100) : 0;
      return {
        slot,
        label: MEAL_SLOT_LABELS[slot],
        avgCal,
        avgPro,
        sharePct,
        meals: s.meals,
      };
    });
  }, [dailyStats, weeklyTotals.calories, plannedDays.length, activeDaysCount]);

  // Top recipe contributors for the week
  const topContributors = useMemo(() => {
    const map = new Map<
      string,
      {
        recipe: Recipe;
        servingsCount: number;
        totalCalories: number;
        totalProtein: number;
        costPerServing: number;
        gramsProteinPerCostUnit: number;
      }
    >();

    for (const date of weekDates) {
      const day = daysMap[date];
      if (!day) continue;
      for (const slot of SLOTS_ORDER) {
        for (const entry of day.slots[slot] || []) {
          const recipe = recipesMap[entry.recipeId];
          if (!recipe) continue;

          const baseTotalCost = recipe.ingredients.reduce(
            (sum, ing) => sum + getIngredientLocalPrice(ing, 1, pricing).price,
            0
          );
          const costPerSrv = baseTotalCost / Math.max(1, recipe.servings);

          const existing = map.get(recipe.id);
          const addCal = recipe.macrosPerServing.calories * entry.servings;
          const addPro = recipe.macrosPerServing.protein * entry.servings;

          if (existing) {
            existing.servingsCount += entry.servings;
            existing.totalCalories += addCal;
            existing.totalProtein += addPro;
          } else {
            map.set(recipe.id, {
              recipe,
              servingsCount: entry.servings,
              totalCalories: addCal,
              totalProtein: addPro,
              costPerServing: costPerSrv,
              gramsProteinPerCostUnit:
                costPerSrv > 0 ? recipe.macrosPerServing.protein / costPerSrv : 0,
            });
          }
        }
      }
    }

    const list = Array.from(map.values());
    if (contributorSort === 'protein') {
      list.sort((a, b) => b.totalProtein - a.totalProtein);
    } else if (contributorSort === 'calories') {
      list.sort((a, b) => b.totalCalories - a.totalCalories);
    } else {
      list.sort((a, b) => b.gramsProteinPerCostUnit - a.gramsProteinPerCostUnit);
    }
    return list.slice(0, 5);
  }, [weekDates, daysMap, recipesMap, pricing, contributorSort]);

  // Inspected day in chart (defaults to selectedDate if present in current week, else first planned day)
  const inspectedDay = useMemo(() => {
    if (selectedDate) {
      const match = dailyStats.find((d) => d.date === selectedDate);
      if (match) return match;
    }
    return dailyStats.find((d) => d.macros.calories > 0) || dailyStats[0] || null;
  }, [selectedDate, dailyStats]);

  // TDEE Estimator calculations
  const parsedAge = useMemo(() => {
    const n = Number(ageInput);
    return ageInput.trim() !== '' && Number.isFinite(n) ? Math.max(12, Math.min(105, n)) : 30;
  }, [ageInput]);

  const parsedWeightVal = useMemo(() => {
    const n = Number(weightInput);
    const fallback = weightUnit === 'kg' ? 68 : 150;
    return weightInput.trim() !== '' && Number.isFinite(n) ? Math.max(20, Math.min(600, n)) : fallback;
  }, [weightInput, weightUnit]);

  const parsedHeightCm = useMemo(() => {
    if (heightUnit === 'cm') {
      const n = Number(heightCmInput);
      return heightCmInput.trim() !== '' && Number.isFinite(n)
        ? Math.max(90, Math.min(250, n))
        : 170;
    }
    const ft = Number(heightFtInput);
    const inches = Number(heightInInput);
    const safeFt = heightFtInput.trim() !== '' && Number.isFinite(ft) ? Math.max(3, Math.min(8, ft)) : 5;
    const safeIn =
      heightInInput.trim() !== '' && Number.isFinite(inches) ? Math.max(0, Math.min(11.9, inches)) : 0;
    return Math.max(90, Math.min(250, (safeFt * 12 + safeIn) * 2.54));
  }, [heightUnit, heightCmInput, heightFtInput, heightInInput]);

  const tdeeEstimate = useMemo(() => {
    const weightKg = weightUnit === 'kg' ? parsedWeightVal : parsedWeightVal * 0.453592;
    const baseBmr = 10 * weightKg + 6.25 * parsedHeightCm - 5 * parsedAge + (sex === 'male' ? 5 : -161);
    const bmr = Math.max(800, Math.round(baseBmr));
    const activity = ACTIVITY_OPTIONS.find((a) => a.id === activityId) || ACTIVITY_OPTIONS[2];
    const maintenance = Math.round(bmr * activity.factor);
    const goal = GOAL_ADJUSTMENTS.find((g) => g.id === goalId) || GOAL_ADJUSTMENTS[2];
    const targetCalories = Math.max(1000, Math.round((maintenance * goal.multiplier) / 10) * 10);

    // Evidence-based protein ~1.75–2.0g/kg depending on deficit, bounded cleanly
    const proteinPerKg = goalId === 'cut' || goalId === 'recomp' ? 2.0 : 1.75;
    const protein = Math.min(280, Math.max(60, Math.round((weightKg * proteinPerKg) / 5) * 5));
    const fatCalories = Math.round(targetCalories * 0.28);
    const fat = Math.max(35, Math.round(fatCalories / 9 / 5) * 5);
    const remainingCals = Math.max(160, targetCalories - protein * 4 - fat * 9);
    const carbs = Math.max(40, Math.round(remainingCals / 4 / 5) * 5);

    return {
      bmr,
      maintenance,
      targetCalories: protein * 4 + carbs * 4 + fat * 9,
      protein,
      carbs,
      fat,
    };
  }, [sex, parsedAge, weightUnit, parsedWeightVal, parsedHeightCm, activityId, goalId]);

  const handleUpdateMacroField = (field: 'protein' | 'carbs' | 'fat', rawVal: number) => {
    const value = Math.max(0, Math.round(rawVal));
    const next = { ...targets, [field]: value };
    if (syncCaloriesToMacros) {
      next.calories = Math.max(800, next.protein * 4 + next.carbs * 4 + next.fat * 9);
    }
    onUpdateTargets(next);
  };

  const handleApplyRatioSplit = (pPct: number, cPct: number, fPct: number) => {
    const cals = Math.max(1000, targets.calories);
    const protein = Math.round((cals * (pPct / 100)) / 4);
    const carbs = Math.round((cals * (cPct / 100)) / 4);
    const fat = Math.round((cals * (fPct / 100)) / 9);
    onUpdateTargets({
      ...targets,
      protein,
      carbs,
      fat,
      calories: syncCaloriesToMacros ? protein * 4 + carbs * 4 + fat * 9 : cals,
    });
  };

  // Chart scaling
  const chartTargetValue =
    chartMetric === 'calories' || chartMetric === 'macroMix'
      ? targets.calories
      : chartMetric === 'protein'
      ? targets.protein
      : chartMetric === 'carbs'
      ? targets.carbs
      : targets.fat;

  const chartMax = useMemo(() => {
    const dayMax = dailyStats.reduce((max, d) => {
      const val =
        chartMetric === 'calories' || chartMetric === 'macroMix'
          ? d.macros.calories
          : chartMetric === 'protein'
          ? d.macros.protein
          : chartMetric === 'carbs'
          ? d.macros.carbs
          : d.macros.fat;
      return Math.max(max, val);
    }, 0);
    return Math.max(chartTargetValue * 1.22, dayMax * 1.12, chartMetric === 'calories' || chartMetric === 'macroMix' ? 1200 : 80);
  }, [dailyStats, chartMetric, chartTargetValue]);

  // SVG Donut ring geometry
  const donutRadius = 56;
  const donutCircumference = 2 * Math.PI * donutRadius;
  const pStroke = (actualPctP / 100) * donutCircumference;
  const cStroke = (actualPctC / 100) * donutCircumference;
  const fStroke = (actualPctF / 100) * donutCircumference;

  return (
    <div className="space-y-6">
      {/* Top Bar: Week Selector + Studio Toggle */}
      <div className="bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#EAE4E0]/80 rounded-full overflow-x-auto">
            {weeksDates.map((dates, idx) => (
              <BubbleButton
                key={idx}
                variant={activeWeekIndex === idx ? 'dark' : 'default'}
                size="sm"
                onClick={() => {
                  onSelectWeek(idx);
                  setSelectedDate(null);
                  setExpandedLedgerDate(null);
                }}
              >
                Week {idx + 1} · {formatWeekRangeLabel(dates)}
              </BubbleButton>
            ))}
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs text-[#6A6754] font-mono tabular-nums">
            <span>{plannedDays.length}/7 days planned</span>
            <span aria-hidden="true">·</span>
            <span>{weeklyTotals.meals} meals</span>
            <span aria-hidden="true">·</span>
            <span>
              {adherenceDaysCount}/{plannedDays.length || 0} on calorie goal
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <BubbleButton
            variant={studioOpen && studioMode === 'estimator' ? 'dark' : 'sage'}
            size="sm"
            onClick={() => {
              if (studioOpen && studioMode === 'estimator') {
                setStudioOpen(false);
              } else {
                setStudioMode('estimator');
                setStudioOpen(true);
              }
            }}
          >
            <Calculator className="w-3.5 h-3.5" />
            <span>TDEE Calculator</span>
          </BubbleButton>

          <BubbleButton
            variant={studioOpen && studioMode === 'macros' ? 'dark' : 'terracotta'}
            size="md"
            onClick={() => {
              if (studioOpen && studioMode === 'macros') {
                setStudioOpen(false);
              } else {
                setStudioMode('macros');
                setStudioOpen(true);
              }
            }}
          >
            <Target className="w-3.5 h-3.5" />
            <span>
              {studioOpen && studioMode === 'macros' ? 'Close Target Studio' : 'Edit Targets'}
            </span>
          </BubbleButton>
        </div>
      </div>

      {/* Expandable Target Studio & TDEE Calculator */}
      {studioOpen && (
        <section className="bg-[#FAF8F6]/92 maloxie-peach-block rounded-2xl p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#D9D0CB]/80">
            <div className="flex items-center gap-1 p-1 bg-[#EAE4E0] rounded-full">
              <button
                type="button"
                onClick={() => setStudioMode('macros')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  studioMode === 'macros'
                    ? 'bg-[#2E2D24] text-[#FAF8F6]'
                    : 'text-[#4A483A] hover:text-[#2E2D24]'
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Macro &amp; Budget Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setStudioMode('estimator')}
                className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  studioMode === 'estimator'
                    ? 'bg-[#2E2D24] text-[#FAF8F6]'
                    : 'text-[#4A483A] hover:text-[#2E2D24]'
                }`}
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Daily Needs Estimator (TDEE)</span>
              </button>
            </div>

            {studioMode === 'macros' && (
              <button
                type="button"
                onClick={() => setSyncCaloriesToMacros((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#D9D0CB] bg-[#F3EFEC] hover:bg-[#EAE4E0] text-xs font-medium text-[#2E2D24] transition-colors whitespace-nowrap shrink-0"
              >
                {syncCaloriesToMacros ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-[#6A6754]" />
                    <span>Calories auto-synced to macros (4/4/9)</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-[#908B6F]" />
                    <span>Calories unlocked (manual override)</span>
                  </>
                )}
              </button>
            )}
          </div>

          {studioMode === 'macros' ? (
            <div className="space-y-6">
              {/* Goal Presets */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {GOAL_PRESETS.map((preset) => {
                  const isMatch =
                    Math.abs(targets.calories - preset.calories) <= 25 &&
                    Math.abs(targets.protein - preset.protein) <= 5;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() =>
                        onUpdateTargets({
                          ...targets,
                          calories: preset.calories,
                          protein: preset.protein,
                          carbs: preset.carbs,
                          fat: preset.fat,
                        })
                      }
                      className={`text-left px-3.5 py-2.5 rounded-xl border transition-colors ${
                        isMatch
                          ? 'bg-[#2E2D24] text-[#FAF8F6] border-[#2E2D24]'
                          : 'bg-[#F3EFEC]/70 text-[#2E2D24] border-[#D9D0CB] hover:bg-[#EAE4E0]/75'
                      }`}
                    >
                      <div className="text-xs font-semibold">{preset.label}</div>
                      <div
                        className={`text-[11px] font-mono tabular-nums mt-0.5 ${
                          isMatch ? 'text-[#D9D0CB]' : 'text-[#6A6754]'
                        }`}
                      >
                        {preset.detail}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Interactive Sliders + Numeric Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 pt-2">
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="font-medium text-[#4A483A]">Daily Calories</label>
                    <span className="font-mono font-semibold tabular-nums text-[#2E2D24]">
                      {targets.calories} kcal
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1100}
                    max={4000}
                    step={25}
                    value={targets.calories}
                    disabled={syncCaloriesToMacros}
                    onChange={(e) =>
                      onUpdateTargets({ ...targets, calories: Number(e.target.value) })
                    }
                    className="w-full accent-[#6A6754] disabled:opacity-50 cursor-pointer"
                  />
                  <input
                    type="number"
                    min={800}
                    max={6000}
                    step={25}
                    value={macroDrafts.calories}
                    disabled={syncCaloriesToMacros}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setMacroDrafts((d) => ({ ...d, calories: raw }));
                      const num = Number(raw);
                      if (raw.trim() !== '' && Number.isFinite(num) && num >= 800) {
                        onUpdateTargets({
                          ...targets,
                          calories: Math.min(6000, Math.round(num)),
                        });
                      }
                    }}
                    onBlur={() => {
                      const num = Number(macroDrafts.calories);
                      const valid =
                        macroDrafts.calories.trim() !== '' && Number.isFinite(num)
                          ? Math.max(800, Math.min(6000, Math.round(num)))
                          : targets.calories;
                      onUpdateTargets({ ...targets, calories: valid });
                      setMacroDrafts((d) => ({ ...d, calories: String(valid) }));
                    }}
                    className="mt-1.5 w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                  />
                </div>

                {(
                  [
                    {
                      key: 'protein',
                      label: 'Protein (4 kcal/g)',
                      pct: targetPctP,
                      accent: 'accent-[#4A483A]',
                      min: 40,
                      max: 320,
                    },
                    {
                      key: 'carbs',
                      label: 'Carbs (4 kcal/g)',
                      pct: targetPctC,
                      accent: 'accent-[#908B6F]',
                      min: 20,
                      max: 480,
                    },
                    {
                      key: 'fat',
                      label: 'Fat (9 kcal/g)',
                      pct: targetPctF,
                      accent: 'accent-[#B86B4B]',
                      min: 20,
                      max: 180,
                    },
                  ] as const
                ).map((macro) => (
                  <div key={macro.key}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <label className="font-medium text-[#4A483A]">{macro.label}</label>
                      <span className="font-mono font-semibold tabular-nums text-[#2E2D24]">
                        {targets[macro.key]}g · {macro.pct}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={macro.min}
                      max={macro.max}
                      step={5}
                      value={targets[macro.key]}
                      onChange={(e) =>
                        handleUpdateMacroField(macro.key, Number(e.target.value))
                      }
                      className={`w-full ${macro.accent} cursor-pointer`}
                    />
                    <input
                      type="number"
                      min={0}
                      max={600}
                      step={5}
                      value={macroDrafts[macro.key]}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setMacroDrafts((d) => ({ ...d, [macro.key]: raw }));
                        const num = Number(raw);
                        if (raw.trim() !== '' && Number.isFinite(num) && num >= 0) {
                          handleUpdateMacroField(macro.key, Math.min(600, num));
                        }
                      }}
                      onBlur={() => {
                        const num = Number(macroDrafts[macro.key]);
                        const valid =
                          macroDrafts[macro.key].trim() !== '' && Number.isFinite(num)
                            ? Math.max(0, Math.min(600, Math.round(num)))
                            : targets[macro.key];
                        handleUpdateMacroField(macro.key, valid);
                        setMacroDrafts((d) => ({ ...d, [macro.key]: String(valid) }));
                      }}
                      className="mt-1.5 w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                    />
                  </div>
                ))}

                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <label className="font-medium text-[#4A483A]">
                      Weekly Cap ({activeCurrency.code})
                    </label>
                    <span className="font-mono font-semibold tabular-nums text-[#14532D]">
                      {formatCurrency(targets.weeklyBudget, pricing.currencyCode, {
                        compact: true,
                      })}
                    </span>
                  </div>
                  <div className="h-[22px] flex items-center text-[11px] text-[#6A6754]">
                    {formatCurrency(targets.weeklyBudget / 7, pricing.currencyCode)} / day allowance
                  </div>
                  <input
                    type="number"
                    min={0}
                    step={activeCurrency.budgetStep}
                    value={macroDrafts.weeklyBudget}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setMacroDrafts((d) => ({ ...d, weeklyBudget: raw }));
                      const num = Number(raw);
                      if (raw.trim() !== '' && Number.isFinite(num) && num >= 0) {
                        onUpdateTargets({ ...targets, weeklyBudget: num });
                      }
                    }}
                    onBlur={() => {
                      const num = Number(macroDrafts.weeklyBudget);
                      const valid =
                        macroDrafts.weeklyBudget.trim() !== '' && Number.isFinite(num)
                          ? Math.max(0, num)
                          : targets.weeklyBudget;
                      onUpdateTargets({ ...targets, weeklyBudget: valid });
                      setMacroDrafts((d) => ({ ...d, weeklyBudget: String(valid) }));
                    }}
                    className="mt-1.5 w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#14532D] font-semibold border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#14532D]"
                  />
                </div>
              </div>

              {/* Target Macro Ratio Visualizer + Quick Ratio Splits */}
              <div className="pt-4 border-t border-[#D9D0CB]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-[#6A6754] font-mono tabular-nums">
                    <span>Target Macro Energy Split</span>
                    <span>
                      P {targetPctP}% · C {targetPctC}% · F {targetPctF}%
                    </span>
                  </div>
                  <div className="w-full h-2.5 rounded-full overflow-hidden flex bg-[#EAE4E0]">
                    <div
                      style={{ width: `${targetPctP}%` }}
                      className="bg-[#4A483A] transition-all"
                    />
                    <div
                      style={{ width: `${targetPctC}%` }}
                      className="bg-[#908B6F] transition-all"
                    />
                    <div
                      style={{ width: `${targetPctF}%` }}
                      className="bg-[#B86B4B] transition-all"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-[#6A6754] mr-1">Quick split:</span>
                  {RATIO_PRESETS.map((r) => (
                    <button
                      key={r.label}
                      type="button"
                      onClick={() => handleApplyRatioSplit(r.p, r.c, r.f)}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-mono tabular-nums bg-[#F3EFEC] hover:bg-[#EAE4E0] text-[#2E2D24] border border-[#D9D0CB] transition-colors whitespace-nowrap"
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* TDEE Calculator Mode */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#4A483A] mb-1">
                    Biological Sex
                  </label>
                  <div className="grid grid-cols-2 gap-1 p-1 bg-[#EAE4E0] rounded-lg text-xs">
                    {(['female', 'male'] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSex(s)}
                        className={`py-1.5 rounded-md font-medium capitalize transition-colors ${
                          sex === s ? 'bg-[#2E2D24] text-[#FAF8F6]' : 'text-[#4A483A]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="tdee-age" className="block text-xs font-medium text-[#4A483A] mb-1">
                    Age (years)
                  </label>
                  <input
                    id="tdee-age"
                    type="number"
                    inputMode="numeric"
                    min={12}
                    max={105}
                    value={ageInput}
                    onChange={(e) => setAgeInput(e.target.value)}
                    onBlur={() => {
                      const n = Number(ageInput);
                      const valid =
                        ageInput.trim() !== '' && Number.isFinite(n)
                          ? Math.max(12, Math.min(105, Math.round(n)))
                          : 30;
                      setAgeInput(String(valid));
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tdee-height-cm" className="text-xs font-medium text-[#4A483A]">
                      Height
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (heightUnit === 'cm') {
                          const totalInches = Math.round(parsedHeightCm / 2.54);
                          setHeightFtInput(String(Math.floor(totalInches / 12)));
                          setHeightInInput(String(totalInches % 12));
                          setHeightUnit('ft');
                        } else {
                          setHeightCmInput(String(Math.round(parsedHeightCm)));
                          setHeightUnit('cm');
                        }
                      }}
                      className="text-[11px] font-mono text-[#6A6754] underline"
                    >
                      {heightUnit === 'cm' ? 'cm (switch)' : 'ft·in (switch)'}
                    </button>
                  </div>
                  {heightUnit === 'cm' ? (
                    <input
                      id="tdee-height-cm"
                      type="number"
                      inputMode="decimal"
                      min={90}
                      max={250}
                      value={heightCmInput}
                      onChange={(e) => setHeightCmInput(e.target.value)}
                      onBlur={() => {
                        const n = Number(heightCmInput);
                        const valid =
                          heightCmInput.trim() !== '' && Number.isFinite(n)
                            ? Math.max(90, Math.min(250, Math.round(n)))
                            : 170;
                        setHeightCmInput(String(valid));
                      }}
                      className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                    />
                  ) : (
                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        id="tdee-height-cm"
                        type="number"
                        inputMode="numeric"
                        min={3}
                        max={8}
                        aria-label="Height feet"
                        placeholder="ft"
                        value={heightFtInput}
                        onChange={(e) => setHeightFtInput(e.target.value)}
                        onBlur={() => {
                          const n = Number(heightFtInput);
                          const valid =
                            heightFtInput.trim() !== '' && Number.isFinite(n)
                              ? Math.max(3, Math.min(8, Math.round(n)))
                              : 5;
                          setHeightFtInput(String(valid));
                        }}
                        className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                      />
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        max={11.9}
                        aria-label="Height inches"
                        placeholder="in"
                        value={heightInInput}
                        onChange={(e) => setHeightInInput(e.target.value)}
                        onBlur={() => {
                          const n = Number(heightInInput);
                          const valid =
                            heightInInput.trim() !== '' && Number.isFinite(n)
                              ? Math.max(0, Math.min(11, Math.round(n)))
                              : 0;
                          setHeightInInput(String(valid));
                        }}
                        className="w-full px-2.5 py-2 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label htmlFor="tdee-weight" className="text-xs font-medium text-[#4A483A]">
                      Weight
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        if (weightUnit === 'kg') {
                          setWeightUnit('lbs');
                          setWeightInput(String(Math.round(parsedWeightVal * 2.20462)));
                        } else {
                          setWeightUnit('kg');
                          setWeightInput(String(Math.round(parsedWeightVal / 2.20462)));
                        }
                      }}
                      className="text-[11px] font-mono text-[#6A6754] underline"
                    >
                      {weightUnit} (switch)
                    </button>
                  </div>
                  <input
                    id="tdee-weight"
                    type="number"
                    inputMode="decimal"
                    min={20}
                    max={600}
                    step="0.5"
                    value={weightInput}
                    onChange={(e) => setWeightInput(e.target.value)}
                    onBlur={() => {
                      const n = Number(weightInput);
                      const fallback = weightUnit === 'kg' ? 68 : 150;
                      const valid =
                        weightInput.trim() !== '' && Number.isFinite(n)
                          ? Math.max(20, Math.min(600, Math.round(n * 10) / 10))
                          : fallback;
                      setWeightInput(String(valid));
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#4A483A] mb-1">
                    Weekly Activity Level
                  </label>
                  <select
                    value={activityId}
                    onChange={(e) => setActivityId(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                  >
                    {ACTIVITY_OPTIONS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-span-2 sm:col-span-3">
                  <label className="block text-xs font-medium text-[#4A483A] mb-1.5">
                    Body Composition Goal
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {GOAL_ADJUSTMENTS.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setGoalId(g.id)}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                          goalId === g.id
                            ? 'bg-[#2E2D24] text-[#FAF8F6] border-[#2E2D24]'
                            : 'bg-[#FAF8F6] text-[#4A483A] border-[#D9D0CB] hover:bg-[#F3EFEC]'
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Calculated TDEE Summary */}
              <div className="lg:col-span-5 bg-[#F3EFEC]/80 border border-[#D9D0CB] rounded-xl p-5 space-y-4">
                <div className="flex items-baseline justify-between">
                  <div>
                    <div className="text-xs text-[#6A6754]">Estimated Daily Target</div>
                    <div className="font-mono text-2xl font-bold tabular-nums text-[#2E2D24] mt-0.5">
                      {tdeeEstimate.targetCalories.toLocaleString()} kcal
                    </div>
                  </div>
                  <div className="text-right text-xs font-mono tabular-nums text-[#6A6754]">
                    <div>BMR: {tdeeEstimate.bmr} kcal</div>
                    <div>Maintenance: {tdeeEstimate.maintenance} kcal</div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-3 border-t border-[#D9D0CB] text-center font-mono tabular-nums">
                  <div>
                    <div className="text-[11px] text-[#6A6754]">Protein</div>
                    <div className="text-sm font-semibold text-[#2E2D24]">
                      {tdeeEstimate.protein}g
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#6A6754]">Carbs</div>
                    <div className="text-sm font-semibold text-[#2E2D24]">
                      {tdeeEstimate.carbs}g
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-[#6A6754]">Fat</div>
                    <div className="text-sm font-semibold text-[#2E2D24]">
                      {tdeeEstimate.fat}g
                    </div>
                  </div>
                </div>

                <BubbleButton
                  variant="primary"
                  size="md"
                  className="w-full justify-center"
                  onClick={() => {
                    onUpdateTargets({
                      ...targets,
                      calories: tdeeEstimate.targetCalories,
                      protein: tdeeEstimate.protein,
                      carbs: tdeeEstimate.carbs,
                      fat: tdeeEstimate.fat,
                    });
                    setStudioMode('macros');
                  }}
                >
                  Apply Calculated Targets
                </BubbleButton>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Empty Week State */}
      {plannedDays.length === 0 ? (
        <div className="bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl p-12 text-center space-y-3">
          <h3 className="font-display text-lg font-semibold text-[#2E2D24]">
            No meals scheduled for Week {activeWeekIndex + 1} yet
          </h3>
          <p className="text-xs sm:text-sm text-[#6A6754] max-w-md mx-auto leading-relaxed">
            Add breakfasts, lunches, or dinners on the Calendar to unlock your daily macro curves,
            slot distribution, and cost-per-protein analysis.
          </p>
          {onNavigateToCalendar && (
            <div className="pt-2">
              <BubbleButton variant="primary" size="md" onClick={onNavigateToCalendar}>
                <CalendarDays className="w-3.5 h-3.5" />
                <span>Plan Week {activeWeekIndex + 1} Meals</span>
              </BubbleButton>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Primary Analytics Row: 7-Day Interactive Chart (8 col) + Macro Architecture (4 col) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Left 8 Columns: Multi-Metric Interactive Daily Chart + Selected Day Inspector */}
            <section className="lg:col-span-8 bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#2E2D24]">
                    7-Day Nutrition Trajectory
                  </h2>
                  <p className="text-xs text-[#6A6754] mt-0.5 font-mono tabular-nums">
                    Avg {avgDaily.calories.toLocaleString()} kcal · {avgDaily.protein}g P ·{' '}
                    {avgDaily.carbs}g C · {avgDaily.fat}g F across {plannedDays.length} planned days
                  </p>
                </div>

                {/* Metric Selector */}
                <div className="flex items-center gap-1 p-1 bg-[#EAE4E0]/80 rounded-full overflow-x-auto">
                  {(
                    [
                      { id: 'calories', label: 'Calories' },
                      { id: 'macroMix', label: 'Macro Mix' },
                      { id: 'protein', label: 'Protein' },
                      { id: 'carbs', label: 'Carbs' },
                      { id: 'fat', label: 'Fat' },
                    ] as const
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setChartMetric(m.id)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        chartMetric === m.id
                          ? 'bg-[#2E2D24] text-[#FAF8F6]'
                          : 'text-[#4A483A] hover:text-[#2E2D24]'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* SVG Chart Canvas */}
              <div className="relative w-full">
                <svg
                  viewBox="0 0 700 240"
                  className="w-full h-56 sm:h-64 overflow-visible"
                  role="img"
                  aria-label="7-day nutrition intake chart"
                >
                  {/* Horizontal Gridlines */}
                  {[0.25, 0.5, 0.75, 1].map((frac) => {
                    const y = 198 - frac * 170;
                    const labelVal = Math.round(chartMax * frac);
                    return (
                      <g key={frac}>
                        <line
                          x1={44}
                          x2={690}
                          y1={y}
                          y2={y}
                          stroke="#D9D0CB"
                          strokeOpacity={0.65}
                          strokeWidth={1}
                        />
                        <text
                          x={38}
                          y={y + 3}
                          textAnchor="end"
                          className="fill-[#908B6F] text-[10px] font-mono tabular-nums"
                        >
                          {labelVal}
                        </text>
                      </g>
                    );
                  })}

                  {/* Target Dashed Reference Line */}
                  {(() => {
                    const targetY = 198 - Math.min(1, chartTargetValue / chartMax) * 170;
                    const unit =
                      chartMetric === 'calories' || chartMetric === 'macroMix' ? 'kcal' : 'g';
                    return (
                      <g>
                        <line
                          x1={44}
                          x2={690}
                          y1={targetY}
                          y2={targetY}
                          stroke="#6A6754"
                          strokeDasharray="5 4"
                          strokeWidth={1.5}
                        />
                        <rect
                          x={598}
                          y={targetY - 17}
                          width={90}
                          height={15}
                          rx={4}
                          fill="#FAF8F6"
                          stroke="#D9D0CB"
                          strokeWidth={1}
                        />
                        <text
                          x={643}
                          y={targetY - 6}
                          textAnchor="middle"
                          className="fill-[#4A483A] text-[10px] font-mono font-semibold tabular-nums"
                        >
                          Goal {chartTargetValue} {unit}
                        </text>
                      </g>
                    );
                  })()}

                  {/* 7 Day Bars */}
                  {dailyStats.map((d, idx) => {
                    const colWidth = (690 - 54) / 7;
                    const centerX = 54 + idx * colWidth + colWidth / 2;
                    const barW = 42;
                    const barX = centerX - barW / 2;
                    const isSelected = inspectedDay?.date === d.date;

                    const val =
                      chartMetric === 'calories' || chartMetric === 'macroMix'
                        ? d.macros.calories
                        : chartMetric === 'protein'
                        ? d.macros.protein
                        : chartMetric === 'carbs'
                        ? d.macros.carbs
                        : d.macros.fat;

                    const barHeight = val > 0 ? Math.max(4, (val / chartMax) * 170) : 0;
                    const barY = 198 - barHeight;
                    const isOverTarget = val > chartTargetValue * 1.12;

                    // Stacked segment heights for Macro Mix mode
                    const pCal = d.macros.protein * 4;
                    const cCal = d.macros.carbs * 4;
                    const fCal = d.macros.fat * 9;
                    const macroSum = Math.max(1, pCal + cCal + fCal);
                    const pH = (pCal / macroSum) * barHeight;
                    const cH = (cCal / macroSum) * barHeight;
                    const fH = Math.max(0, barHeight - pH - cH);

                    const singleBarFill =
                      isOverTarget
                        ? '#B43C2E'
                        : chartMetric === 'protein'
                        ? '#4A483A'
                        : chartMetric === 'carbs'
                        ? '#908B6F'
                        : chartMetric === 'fat'
                        ? '#B86B4B'
                        : '#6A6754';

                    return (
                      <g
                        key={d.date}
                        onClick={() => setSelectedDate(d.date)}
                        className="cursor-pointer group"
                      >
                        {/* Subtle selection highlight column */}
                        <rect
                          x={centerX - colWidth / 2 + 4}
                          y={14}
                          width={colWidth - 8}
                          height={212}
                          rx={10}
                          fill={isSelected ? '#EAE4E0' : 'transparent'}
                          fillOpacity={isSelected ? 0.65 : 0}
                        />

                        {/* Empty background track */}
                        <rect
                          x={barX}
                          y={28}
                          width={barW}
                          height={170}
                          rx={6}
                          fill="#EAE4E0"
                          fillOpacity={0.45}
                        />

                        {val > 0 && chartMetric === 'macroMix' ? (
                          <g>
                            {/* Protein bottom */}
                            <rect
                              x={barX}
                              y={198 - pH}
                              width={barW}
                              height={pH}
                              fill="#4A483A"
                            />
                            {/* Carbs middle */}
                            <rect
                              x={barX}
                              y={198 - pH - cH}
                              width={barW}
                              height={cH}
                              fill="#908B6F"
                            />
                            {/* Fat top */}
                            <rect
                              x={barX}
                              y={198 - pH - cH - fH}
                              width={barW}
                              height={fH}
                              rx={4}
                              fill="#B86B4B"
                            />
                          </g>
                        ) : val > 0 ? (
                          <rect
                            x={barX}
                            y={barY}
                            width={barW}
                            height={barHeight}
                            rx={6}
                            fill={singleBarFill}
                            className="transition-opacity group-hover:opacity-90"
                          />
                        ) : null}

                        {/* Value label above bar */}
                        <text
                          x={centerX}
                          y={Math.max(18, barY - 6)}
                          textAnchor="middle"
                          className={`text-[11px] font-mono tabular-nums ${
                            isSelected ? 'fill-[#2E2D24] font-semibold' : 'fill-[#6A6754]'
                          }`}
                        >
                          {val > 0 ? val : '—'}
                        </text>

                        {/* Weekday footer label */}
                        <text
                          x={centerX}
                          y={216}
                          textAnchor="middle"
                          className={`text-[11px] font-medium ${
                            isSelected ? 'fill-[#2E2D24] font-semibold' : 'fill-[#4A483A]'
                          }`}
                        >
                          {d.header.weekday}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {chartMetric === 'macroMix' && (
                  <div className="flex items-center justify-end gap-4 text-[11px] text-[#6A6754] pt-1">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#4A483A]" />
                      Protein
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#908B6F]" />
                      Carbs
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#B86B4B]" />
                      Fat
                    </span>
                  </div>
                )}
              </div>

              {/* Inline Selected Day Inspector */}
              {inspectedDay && (
                <div className="pt-4 border-t border-[#D9D0CB]/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold text-[#2E2D24]">
                      {inspectedDay.header.weekday}, {inspectedDay.header.monthShort}{' '}
                      {inspectedDay.header.dayNum}
                      <span className="font-normal text-[#6A6754] ml-2">
                        · {inspectedDay.mealCount} meal{inspectedDay.mealCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-xs text-[#6A6754] mt-0.5 truncate max-w-xl">
                      {SLOTS_ORDER.map((s) =>
                        inspectedDay.slotBreakdown[s].titles.length > 0
                          ? `${MEAL_SLOT_LABELS[s]}: ${inspectedDay.slotBreakdown[s].titles.join(', ')}`
                          : null
                      )
                        .filter(Boolean)
                        .join(' · ') || 'No meals assigned to this day yet.'}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-xs font-mono tabular-nums shrink-0">
                    <div>
                      <span className="text-[#6A6754]">kcal </span>
                      <span className="font-semibold text-[#2E2D24]">
                        {inspectedDay.macros.calories}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6A6754]">P </span>
                      <span className="font-semibold text-[#4A483A]">
                        {inspectedDay.macros.protein}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6A6754]">C </span>
                      <span className="font-semibold text-[#2E2D24]">
                        {inspectedDay.macros.carbs}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[#6A6754]">F </span>
                      <span className="font-semibold text-[#B86B4B]">
                        {inspectedDay.macros.fat}g
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Right 4 Columns: Caloric Macro Donut + Target Gauges + Efficiency Metrics */}
            <section className="lg:col-span-4 bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[#2E2D24]">
                  Macro Architecture
                </h2>
                <p className="text-xs text-[#6A6754] mt-0.5">
                  Daily average energy share vs your {targets.calories.toLocaleString()} kcal target
                </p>
              </div>

              {/* SVG Segmented Donut Ring */}
              <div className="flex items-center gap-5">
                <div className="relative w-36 h-36 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                    <circle
                      cx="70"
                      cy="70"
                      r={donutRadius}
                      fill="none"
                      stroke="#EAE4E0"
                      strokeWidth="14"
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={donutRadius}
                      fill="none"
                      stroke="#4A483A"
                      strokeWidth="14"
                      strokeDasharray={`${pStroke} ${donutCircumference}`}
                      strokeDashoffset={0}
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={donutRadius}
                      fill="none"
                      stroke="#908B6F"
                      strokeWidth="14"
                      strokeDasharray={`${cStroke} ${donutCircumference}`}
                      strokeDashoffset={-pStroke}
                    />
                    <circle
                      cx="70"
                      cy="70"
                      r={donutRadius}
                      fill="none"
                      stroke="#B86B4B"
                      strokeWidth="14"
                      strokeDasharray={`${fStroke} ${donutCircumference}`}
                      strokeDashoffset={-(pStroke + cStroke)}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="font-mono text-xl font-bold tabular-nums text-[#2E2D24]">
                      {avgDaily.calories.toLocaleString()}
                    </span>
                    <span className="text-[11px] text-[#6A6754]">avg kcal/day</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#4A483A]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#4A483A]" />
                      Protein
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#2E2D24]">
                      {actualPctP}%{' '}
                      <span className="text-[#908B6F] font-normal">({targetPctP}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#4A483A]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#908B6F]" />
                      Carbs
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#2E2D24]">
                      {actualPctC}%{' '}
                      <span className="text-[#908B6F] font-normal">({targetPctC}%)</span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[#4A483A]">
                      <span className="w-2.5 h-2.5 rounded-sm bg-[#B86B4B]" />
                      Fat
                    </span>
                    <span className="font-mono tabular-nums font-semibold text-[#2E2D24]">
                      {actualPctF}%{' '}
                      <span className="text-[#908B6F] font-normal">({targetPctF}%)</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* 4 Macro Attainment Gauges */}
              <div className="space-y-3 pt-3 border-t border-[#D9D0CB]/80">
                {(
                  [
                    {
                      label: 'Calories',
                      val: avgDaily.calories,
                      target: targets.calories,
                      unit: 'kcal',
                      barClass: 'bg-[#6A6754]',
                    },
                    {
                      label: 'Protein',
                      val: avgDaily.protein,
                      target: targets.protein,
                      unit: 'g',
                      barClass: 'bg-[#4A483A]',
                    },
                    {
                      label: 'Carbohydrates',
                      val: avgDaily.carbs,
                      target: targets.carbs,
                      unit: 'g',
                      barClass: 'bg-[#908B6F]',
                    },
                    {
                      label: 'Dietary Fat',
                      val: avgDaily.fat,
                      target: targets.fat,
                      unit: 'g',
                      barClass: 'bg-[#B86B4B]',
                    },
                  ] as const
                ).map((item) => {
                  const pct = Math.min(
                    100,
                    Math.round((item.val / Math.max(1, item.target)) * 100)
                  );
                  const diff = item.val - item.target;
                  const isOver = item.val > item.target * 1.12;
                  return (
                    <div key={item.label} className="space-y-1">
                      <div className="flex items-baseline justify-between text-xs">
                        <span className="font-medium text-[#2E2D24]">{item.label}</span>
                        <span className="font-mono tabular-nums text-[#4A483A]">
                          <strong className="text-[#2E2D24]">{item.val}</strong> / {item.target}{' '}
                          {item.unit}
                          <span
                            className={`ml-1.5 text-[11px] ${
                              isOver ? 'text-[#B43C2E]' : 'text-[#6A6754]'
                            }`}
                          >
                            ({diff >= 0 ? `+${diff}` : diff})
                          </span>
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-[#EAE4E0] overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            isOver ? 'bg-[#B43C2E]' : item.barClass
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Efficiency Footer Metrics */}
              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-[#D9D0CB]/80 text-xs font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-[#6A6754]">Protein density</div>
                  <div className="font-semibold text-[#2E2D24] mt-0.5">
                    {proteinDensity}g / 100kcal
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-[#6A6754]">Protein hit</div>
                  <div className="font-semibold text-[#2E2D24] mt-0.5">
                    {proteinHitDaysCount}/{plannedDays.length} days
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-[#6A6754]">Cost / 100g P</div>
                  <div className="font-semibold text-[#14532D] mt-0.5">
                    {costPer100gProtein > 0
                      ? formatCurrency(costPer100gProtein, pricing.currencyCode)
                      : '—'}
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* Second Row: Meal Slot Distribution + Top Nutrient Contributors */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* Meal Slot Energy & Protein Distribution */}
            <section className="lg:col-span-6 bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-5">
              <div>
                <h2 className="text-base font-semibold text-[#2E2D24]">
                  Meal Slot Distribution
                </h2>
                <p className="text-xs text-[#6A6754] mt-0.5">
                  Where your daily calories and protein are concentrated across the day
                </p>
              </div>

              <div className="space-y-4">
                {slotDistribution.map((s) => (
                  <div key={s.slot} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[#2E2D24] w-20">{s.label}</span>
                        <span className="text-[#6A6754] font-mono tabular-nums">
                          {s.meals} meal{s.meals === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="font-mono tabular-nums text-[#2E2D24]">
                        <span className="font-semibold">{s.avgCal} kcal</span>
                        <span className="text-[#6A6754]"> · {s.avgPro}g P · {s.sharePct}%</span>
                      </div>
                    </div>
                    <div className="w-full h-2.5 rounded-full bg-[#EAE4E0] overflow-hidden">
                      <div
                        className="h-full bg-[#6A6754] transition-all"
                        style={{ width: `${Math.min(100, s.sharePct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-3 border-t border-[#D9D0CB]/80 text-xs text-[#4A483A] flex items-center justify-between">
                <span>
                  {slotDistribution[0].avgPro < 25 && plannedDays.length > 0
                    ? `Tip: Breakfast averages ${slotDistribution[0].avgPro}g protein — boosting mornings makes hitting ${targets.protein}g easier.`
                    : `Balanced timing: Mornings contribute ${slotDistribution[0].avgPro}g protein and ${slotDistribution[0].sharePct}% of daily energy.`}
                </span>
              </div>
            </section>

            {/* Top Weekly Recipe Contributors */}
            <section className="lg:col-span-6 bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl p-5 sm:p-6 flex flex-col justify-between space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold text-[#2E2D24]">
                    Top Weekly Contributors
                  </h2>
                  <p className="text-xs text-[#6A6754] mt-0.5">
                    Highest impact recipes scheduled in Week {activeWeekIndex + 1}
                  </p>
                </div>

                <div className="flex items-center gap-1 p-1 bg-[#EAE4E0]/80 rounded-full">
                  {(
                    [
                      { id: 'protein', label: 'Most Protein' },
                      { id: 'calories', label: 'Most Calories' },
                      { id: 'value', label: 'Best Value' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setContributorSort(mode.id)}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                        contributorSort === mode.id
                          ? 'bg-[#2E2D24] text-[#FAF8F6]'
                          : 'text-[#4A483A] hover:text-[#2E2D24]'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-[#D9D0CB]/80">
                {topContributors.map((item, idx) => (
                  <div
                    key={item.recipe.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <span className="font-mono text-xs font-semibold text-[#908B6F] w-5 shrink-0">
                        {String(idx + 1).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {onOpenRecipeDetail ? (
                            <button
                              type="button"
                              onClick={() => onOpenRecipeDetail(item.recipe)}
                              className="text-xs sm:text-sm font-medium text-[#2E2D24] hover:text-[#B86B4B] truncate inline-flex items-center gap-1 text-left transition-colors"
                            >
                              <span className="truncate">{item.recipe.title}</span>
                              <ArrowUpRight className="w-3 h-3 shrink-0 opacity-60" />
                            </button>
                          ) : (
                            <span className="text-xs sm:text-sm font-medium text-[#2E2D24] truncate">
                              {item.recipe.title}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#6A6754] font-mono tabular-nums">
                          {item.servingsCount} srv · {item.recipe.macrosPerServing.calories} kcal/srv
                          · {formatCurrency(item.costPerServing, pricing.currencyCode)}/srv
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono tabular-nums shrink-0">
                      {contributorSort === 'protein' && (
                        <>
                          <div className="text-xs font-semibold text-[#2E2D24]">
                            {item.totalProtein}g protein
                          </div>
                          <div className="text-[11px] text-[#6A6754]">
                            {item.recipe.macrosPerServing.protein}g / srv
                          </div>
                        </>
                      )}
                      {contributorSort === 'calories' && (
                        <>
                          <div className="text-xs font-semibold text-[#2E2D24]">
                            {item.totalCalories.toLocaleString()} kcal
                          </div>
                          <div className="text-[11px] text-[#6A6754]">
                            {item.totalProtein}g protein
                          </div>
                        </>
                      )}
                      {contributorSort === 'value' && (
                        <>
                          <div className="text-xs font-semibold text-[#14532D]">
                            {item.gramsProteinPerCostUnit.toFixed(1)}g P /{' '}
                            {activeCurrency.symbol.trim()}1
                          </div>
                          <div className="text-[11px] text-[#6A6754]">
                            {item.recipe.macrosPerServing.protein}g P ·{' '}
                            {formatCurrency(item.costPerServing, pricing.currencyCode)}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Expandable 7-Day Nutrition Ledger */}
          <section className="bg-[#FAF8F6]/90 maloxie-peach-block rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#D9D0CB]/80 bg-[#F3EFEC]/70 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#2E2D24]">
                Daily Nutrition Ledger
              </h3>
              <span className="text-xs text-[#6A6754]">
                Click any day to inspect meal-by-meal macro contributions
              </span>
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
                    <th className="py-3 px-4 text-right">Caloric Split</th>
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
                    const isExpanded = expandedLedgerDate === d.date;

                    const dCals = Math.max(
                      1,
                      d.macros.protein * 4 + d.macros.carbs * 4 + d.macros.fat * 9
                    );
                    const pPct = d.macros.calories > 0 ? Math.round(((d.macros.protein * 4) / dCals) * 100) : 0;
                    const cPct = d.macros.calories > 0 ? Math.round(((d.macros.carbs * 4) / dCals) * 100) : 0;
                    const fPct = d.macros.calories > 0 ? Math.max(0, 100 - pPct - cPct) : 0;

                    return (
                      <React.Fragment key={d.date}>
                        <tr
                          onClick={() => {
                            setSelectedDate(d.date);
                            setExpandedLedgerDate((prev) =>
                              prev === d.date ? null : d.date
                            );
                          }}
                          className={`cursor-pointer transition-colors ${
                            isExpanded ? 'bg-[#F3EFEC]' : 'hover:bg-[#F3EFEC]/70'
                          }`}
                        >
                          <td className="py-3 px-5 font-medium text-[#2E2D24]">
                            <span className="inline-flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#6A6754]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#908B6F]" />
                              )}
                              <span>
                                {d.header.weekday}, {d.header.monthShort} {d.header.dayNum}
                              </span>
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A]">
                            {d.mealCount}
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-medium tabular-nums text-[#2E2D24]">
                            {d.macros.calories.toLocaleString()} kcal
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A] font-semibold">
                            {d.macros.protein}g
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A]">
                            {d.macros.carbs}g
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#4A483A]">
                            {d.macros.fat}g
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-[#6A6754]">
                            {d.macros.calories > 0 ? `${pPct} / ${cPct} / ${fPct}` : '—'}
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
                              <span className="inline-flex items-center gap-1 text-[#14532D] font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                On target
                              </span>
                            ) : (
                              <span className="text-[#4A483A]">
                                {diff > 0 ? `+${diff}` : diff} kcal vs goal
                              </span>
                            )}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-[#F3EFEC]/50">
                            <td colSpan={8} className="px-6 py-3.5">
                              {d.mealCount === 0 ? (
                                <span className="text-xs text-[#6A6754]">
                                  No meals scheduled on {d.header.weekday}.
                                </span>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                  {SLOTS_ORDER.map((slot) => {
                                    const b = d.slotBreakdown[slot];
                                    return (
                                      <div key={slot} className="space-y-1">
                                        <div className="flex items-center justify-between text-[11px]">
                                          <span className="font-semibold text-[#2E2D24]">
                                            {MEAL_SLOT_LABELS[slot]}
                                          </span>
                                          <span className="font-mono tabular-nums text-[#6A6754]">
                                            {b.macros.calories} kcal · {b.macros.protein}g P
                                          </span>
                                        </div>
                                        <div className="text-xs text-[#4A483A] truncate">
                                          {b.titles.length > 0 ? b.titles.join(', ') : 'Open slot'}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
