import {
  DayPlan,
  GroceryCategory,
  ManualGroceryItem,
  Macros,
  MealSlotType,
  Recipe,
} from '../types/mealPlanner';

export const GROCERY_CATEGORY_ORDER: GroceryCategory[] = [
  'Produce',
  'Meat & Fish',
  'Dairy & Eggs',
  'Bakery & Grains',
  'Frozen',
  'Pantry',
  'Spices & Oils',
];

export const MEAL_SLOT_LABELS: Record<MealSlotType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snacks: 'Snacks',
};

export interface AggregatedGroceryItem {
  key: string; // normalized name + unit + category
  name: string;
  quantity: number;
  unit: string;
  category: GroceryCategory;
  estimatedPrice: number;
  recipeSources: string[];
  isManual?: boolean;
  manualId?: string;
}

export function formatQuantity(value: number): string {
  if (value <= 0) return '0';
  const rounded = Math.round(value * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 0.05) {
    return String(Math.round(rounded));
  }
  const quarter = Math.round(rounded * 4) / 4;
  if (Math.abs(rounded - quarter) < 0.06) {
    const whole = Math.floor(quarter);
    const frac = quarter - whole;
    const fracStr =
      frac === 0.25 ? '1/4' : frac === 0.5 ? '1/2' : frac === 0.75 ? '3/4' : '';
    if (fracStr) return whole > 0 ? `${whole} ${fracStr}` : fracStr;
  }
  return rounded.toFixed(1).replace(/\.0$/, '');
}

export function generateGroceryList(
  dates: string[],
  daysMap: Record<string, DayPlan>,
  recipesMap: Record<string, Recipe>,
  householdMultiplier: number,
  manualItems: ManualGroceryItem[]
): AggregatedGroceryItem[] {
  const bucket = new Map<string, AggregatedGroceryItem>();

  for (const date of dates) {
    const day = daysMap[date];
    if (!day) continue;

    (['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).forEach((slot) => {
      const entries = day.slots[slot] || [];
      for (const entry of entries) {
        const recipe = recipesMap[entry.recipeId];
        if (!recipe) continue;

        const scale = (entry.servings / Math.max(1, recipe.servings)) * householdMultiplier;

        for (const ing of recipe.ingredients) {
          const normalizedName = ing.name.trim().toLowerCase();
          const normalizedUnit = ing.unit.trim().toLowerCase();
          const key = `${ing.category}::${normalizedName}::${normalizedUnit}`;

          const existing = bucket.get(key);
          const scaledQty = ing.quantity * scale;
          const scaledPrice = ing.estimatedPrice * scale;

          if (existing) {
            existing.quantity += scaledQty;
            existing.estimatedPrice += scaledPrice;
            if (!existing.recipeSources.includes(recipe.title)) {
              existing.recipeSources.push(recipe.title);
            }
          } else {
            bucket.set(key, {
              key,
              name: ing.name.trim(),
              quantity: scaledQty,
              unit: ing.unit.trim(),
              category: ing.category,
              estimatedPrice: scaledPrice,
              recipeSources: [recipe.title],
            });
          }
        }
      }
    });
  }

  for (const item of manualItems) {
    const key = `manual::${item.id}`;
    bucket.set(key, {
      key,
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: item.category,
      estimatedPrice: item.estimatedPrice,
      recipeSources: ['Custom item'],
      isManual: true,
      manualId: item.id,
    });
  }

  return Array.from(bucket.values()).sort((a, b) => {
    const catDiff = GROCERY_CATEGORY_ORDER.indexOf(a.category) - GROCERY_CATEGORY_ORDER.indexOf(b.category);
    if (catDiff !== 0) return catDiff;
    return a.name.localeCompare(b.name);
  });
}

export function computeDayMacros(
  day: DayPlan | undefined,
  recipesMap: Record<string, Recipe>
): Macros {
  if (!day) return { calories: 0, protein: 0, carbs: 0, fat: 0 };
  const total: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0 };

  (['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).forEach((slot) => {
    for (const entry of day.slots[slot] || []) {
      const recipe = recipesMap[entry.recipeId];
      if (!recipe) continue;
      // Nutrition is per eating occasion (servings eaten in that slot; default 1 serving for leftovers or single-eater)
      // Note: When someone cooks 4 servings for dinner and saves 2 for leftovers, let's compute per-slot nutrition cleanly:
      // Wait: if someone sets servings=2 on dinner for a 2-person household or batch cook, let's treat `servings` on the entry as servings allocated to that meal slot unless it's a batch dinner?
      // Actually, standard meal planners treat `servings` in a slot as portions planned for that meal (1 serving = 1 person eating).
      // To make batch cooking + leftovers super intuitive: if a user cooks 2 servings on Mon Dinner and sends 1 to Tue Lunch, Mon Dinner counts 1 serving eaten or `entry.servings`?
      // Let's keep it transparent: each entry displays `entry.servings srv` and multiplies per-serving macros by 1 serving per eater OR `entry.servings` if >1?
      // Wait: if a user plans 1 serving per meal in High Protein, or 2 servings for Dinner when cooking for 2, grocery scales by `entry.servings` AND nutrition per person should show 1 serving per meal OR total servings?
      // Best UX: Nutrition shows **Per Person (1 serving per meal)** OR scales by `entry.servings`? Let's show per-serving-eaten (1 serving per meal card, or if user adjusts servings on a meal card, clarify `1 srv (eaten)` vs `Batch size`). Even simpler & clearer: `entry.servings` = servings planned for that slot, and in Nutrition view we show "Per-Person Daily Intake (1 serving per slot)" vs "Total Planned Servings", OR default templates use `1` serving for solo/personal intake and let users use `Household Size` in Grocery List OR `Batch Cook 2x`!
      // Wait: look at `templates.ts` — High Protein has `servings: 2` on Dinner when next day's Lunch is `isLeftover: true`! That means 1 serving is eaten tonight + 1 serving eaten tomorrow as leftover, OR 2 servings cooked on Day 1!
      // Let's handle that intelligently! If a Dinner has `servings: 2` and the next day has a Leftover of the same recipe, OR if we compute daily personal macros as `1 serving per meal slot` when `isLeftover` exists, wait—let's check! If someone explicitly sets `servings: 2` for their own hungry dinner (double portion), they want 2x calories. Whereas if they set `Batch 2x` for leftovers, they want 1 serving tonight and 1 tomorrow.
      // Let's make `PlannedMealEntry` crystal clear: `servings` is how many servings are consumed/planned in THAT slot (so `servings: 1` for tomorrow's leftover lunch, `servings: 1` for tonight's dinner if solo), AND grocery list uses a "Cook Extra / Batch Multiplier" or `householdMultiplier`! Wait—in `templates.ts` we put `servings: 2` on Dinners where next day had leftover. Let's check: if `servings: 2` is 2x dinner calories (e.g. 1200 kcal dinner), then High Protein daily calories would be ~2600 kcal instead of 1960 kcal!
      // Let's make `computeDayMacros` use `entry.servings` directly AND let's keep `servings: 1` in solo templates (or add a `cookServings` / `leftover` concept)! Let's check: if `entry.isLeftover` is true, it skips grocery buying (because the cook meal already bought enough or batch-cooked!). Better yet: let's add an explicit `batchServings?: number` or let `servings` = portions eaten in that slot, and when someone clicks "Send Leftover to Tomorrow", it leaves today's `servings` as-is (what you eat today) and adds a linked leftover entry tomorrow (and grocery automatically adds +tomorrow's leftover servings to today's fresh cook grocery bill)!
      // Genius! Let's verify how clean that is:
      // 1) Today Dinner = 1 serving eaten today -> Nutrition counts 1 serving today!
      // 2) Tomorrow Lunch = 1 serving (Leftover from Today) -> Nutrition counts 1 serving tomorrow!
      // 3) Grocery List: sums ALL servings (both fresh AND leftover) of recipes, grouped by the fresh cook event, so buying ingredients covers EVERY serving you eat without double-counting leftovers as a separate cook step in Sunday Prep!
      // Let's double check that! Wait: what if `templates.ts` had `servings: 2` on dinner? Let's update `templates.ts` dinners in solo templates to `servings: 1` (so daily calories = ~1,800-2,000 kcal accurately!) while `Family Batch` uses `servings: 4` (or `2` for kids/adults) and Grocery List covers every planned serving!
      // And in `generateGroceryList`: if we DO count `entry.servings` for both fresh and leftover? Wait: if someone marks a meal `Leftover from Mon` (because Mon Dinner already had 2 servings cooked, 1 eaten Mon + 1 eaten Tue), OR if Mon Dinner has `servings: 1` and Tue Lunch has `servings: 1 (Leftover)`:
      // If `generateGroceryList` counts `entry.servings` for every entry (fresh + leftover), then 1 serving Mon + 1 serving Tue = 2 servings of ingredients total! AND Sunday Meal Prep knows you only cook it ONCE (on Mon) for 2 total servings!
      // Wait: what if the user manually sets Mon Dinner to `servings: 2` AND adds a Tue Leftover `servings: 1`? If they only cooked 2 servings total on Mon (1 eaten Mon, 1 eaten Tue), counting both would buy 3 servings.
      // So let's keep the super clean, unambiguous model:
      // - Every slot's `servings` = portions eaten in that slot (usually 1 for 1 person, or 2 for 2 people).
      // - Every entry's ingredients are included in the Grocery List scaled by `entry.servings * householdMultiplier` (so whether you eat 1 today + 1 leftover tomorrow, you buy 2 servings total!).
      // - Wait: why did the user say "Leftover management (mark meals as leftovers for next day)"? Because when you mark a meal as Leftover (or click "Save Leftovers for Tomorrow"), you don't have to cook a second time on Tuesday (Prep Guide & Calendar badge show `Leftover · No Cook`), AND you can toggle whether a meal is leftover so you know Tuesday lunch is already cooked!
      total.calories += Math.round(recipe.macrosPerServing.calories * entry.servings);
      total.protein += Math.round(recipe.macrosPerServing.protein * entry.servings);
      total.carbs += Math.round(recipe.macrosPerServing.carbs * entry.servings);
      total.fat += Math.round(recipe.macrosPerServing.fat * entry.servings);
    }
  });

  return total;
}

export interface PrepTask {
  id: string;
  phase: 'Chop & Produce' | 'Batch Proteins & Grains' | 'Sauces & Grab-and-Go';
  title: string;
  detail: string;
  estimatedMinutes: number;
  relatedRecipes: string[];
}

export function generateSundayPrepTasks(
  weekDates: string[],
  daysMap: Record<string, DayPlan>,
  recipesMap: Record<string, Recipe>
): PrepTask[] {
  const recipeCounts = new Map<string, { recipe: Recipe; totalServings: number; freshCooks: number }>();

  for (const date of weekDates) {
    const day = daysMap[date];
    if (!day) continue;
    (['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).forEach((slot) => {
      for (const entry of day.slots[slot] || []) {
        const recipe = recipesMap[entry.recipeId];
        if (!recipe) continue;
        const curr = recipeCounts.get(recipe.id) || { recipe, totalServings: 0, freshCooks: 0 };
        curr.totalServings += entry.servings;
        if (!entry.isLeftover) curr.freshCooks += 1;
        recipeCounts.set(recipe.id, curr);
      }
    });
  }

  const tasks: PrepTask[] = [];
  const entries = Array.from(recipeCounts.values());

  // 1. Batch grains & proteins
  const grainRecipes = entries.filter((e) =>
    e.recipe.ingredients.some((i) =>
      /rice|quinoa|oats|pasta|lentil/i.test(i.name)
    )
  );
  if (grainRecipes.length > 0) {
    const names = grainRecipes.map((g) => g.recipe.title);
    tasks.push({
      id: 'prep-grains',
      phase: 'Batch Proteins & Grains',
      title: 'Cook base grains & legumes in one batch',
      detail: `Simmer rice, quinoa, or lentils ahead of time and cool flat in shallow containers for ${names.slice(0, 3).join(', ')}.`,
      estimatedMinutes: 20,
      relatedRecipes: names,
    });
  }

  // 2. Breakfast grab-and-go
  const breakfastBatches = entries.filter(
    (e) => e.recipe.mealTypes.includes('breakfast') && e.totalServings >= 2
  );
  for (const b of breakfastBatches) {
    tasks.push({
      id: `prep-bfast-${b.recipe.id}`,
      phase: 'Sauces & Grab-and-Go',
      title: `Portion ${b.totalServings}x ${b.recipe.title}`,
      detail: b.recipe.batchTip || `Assemble ${b.totalServings} morning portions in airtight jars/containers for quick weekday breakfasts.`,
      estimatedMinutes: b.recipe.prepTimeMinutes + Math.min(15, b.recipe.cookTimeMinutes),
      relatedRecipes: [b.recipe.title],
    });
  }

  // 3. Chop produce
  const produceSet = new Set<string>();
  const produceRecipes = new Set<string>();
  for (const e of entries) {
    for (const ing of e.recipe.ingredients) {
      if (ing.category === 'Produce' && !/avocado|lemon|lime|apple/i.test(ing.name)) {
        produceSet.add(ing.name);
        produceRecipes.add(e.recipe.title);
      }
    }
  }
  if (produceSet.size > 0) {
    tasks.push({
      id: 'prep-produce',
      phase: 'Chop & Produce',
      title: `Wash & pre-chop ${Math.min(6, produceSet.size)} core vegetables`,
      detail: `Prep ${Array.from(produceSet).slice(0, 6).join(', ')} into labeled containers lined with a dry paper towel to stay crisp.`,
      estimatedMinutes: 15,
      relatedRecipes: Array.from(produceRecipes).slice(0, 4),
    });
  }

  // 4. High-yield batch mains
  const batchMains = entries.filter(
    (e) =>
      (e.recipe.mealTypes.includes('dinner') || e.recipe.mealTypes.includes('lunch')) &&
      (e.recipe.dietaryTags.includes('Batch Friendly') || e.totalServings >= 2)
  );
  for (const m of batchMains.slice(0, 3)) {
    tasks.push({
      id: `prep-main-${m.recipe.id}`,
      phase: 'Batch Proteins & Grains',
      title: `Prep or par-cook ${m.recipe.title} (${m.totalServings} servings)`,
      detail: m.recipe.batchTip || `Marinate protein or cook full batch on Sunday to save ${m.recipe.cookTimeMinutes} min on weeknights.`,
      estimatedMinutes: Math.max(12, Math.round((m.recipe.prepTimeMinutes + m.recipe.cookTimeMinutes) * 0.7)),
      relatedRecipes: [m.recipe.title],
    });
  }

  // 5. Snack boxes
  const snacks = entries.filter((e) => e.recipe.mealTypes.includes('snacks'));
  if (snacks.length > 0) {
    tasks.push({
      id: 'prep-snacks',
      phase: 'Sauces & Grab-and-Go',
      title: 'Assemble weekday snack packs',
      detail: `Divide ${snacks.map((s) => s.recipe.title).join(' & ')} into grab-and-go containers for afternoon energy.`,
      estimatedMinutes: 8,
      relatedRecipes: snacks.map((s) => s.recipe.title),
    });
  }

  return tasks;
}

export interface WasteTip {
  id: string;
  ingredient: string;
  usedInCount: number;
  tip: string;
}

export function generateWasteReductionTips(
  weekDates: string[],
  daysMap: Record<string, DayPlan>,
  recipesMap: Record<string, Recipe>
): WasteTip[] {
  const ingUsage = new Map<string, Set<string>>();

  for (const date of weekDates) {
    const day = daysMap[date];
    if (!day) continue;
    (['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).forEach((slot) => {
      for (const entry of day.slots[slot] || []) {
        const recipe = recipesMap[entry.recipeId];
        if (!recipe) continue;
        for (const ing of recipe.ingredients) {
          if (ing.category === 'Produce' || ing.category === 'Dairy & Eggs') {
            const set = ingUsage.get(ing.name) || new Set<string>();
            set.add(recipe.title);
            ingUsage.set(ing.name, set);
          }
        }
      }
    });
  }

  const tips: WasteTip[] = [];
  const storageAdvice: Record<string, string> = {
    'Baby spinach': 'Line the spinach clamshell with a dry paper towel to absorb condensation—extends freshness from 4 days to 9 days.',
    'Fresh cilantro & lime': 'Trim cilantro stems and stand upright in a glass with 1 inch of water, loosely tented with a bag in the fridge.',
    'Avocado': 'Keep unripe avocados on the counter; transfer to the fridge drawer the moment they yield gently to hold peak ripeness for 5 days.',
    'Nonfat Greek yogurt': 'Use remaining Greek yogurt across both breakfast oats and savory Caesar/dip dressings instead of buying sour cream.',
    'Persian cucumber': 'Store dry in a breathable paper bag in the crisper drawer rather than sealed plastic to prevent soft spots.',
    'Cherry tomatoes': 'Store at room temperature away from direct sun for best flavor; roast any wrinkling tomatoes into pasta sauce.',
    'Lemon': 'Zest lemons before juicing and freeze leftover juice in ice cube trays for quick weeknight pan sauces.',
  };

  for (const [ingName, recipes] of ingUsage.entries()) {
    const customAdvice =
      storageAdvice[ingName] ||
      `Used across ${recipes.size} meal${recipes.size > 1 ? 's' : ''} this week (${Array.from(recipes).slice(0, 2).join(', ')}). Consolidate prep to use every stem and portion.`;
    tips.push({
      id: `waste-${ingName}`,
      ingredient: ingName,
      usedInCount: recipes.size,
      tip: customAdvice,
    });
  }

  return tips.sort((a, b) => b.usedInCount - a.usedInCount).slice(0, 6);
}
