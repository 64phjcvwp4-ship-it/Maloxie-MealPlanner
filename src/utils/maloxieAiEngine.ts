import type {
  DayPlan,
  DietaryTag,
  ManualGroceryItem,
  MealSlotType,
  NutritionTargets,
  PlannedMealEntry,
  Recipe,
} from '../types/mealPlanner';
import { addDaysISO, formatShortDayHeader } from './dateUtils';
import { computeDayMacros, generateGroceryList } from './groceryUtils';

function formatShortDay(isoDate: string): string {
  const { weekday, monthShort, dayNum } = formatShortDayHeader(isoDate);
  return `${weekday}, ${monthShort} ${dayNum}`;
}

export interface MaloxiePlanPreviewDay {
  date: string;
  label: string;
  breakfast?: string;
  lunch?: string;
  dinner?: string;
  snacks?: string;
}

export type MaloxieAction =
  | {
      type: 'apply_week_plan';
      label: string;
      weekDaysMap: Record<string, DayPlan>;
      scope: 'current' | 'all';
      recommendedTargets?: Partial<NutritionTargets>;
    }
  | {
      type: 'fill_empty_slots';
      label: string;
      patchDaysMap: Record<string, DayPlan>;
      addedCount: number;
    }
  | {
      type: 'apply_targets';
      label: string;
      targets: NutritionTargets;
    };

export interface MaloxieMessage {
  id: string;
  role: 'assistant' | 'user';
  title?: string;
  body: string;
  highlights?: string[];
  planPreview?: MaloxiePlanPreviewDay[];
  actions?: MaloxieAction[];
  createdAt: number;
}

export interface PlannerContext {
  activeWeekIndex: number;
  activeWeekDates: string[];
  weeksDates: string[][];
  daysMap: Record<string, DayPlan>;
  recipes: Recipe[];
  recipesMap: Record<string, Recipe>;
  targets: NutritionTargets;
  householdMultiplier: number;
  manualItems: ManualGroceryItem[];
  favoriteIds: Set<string>;
}

const SLOTS: MealSlotType[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function estimateRecipeCostPerServing(recipe: Recipe): number {
  const total = recipe.ingredients.reduce((sum, ing) => sum + ing.estimatedPrice, 0);
  return total / Math.max(1, recipe.servings);
}

function createEmptyDay(date: string): DayPlan {
  return {
    date,
    slots: { breakfast: [], lunch: [], dinner: [], snacks: [] },
    note: '',
  };
}

export interface WeekAudit {
  plannedMeals: number;
  totalSlots: number;
  emptySlotCount: number;
  activeDays: number;
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  estWeeklyCost: number;
  uniqueRecipeCount: number;
  leftoverCount: number;
  lowestProteinDays: Array<{ date: string; label: string; protein: number }>;
  emptyDates: Array<{ date: string; label: string; missingSlots: MealSlotType[] }>;
  priciestMeals: Array<{
    date: string;
    slot: MealSlotType;
    recipe: Recipe;
    costPerServing: number;
  }>;
}

export function analyzeActiveWeek(ctx: PlannerContext): WeekAudit {
  const { activeWeekDates, daysMap, recipesMap, householdMultiplier, manualItems } = ctx;
  let plannedMeals = 0;
  let emptySlotCount = 0;
  let activeDays = 0;
  let totalCalories = 0;
  let totalProtein = 0;
  let totalCarbs = 0;
  let totalFat = 0;
  let leftoverCount = 0;
  const uniqueIds = new Set<string>();
  const lowestProteinDays: WeekAudit['lowestProteinDays'] = [];
  const emptyDates: WeekAudit['emptyDates'] = [];
  const priciestMeals: WeekAudit['priciestMeals'] = [];

  for (const date of activeWeekDates) {
    const day = daysMap[date];
    const missingSlots: MealSlotType[] = [];

    for (const slot of SLOTS) {
      const entries = day?.slots[slot] || [];
      if (entries.length === 0) {
        emptySlotCount += 1;
        missingSlots.push(slot);
      } else {
        plannedMeals += entries.length;
        for (const entry of entries) {
          uniqueIds.add(entry.recipeId);
          if (entry.isLeftover) leftoverCount += 1;
          const r = recipesMap[entry.recipeId];
          if (r && (slot === 'dinner' || slot === 'lunch')) {
            priciestMeals.push({
              date,
              slot,
              recipe: r,
              costPerServing: estimateRecipeCostPerServing(r),
            });
          }
        }
      }
    }

    if (missingSlots.length > 0) {
      emptyDates.push({
        date,
        label: formatShortDay(date),
        missingSlots,
      });
    }

    const macros = computeDayMacros(day, recipesMap);
    if (macros.calories > 0) {
      activeDays += 1;
      totalCalories += macros.calories;
      totalProtein += macros.protein;
      totalCarbs += macros.carbs;
      totalFat += macros.fat;
      lowestProteinDays.push({
        date,
        label: formatShortDay(date),
        protein: macros.protein,
      });
    }
  }

  lowestProteinDays.sort((a, b) => a.protein - b.protein);
  priciestMeals.sort((a, b) => b.costPerServing - a.costPerServing);

  const grocery = generateGroceryList(
    activeWeekDates,
    daysMap,
    recipesMap,
    householdMultiplier,
    manualItems
  );
  const estWeeklyCost = grocery.reduce((sum, item) => sum + item.estimatedPrice, 0);

  return {
    plannedMeals,
    totalSlots: activeWeekDates.length * SLOTS.length,
    emptySlotCount,
    activeDays,
    avgCalories: activeDays > 0 ? Math.round(totalCalories / activeDays) : 0,
    avgProtein: activeDays > 0 ? Math.round(totalProtein / activeDays) : 0,
    avgCarbs: activeDays > 0 ? Math.round(totalCarbs / activeDays) : 0,
    avgFat: activeDays > 0 ? Math.round(totalFat / activeDays) : 0,
    estWeeklyCost,
    uniqueRecipeCount: uniqueIds.size,
    leftoverCount,
    lowestProteinDays,
    emptyDates,
    priciestMeals,
  };
}

interface BuildOptions {
  focusTags: DietaryTag[];
  avoidHighCost?: boolean;
  preferQuick?: boolean;
  preferLowCarb?: boolean;
  preferHighProtein?: boolean;
  preferVegetarian?: boolean;
  preferGlutenFree?: boolean;
  preferDairyFree?: boolean;
  useBatchLeftovers?: boolean;
  dailyCalorieGoal?: number;
  weeklyBudgetGoal?: number;
}

function scoreRecipeForSlot(
  recipe: Recipe,
  slot: MealSlotType,
  opts: BuildOptions,
  recentIds: string[],
  favoriteIds: Set<string>
): number {
  if (!recipe.mealTypes.includes(slot)) return -9999;

  if (opts.preferVegetarian && !recipe.dietaryTags.includes('Vegetarian')) {
    return -5000;
  }
  if (opts.preferGlutenFree && !recipe.dietaryTags.includes('Gluten-Free')) {
    return -4000;
  }
  if (opts.preferDairyFree && !recipe.dietaryTags.includes('Dairy-Free')) {
    return -4000;
  }

  let score = 10;

  for (const tag of opts.focusTags) {
    if (recipe.dietaryTags.includes(tag)) score += 22;
  }

  if (opts.preferHighProtein) {
    score += recipe.macrosPerServing.protein * 0.9;
  }
  if (opts.preferLowCarb) {
    score -= recipe.macrosPerServing.carbs * 0.6;
  }
  if (opts.preferQuick) {
    const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
    score += Math.max(0, 35 - totalMins) * 0.9;
  }

  const costPerSrv = estimateRecipeCostPerServing(recipe);
  if (opts.avoidHighCost) {
    score -= costPerSrv * 8;
    if (recipe.dietaryTags.includes('Budget')) score += 20;
  } else {
    score -= costPerSrv * 1.5;
  }

  if (favoriteIds.has(recipe.id)) score += 6;

  // Penalize immediate repetition so the week stays varied
  const recentIdx = recentIds.lastIndexOf(recipe.id);
  if (recentIdx !== -1) {
    const distance = recentIds.length - recentIdx;
    score -= Math.max(8, 42 - distance * 8);
  }

  if (opts.dailyCalorieGoal && opts.dailyCalorieGoal > 2150) {
    score += recipe.macrosPerServing.calories * 0.02;
  } else if (opts.dailyCalorieGoal && opts.dailyCalorieGoal < 1650) {
    score -= recipe.macrosPerServing.calories * 0.02;
  }

  return score;
}

function pickBestRecipe(
  recipes: Recipe[],
  slot: MealSlotType,
  opts: BuildOptions,
  recentIds: string[],
  favoriteIds: Set<string>
): Recipe {
  const candidates = recipes.filter((r) => r.mealTypes.includes(slot));
  const pool = candidates.length > 0 ? candidates : recipes;
  let best = pool[0];
  let bestScore = -Infinity;

  for (const r of pool) {
    const s = scoreRecipeForSlot(r, slot, opts, recentIds, favoriteIds);
    if (s > bestScore) {
      bestScore = s;
      best = r;
    }
  }
  return best;
}

function buildGeneratedWeekPlan(
  dates: string[],
  ctx: PlannerContext,
  opts: BuildOptions
): {
  weekDaysMap: Record<string, DayPlan>;
  preview: MaloxiePlanPreviewDay[];
  avgCals: number;
  avgProtein: number;
  estCost: number;
} {
  const weekDaysMap: Record<string, DayPlan> = {};
  const preview: MaloxiePlanPreviewDay[] = [];
  const recentBySlot: Record<MealSlotType, string[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };

  let prevDinnerRecipe: Recipe | null = null;
  let totalCals = 0;
  let totalProtein = 0;

  dates.forEach((date, idx) => {
    const day = createEmptyDay(date);

    // Breakfast
    const bfast = pickBestRecipe(
      ctx.recipes,
      'breakfast',
      opts,
      recentBySlot.breakfast,
      ctx.favoriteIds
    );
    recentBySlot.breakfast.push(bfast.id);
    day.slots.breakfast.push({
      instanceId: uid(`${date}-breakfast`),
      recipeId: bfast.id,
      servings: 1,
    });

    // Lunch (smart leftover on alternate days when batch-friendly)
    let lunchRecipe: Recipe;
    let lunchIsLeftover = false;
    if (
      opts.useBatchLeftovers !== false &&
      idx % 2 === 1 &&
      prevDinnerRecipe &&
      (prevDinnerRecipe.dietaryTags.includes('Batch Friendly') ||
        (prevDinnerRecipe.storageDays ?? 0) >= 3)
    ) {
      lunchRecipe = prevDinnerRecipe;
      lunchIsLeftover = true;
    } else {
      lunchRecipe = pickBestRecipe(
        ctx.recipes,
        'lunch',
        opts,
        recentBySlot.lunch,
        ctx.favoriteIds
      );
    }
    recentBySlot.lunch.push(lunchRecipe.id);
    day.slots.lunch.push({
      instanceId: uid(`${date}-lunch`),
      recipeId: lunchRecipe.id,
      servings: 1,
      ...(lunchIsLeftover
        ? { isLeftover: true, leftoverFromDate: addDaysISO(date, -1) }
        : {}),
    });

    // Dinner
    const dinner = pickBestRecipe(
      ctx.recipes,
      'dinner',
      opts,
      recentBySlot.dinner,
      ctx.favoriteIds
    );
    recentBySlot.dinner.push(dinner.id);
    day.slots.dinner.push({
      instanceId: uid(`${date}-dinner`),
      recipeId: dinner.id,
      servings: 1,
    });
    prevDinnerRecipe = dinner;

    // Snack
    const snack = pickBestRecipe(
      ctx.recipes,
      'snacks',
      opts,
      recentBySlot.snacks,
      ctx.favoriteIds
    );
    recentBySlot.snacks.push(snack.id);
    day.slots.snacks.push({
      instanceId: uid(`${date}-snacks`),
      recipeId: snack.id,
      servings: 1,
    });

    if (idx === 0 && opts.useBatchLeftovers !== false) {
      day.note = 'Sunday prep: portion breakfast & batch dinner for tomorrow’s lunch';
    } else if (lunchIsLeftover) {
      day.note = `No-cook lunch using yesterday’s ${lunchRecipe.title}`;
    }

    weekDaysMap[date] = day;

    const macros = computeDayMacros(day, ctx.recipesMap);
    totalCals += macros.calories;
    totalProtein += macros.protein;

    preview.push({
      date,
      label: formatShortDay(date),
      breakfast: bfast.title,
      lunch: lunchIsLeftover ? `${lunchRecipe.title} (Leftover)` : lunchRecipe.title,
      dinner: dinner.title,
      snacks: snack.title,
    });
  });

  const grocery = generateGroceryList(
    dates,
    weekDaysMap,
    ctx.recipesMap,
    ctx.householdMultiplier,
    []
  );
  const estCost = grocery.reduce((s, i) => s + i.estimatedPrice, 0);

  return {
    weekDaysMap,
    preview,
    avgCals: Math.round(totalCals / Math.max(1, dates.length)),
    avgProtein: Math.round(totalProtein / Math.max(1, dates.length)),
    estCost,
  };
}

function buildFillEmptySlotsPatch(
  ctx: PlannerContext,
  opts: BuildOptions
): { patchDaysMap: Record<string, DayPlan>; addedCount: number; summaryLines: string[] } {
  const patchDaysMap: Record<string, DayPlan> = {};
  const recentBySlot: Record<MealSlotType, string[]> = {
    breakfast: [],
    lunch: [],
    dinner: [],
    snacks: [],
  };
  let addedCount = 0;
  const summaryLines: string[] = [];

  for (const date of ctx.activeWeekDates) {
    const existingDay = ctx.daysMap[date] || createEmptyDay(date);
    const clonedSlots: DayPlan['slots'] = {
      breakfast: [...existingDay.slots.breakfast],
      lunch: [...existingDay.slots.lunch],
      dinner: [...existingDay.slots.dinner],
      snacks: [...existingDay.slots.snacks],
    };

    let dayAdded = false;
    const dayLabels: string[] = [];

    for (const slot of SLOTS) {
      for (const e of clonedSlots[slot]) {
        recentBySlot[slot].push(e.recipeId);
      }
      if (clonedSlots[slot].length === 0) {
        const picked = pickBestRecipe(
          ctx.recipes,
          slot,
          opts,
          recentBySlot[slot],
          ctx.favoriteIds
        );
        recentBySlot[slot].push(picked.id);
        const entry: PlannedMealEntry = {
          instanceId: uid(`${date}-${slot}`),
          recipeId: picked.id,
          servings: 1,
        };
        clonedSlots[slot].push(entry);
        addedCount += 1;
        dayAdded = true;
        dayLabels.push(`${slot}: ${picked.title}`);
      }
    }

    if (dayAdded) {
      patchDaysMap[date] = {
        ...existingDay,
        slots: clonedSlots,
      };
      summaryLines.push(`${formatShortDay(date)} — ${dayLabels.join(', ')}`);
    }
  }

  return { patchDaysMap, addedCount, summaryLines };
}

function buildFeedbackResponse(ctx: PlannerContext): MaloxieMessage {
  const audit = analyzeActiveWeek(ctx);
  const { targets, activeWeekIndex } = ctx;
  const weekNum = activeWeekIndex + 1;

  if (audit.plannedMeals === 0) {
    const starter = buildGeneratedWeekPlan(ctx.activeWeekDates, ctx, {
      focusTags: ['High Protein', 'Batch Friendly'],
      useBatchLeftovers: true,
    });
    return {
      id: uid('ai'),
      role: 'assistant',
      title: `Week ${weekNum} is currently empty`,
      body: `You haven't scheduled any meals for Week ${weekNum} yet. I can generate a balanced 7-day plan averaging ${starter.avgCals} kcal/day and ${starter.avgProtein}g protein (~$${Math.round(starter.estCost)}/wk) so you can start right away.`,
      highlights: [
        'Includes planned next-day leftovers to cut weeknight cooking in half',
        'Automatically populates your Grocery List and Sunday Prep Guide',
      ],
      planPreview: starter.preview,
      actions: [
        {
          type: 'apply_week_plan',
          label: `Fill Week ${weekNum} with Balanced Plan`,
          weekDaysMap: starter.weekDaysMap,
          scope: 'current',
        },
      ],
      createdAt: Date.now(),
    };
  }

  const calDiff = audit.avgCalories - targets.calories;
  const protDiff = audit.avgProtein - targets.protein;
  const budgetDiff = audit.estWeeklyCost - targets.weeklyBudget;

  const insights: string[] = [];

  if (audit.emptySlotCount > 0) {
    insights.push(
      `Coverage: ${audit.plannedMeals} of ${audit.totalSlots} weekly slots filled (${audit.emptySlotCount} open slot${audit.emptySlotCount === 1 ? '' : 's'}).`
    );
  } else {
    insights.push(
      `Coverage: Complete 7-day schedule (${audit.plannedMeals} meals across ${audit.uniqueRecipeCount} unique recipes).`
    );
  }

  if (Math.abs(calDiff) <= 160) {
    insights.push(
      `Calories: On track at ${audit.avgCalories} kcal/day vs your ${targets.calories} kcal goal.`
    );
  } else if (calDiff < 0) {
    insights.push(
      `Calories: Averaging ${audit.avgCalories} kcal/day (${Math.abs(calDiff)} kcal below your ${targets.calories} kcal goal).`
    );
  } else {
    insights.push(
      `Calories: Averaging ${audit.avgCalories} kcal/day (${calDiff} kcal above your ${targets.calories} kcal goal).`
    );
  }

  if (protDiff >= -10) {
    insights.push(
      `Protein: Strong at ${audit.avgProtein}g/day vs your ${targets.protein}g target.`
    );
  } else {
    const lowDay = audit.lowestProteinDays[0];
    insights.push(
      `Protein: Averaging ${audit.avgProtein}g/day (${Math.abs(protDiff)}g under target${lowDay ? `, lowest on ${lowDay.label} at ${lowDay.protein}g` : ''}).`
    );
  }

  if (budgetDiff <= 0) {
    insights.push(
      `Budget: Estimated $${audit.estWeeklyCost.toFixed(0)} — $${Math.abs(Math.round(budgetDiff))} under your $${targets.weeklyBudget} cap.`
    );
  } else {
    const topPriced = audit.priciestMeals[0];
    insights.push(
      `Budget: Estimated $${audit.estWeeklyCost.toFixed(0)} ($${Math.round(budgetDiff)} over your $${targets.weeklyBudget} cap${topPriced ? `; ${topPriced.recipe.title} is the priciest item` : ''}).`
    );
  }

  if (audit.leftoverCount === 0 && audit.plannedMeals >= 10) {
    insights.push(
      `Prep Efficiency: Zero leftovers scheduled — pairing 2–3 batch dinners with next-day lunches would save ~60 minutes of cooking.`
    );
  } else if (audit.leftoverCount > 0) {
    insights.push(
      `Prep Efficiency: Smart reuse of ${audit.leftoverCount} leftover meal${audit.leftoverCount === 1 ? '' : 's'} reduces weeknight prep.`
    );
  }

  const actions: MaloxieAction[] = [];

  if (audit.emptySlotCount > 0) {
    const fill = buildFillEmptySlotsPatch(ctx, {
      focusTags: protDiff < -10 ? ['High Protein'] : ['Batch Friendly'],
      avoidHighCost: budgetDiff > 0,
    });
    if (fill.addedCount > 0) {
      actions.push({
        type: 'fill_empty_slots',
        label: `Fill ${fill.addedCount} Open Slot${fill.addedCount === 1 ? '' : 's'}`,
        patchDaysMap: fill.patchDaysMap,
        addedCount: fill.addedCount,
      });
    }
  }

  if (budgetDiff > 5) {
    const budgetPlan = buildGeneratedWeekPlan(ctx.activeWeekDates, ctx, {
      focusTags: ['Budget', 'Batch Friendly'],
      avoidHighCost: true,
      preferHighProtein: protDiff < 0,
      useBatchLeftovers: true,
    });
    actions.push({
      type: 'apply_week_plan',
      label: `Switch to Budget Plan (~$${Math.round(budgetPlan.estCost)}/wk)`,
      weekDaysMap: budgetPlan.weekDaysMap,
      scope: 'current',
    });
  } else if (protDiff < -12) {
    const hpPlan = buildGeneratedWeekPlan(ctx.activeWeekDates, ctx, {
      focusTags: ['High Protein', 'Batch Friendly'],
      preferHighProtein: true,
      useBatchLeftovers: true,
    });
    actions.push({
      type: 'apply_week_plan',
      label: `Upgrade to High-Protein Week (${hpPlan.avgProtein}g/day)`,
      weekDaysMap: hpPlan.weekDaysMap,
      scope: 'current',
    });
  }

  const verdict =
    audit.emptySlotCount === 0 && Math.abs(calDiff) <= 180 && protDiff >= -10 && budgetDiff <= 5
      ? `Week ${weekNum} is well balanced across macros, variety, and budget.`
      : `Here is a full audit of Week ${weekNum} with direct fixes you can apply in one click.`;

  return {
    id: uid('ai'),
    role: 'assistant',
    title: `Week ${weekNum} Feedback`,
    body: verdict,
    highlights: insights,
    actions,
    createdAt: Date.now(),
  };
}

export function createInitialAiGreeting(ctx: PlannerContext): MaloxieMessage {
  const audit = analyzeActiveWeek(ctx);
  const weekNum = ctx.activeWeekIndex + 1;
  return {
    id: uid('ai-welcome'),
    role: 'assistant',
    title: 'Maloxie AI is ready',
    body: `I read your live planner for Week ${weekNum} (${audit.plannedMeals} meals scheduled, ${audit.avgCalories || 0} avg kcal/day, ~$${Math.round(audit.estWeeklyCost)} est.). Ask me to critique your week, build a custom menu, boost protein, or cut grocery costs.`,
    highlights: [
      'Built-in planning & nutrition analysis — works offline and syncs with your cloud account',
      'Click any suggestion below or type your calorie, budget, or dietary goal',
    ],
    createdAt: Date.now(),
  };
}

export function generateMaloxieAiReply(
  prompt: string,
  ctx: PlannerContext
): MaloxieMessage {
  const q = prompt.trim().toLowerCase();
  const weekNum = ctx.activeWeekIndex + 1;

  // Parse numeric constraints if user mentions calories, protein, or budget
  const calMatch = q.match(/(\d{3,4})\s*(?:k?cal|calories)/i);
  const protMatch = q.match(/(\d{2,3})\s*g?\s*protein/i);
  const budgetMatch = q.match(/(?:under|below|max|budget|\$)\s*\$?\s*(\d{2,4})/i);

  const parsedCalories = calMatch ? Math.min(5000, Math.max(1100, Number(calMatch[1]))) : undefined;
  const parsedProtein = protMatch ? Math.min(350, Math.max(40, Number(protMatch[1]))) : undefined;
  const parsedBudget = budgetMatch ? Math.min(1000, Math.max(30, Number(budgetMatch[1]))) : undefined;

  // 1. Target update intent without full menu rebuild if explicitly asking to set/change targets
  if (
    /(set|update|change).*(target|goal|calorie|protein|budget)/.test(q) &&
    !/plan|menu|week|meal|build|create|generate/.test(q) &&
    (parsedCalories || parsedProtein || parsedBudget)
  ) {
    const nextTargets: NutritionTargets = {
      ...ctx.targets,
      ...(parsedCalories ? { calories: parsedCalories } : {}),
      ...(parsedProtein ? { protein: parsedProtein } : {}),
      ...(parsedBudget ? { weeklyBudget: parsedBudget } : {}),
    };
    return {
      id: uid('ai'),
      role: 'assistant',
      title: 'Updated target proposal',
      body: `I prepared your new daily & weekly nutrition targets based on your request.`,
      highlights: [
        `Daily calories: ${nextTargets.calories} kcal`,
        `Daily protein: ${nextTargets.protein}g`,
        `Weekly grocery cap: $${nextTargets.weeklyBudget}`,
      ],
      actions: [
        {
          type: 'apply_targets',
          label: 'Apply New Targets',
          targets: nextTargets,
        },
      ],
      createdAt: Date.now(),
    };
  }

  // 2. Feedback / Review / Audit intent
  if (
    /(feedback|review|audit|rate|check|how('s| is)|critique|analyze|analyse|missing|gaps)/.test(
      q
    ) &&
    !/(create|build|generate|make me a|new plan)/.test(q)
  ) {
    return buildFeedbackResponse(ctx);
  }

  // 3. Fill empty slots intent
  if (/(fill|complete|open slot|empty|finish week)/.test(q)) {
    const opts: BuildOptions = {
      focusTags: ['Batch Friendly', 'High Protein'],
      preferVegetarian: /veg|plant/.test(q),
      preferQuick: /quick|fast|busy|20/.test(q),
      avoidHighCost: /cheap|budget|save|low cost/.test(q),
    };
    const fill = buildFillEmptySlotsPatch(ctx, opts);
    if (fill.addedCount === 0) {
      return {
        id: uid('ai'),
        role: 'assistant',
        title: `Week ${weekNum} has no empty slots`,
        body: `All 28 meal slots in Week ${weekNum} already have meals assigned. Would you like me to review the macros and budget instead?`,
        actions: [
          {
            type: 'apply_week_plan',
            label: `Regenerate Fresh Week ${weekNum}`,
            weekDaysMap: buildGeneratedWeekPlan(ctx.activeWeekDates, ctx, opts).weekDaysMap,
            scope: 'current',
          },
        ],
        createdAt: Date.now(),
      };
    }

    return {
      id: uid('ai'),
      role: 'assistant',
      title: `Fill ${fill.addedCount} open slot${fill.addedCount === 1 ? '' : 's'} in Week ${weekNum}`,
      body: `I selected complementary recipes from your library to fill your open slots without changing any meals you already scheduled.`,
      highlights: fill.summaryLines.slice(0, 6),
      actions: [
        {
          type: 'fill_empty_slots',
          label: `Apply ${fill.addedCount} Meal Addition${fill.addedCount === 1 ? '' : 's'}`,
          patchDaysMap: fill.patchDaysMap,
          addedCount: fill.addedCount,
        },
      ],
      createdAt: Date.now(),
    };
  }

  // 4. Plan creation intent (budget, high-protein, vegetarian, quick, low-carb, gluten-free, dairy-free, or custom)
  const preferHighProtein = /protein|muscle|lean|gym|macro/.test(q);
  const avoidHighCost = /budget|cheap|save|cost|afford|inexpensive|dollar|\$/.test(q);
  const preferQuick = /quick|fast|20|busy|easy|minimal|weeknight/.test(q);
  const preferVegetarian = /vegetarian|veggie|plant|meatless/.test(q);
  const preferLowCarb = /low carb|keto|less carb/.test(q);
  const preferGlutenFree = /gluten/.test(q);
  const preferDairyFree = /dairy/.test(q);
  const allWeeks = /all weeks|whole month|both weeks|entire horizon/.test(q);

  const isCreateIntent =
    preferHighProtein ||
    avoidHighCost ||
    preferQuick ||
    preferVegetarian ||
    preferLowCarb ||
    preferGlutenFree ||
    preferDairyFree ||
    /(create|build|make|generate|plan|menu|suggest|idea|meal|dinner|breakfast|lunch)/.test(q);

  if (isCreateIntent) {
    const focusTags: DietaryTag[] = [];
    if (preferHighProtein) focusTags.push('High Protein');
    if (avoidHighCost) focusTags.push('Budget');
    if (preferQuick) focusTags.push('Quick');
    if (preferVegetarian) focusTags.push('Vegetarian');
    if (preferLowCarb) focusTags.push('Low Carb');
    if (preferGlutenFree) focusTags.push('Gluten-Free');
    if (preferDairyFree) focusTags.push('Dairy-Free');
    if (focusTags.length === 0) focusTags.push('Batch Friendly', 'High Protein');

    const opts: BuildOptions = {
      focusTags,
      avoidHighCost,
      preferQuick,
      preferLowCarb,
      preferHighProtein,
      preferVegetarian,
      preferGlutenFree,
      preferDairyFree,
      useBatchLeftovers: !/no leftover|fresh every/.test(q),
      dailyCalorieGoal: parsedCalories ?? ctx.targets.calories,
      weeklyBudgetGoal: parsedBudget ?? ctx.targets.weeklyBudget,
    };

    const generated = buildGeneratedWeekPlan(ctx.activeWeekDates, ctx, opts);
    const focusSummary = focusTags.join(' · ');

    const highlights = [
      `Focus: ${focusSummary}`,
      `Estimated nutrition: ${generated.avgCals} kcal/day · ${generated.avgProtein}g protein/day`,
      `Estimated grocery total: ~$${Math.round(generated.estCost)} (${ctx.householdMultiplier}x household)`,
    ];

    if (parsedBudget && generated.estCost > parsedBudget) {
      highlights.push(
        `Tip: Swap salmon or steak nights to keep groceries closer to your $${parsedBudget} cap.`
      );
    }

    const recommendedTargets: Partial<NutritionTargets> | undefined =
      parsedCalories || parsedProtein || parsedBudget
        ? {
            ...(parsedCalories ? { calories: parsedCalories } : {}),
            ...(parsedProtein ? { protein: parsedProtein } : {}),
            ...(parsedBudget ? { weeklyBudget: parsedBudget } : {}),
          }
        : undefined;

    return {
      id: uid('ai'),
      role: 'assistant',
      title: `Custom Week ${weekNum} Plan`,
      body: `I assembled a 7-day plan tailored to ${focusSummary.toLowerCase()} using your recipe catalog with varied dinners and smart next-day leftovers.`,
      highlights,
      planPreview: generated.preview,
      actions: [
        {
          type: 'apply_week_plan',
          label: allWeeks
            ? `Apply to All ${ctx.weeksDates.length} Weeks`
            : `Apply Plan to Week ${weekNum}`,
          weekDaysMap: generated.weekDaysMap,
          scope: allWeeks ? 'all' : 'current',
          recommendedTargets,
        },
      ],
      createdAt: Date.now(),
    };
  }

  // 5. Fallback helpful guidance + quick week summary
  const audit = analyzeActiveWeek(ctx);
  return {
    id: uid('ai'),
    role: 'assistant',
    title: 'How I can help with your meal plan',
    body: `Right now Week ${weekNum} has ${audit.plannedMeals} meals planned averaging ${audit.avgCalories || 0} kcal/day and ~$${Math.round(audit.estWeeklyCost)} in groceries. Try asking me for one of these:`,
    highlights: [
      '"Review my week" — inspect calorie, protein, and budget gaps',
      '"Create a high-protein week under $90" — generate a tailored 7-day menu',
      '"Fill my empty slots" — complete open slots without overwriting current meals',
      '"Make a quick 20-minute vegetarian week" — filter and schedule fast plant-forward dishes',
    ],
    createdAt: Date.now(),
  };
}
