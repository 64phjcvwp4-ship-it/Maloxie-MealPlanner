import { DayPlan, MealTemplate } from '../types/mealPlanner';
import { addDaysISO } from '../utils/dateUtils';

export const MEAL_TEMPLATES: MealTemplate[] = [
  {
    id: 'high-protein',
    name: 'High Protein Performance',
    tagline: 'Lean meats, salmon, eggs & Greek yogurt hitting 150g+ protein daily',
    focusTag: 'High Protein',
    estimatedWeeklyCost: 112,
    avgDailyCalories: 1960,
    avgDailyProtein: 158,
    days: [
      {
        note: 'Sunday prep ready — oats & egg cups portioned',
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 1 }],
          dinner: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        note: 'Enjoy leftover herb chicken for lunch',
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 1 }],
          lunch: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'miso-salmon-bowl', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'miso-salmon-bowl', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'beef-broccoli-stirfry', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        note: 'Midweek quick dinner',
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'beef-broccoli-stirfry', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'garlic-shrimp-zucchini-noodles', servings: 1 }],
          snacks: [{ recipeId: 'spinach-feta-egg-muffins', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 1 }],
          lunch: [{ recipeId: 'grilled-chicken-caesar-wrap', servings: 1 }],
          dinner: [{ recipeId: 'sheet-pan-sausage-peppers', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'sheet-pan-sausage-peppers', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        note: 'Evening grocery shop & Sunday batch prep',
        slots: {
          breakfast: [{ recipeId: 'avocado-sourdough-poached-eggs', servings: 1 }],
          lunch: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
    ],
  },
  {
    id: 'budget-smart',
    name: 'Smart Budget Staples',
    tagline: 'High-value pantry legumes, oats, eggs & batch skillets under $65/wk',
    focusTag: 'Budget',
    estimatedWeeklyCost: 58,
    avgDailyCalories: 1780,
    avgDailyProtein: 94,
    days: [
      {
        note: 'Make large pot of lentil dal for Mon/Tue',
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 1 }],
          dinner: [{ recipeId: 'coconut-lentil-dal', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'coconut-lentil-dal', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'pasta-al-limone-peas', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 1 }],
          lunch: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'sheet-pan-sausage-peppers', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'sheet-pan-sausage-peppers', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'coconut-lentil-dal', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'coconut-lentil-dal', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 1 }],
          lunch: [{ recipeId: 'pasta-al-limone-peas', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
    ],
  },
  {
    id: 'quick-20-min',
    name: '20-Minute Weeknights',
    tagline: 'Minimal cleanup and fast skillets for busy schedules',
    focusTag: 'Quick',
    estimatedWeeklyCost: 92,
    avgDailyCalories: 1750,
    avgDailyProtein: 118,
    days: [
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'grilled-chicken-caesar-wrap', servings: 1 }],
          dinner: [{ recipeId: 'garlic-shrimp-zucchini-noodles', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'avocado-sourdough-poached-eggs', servings: 1 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'pasta-al-limone-peas', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'miso-salmon-bowl', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'grilled-chicken-caesar-wrap', servings: 1 }],
          dinner: [{ recipeId: 'garlic-shrimp-zucchini-noodles', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'avocado-sourdough-poached-eggs', servings: 1 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 1 }],
          dinner: [{ recipeId: 'beef-broccoli-stirfry', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'beef-broccoli-stirfry', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'miso-salmon-bowl', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
    ],
  },
  {
    id: 'family-table',
    name: 'Family Batch & Leftovers',
    tagline: '4-serving crowd-pleasers with intentional next-day lunches',
    focusTag: 'Batch Friendly',
    estimatedWeeklyCost: 138,
    avgDailyCalories: 1920,
    avgDailyProtein: 122,
    days: [
      {
        note: 'Family roast chicken night',
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 2 }],
          lunch: [{ recipeId: 'grilled-chicken-caesar-wrap', servings: 2 }],
          dinner: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 4 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 2 }],
        },
      },
      {
        note: 'Pack leftover roast chicken lunches',
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 2 }],
          lunch: [{ recipeId: 'herb-lemon-chicken-skillet', servings: 2, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 4 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 2 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 2 }],
          lunch: [{ recipeId: 'pasta-al-limone-peas', servings: 2, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 4 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 2 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 2 }],
          lunch: [{ recipeId: 'turkey-taco-quinoa-skillet', servings: 2, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'sheet-pan-sausage-peppers', servings: 4 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 2 }],
        },
      },
      {
        note: 'Friday easy stir-fry',
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 2 }],
          lunch: [{ recipeId: 'sheet-pan-sausage-peppers', servings: 2, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'beef-broccoli-stirfry', servings: 4 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 2 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'avocado-sourdough-poached-eggs', servings: 2 }],
          lunch: [{ recipeId: 'beef-broccoli-stirfry', servings: 2, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'miso-salmon-bowl', servings: 4 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 2 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 2 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 2 }],
          dinner: [{ recipeId: 'coconut-lentil-dal', servings: 4 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 2 }],
        },
      },
    ],
  },
  {
    id: 'vegetarian-fresh',
    name: 'Plant-Forward Vegetarian',
    tagline: 'Colorful produce, red lentils, halloumi, tofu & whole grains',
    focusTag: 'Vegetarian',
    estimatedWeeklyCost: 79,
    avgDailyCalories: 1740,
    avgDailyProtein: 88,
    days: [
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 1 }],
          dinner: [{ recipeId: 'coconut-lentil-dal', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'avocado-sourdough-poached-eggs', servings: 1 }],
          lunch: [{ recipeId: 'coconut-lentil-dal', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'tofu-peanut-noodle-salad', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'spinach-feta-egg-muffins', servings: 1 }],
          lunch: [{ recipeId: 'tofu-peanut-noodle-salad', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'pasta-al-limone-peas', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'coconut-lentil-dal', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'berry-almond-overnight-oats', servings: 1 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 1 }],
          dinner: [{ recipeId: 'tofu-peanut-noodle-salad', servings: 1 }],
          snacks: [{ recipeId: 'edamame-sea-salt-snack', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'avocado-sourdough-poached-eggs', servings: 1 }],
          lunch: [{ recipeId: 'coconut-lentil-dal', servings: 1, isLeftover: true, leftoverOffsetDays: -1 }],
          dinner: [{ recipeId: 'pasta-al-limone-peas', servings: 1 }],
          snacks: [{ recipeId: 'apple-peanut-butter-yogurt', servings: 1 }],
        },
      },
      {
        slots: {
          breakfast: [{ recipeId: 'cottage-cheese-protein-pancakes', servings: 1 }],
          lunch: [{ recipeId: 'mediterranean-chickpea-salad', servings: 1 }],
          dinner: [{ recipeId: 'coconut-lentil-dal', servings: 1 }],
          snacks: [{ recipeId: 'hummus-veggie-protein-box', servings: 1 }],
        },
      },
    ],
  },
];

export function instantiateTemplateForWeek(
  template: MealTemplate,
  weekDates: string[],
  existingDays: Record<string, DayPlan>
): Record<string, DayPlan> {
  const updated = { ...existingDays };
  const uid = () => Math.random().toString(36).slice(2, 9);

  weekDates.forEach((date, dayIndex) => {
    const tmplDay = template.days[dayIndex % template.days.length];
    const baseSlots = {
      breakfast: [],
      lunch: [],
      dinner: [],
      snacks: [],
    } as DayPlan['slots'];

    (['breakfast', 'lunch', 'dinner', 'snacks'] as const).forEach((slotKey) => {
      const entries = tmplDay.slots[slotKey] || [];
      baseSlots[slotKey] = entries.map((entry) => ({
        instanceId: `${date}-${slotKey}-${uid()}`,
        recipeId: entry.recipeId,
        servings: entry.servings,
        isLeftover: entry.isLeftover,
        leftoverFromDate:
          entry.isLeftover && entry.leftoverOffsetDays !== undefined
            ? addDaysISO(date, entry.leftoverOffsetDays)
            : undefined,
      }));
    });

    updated[date] = {
      date,
      slots: baseSlots,
      note: tmplDay.note || existingDays[date]?.note || '',
    };
  });

  return updated;
}
