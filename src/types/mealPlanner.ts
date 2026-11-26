export type MealSlotType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type DifficultyLevel = 'Easy' | 'Medium' | 'Chef';

export type DietaryTag =
  | 'High Protein'
  | 'Low Carb'
  | 'Vegetarian'
  | 'Gluten-Free'
  | 'Dairy-Free'
  | 'Budget'
  | 'Quick'
  | 'Batch Friendly';

export type GroceryCategory =
  | 'Produce'
  | 'Meat & Fish'
  | 'Dairy & Eggs'
  | 'Pantry'
  | 'Frozen'
  | 'Spices & Oils'
  | 'Bakery & Grains';

export interface Ingredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: GroceryCategory;
  estimatedPrice: number; // Estimated USD cost for base recipe servings
}

export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Recipe {
  id: string;
  title: string;
  subtitle: string;
  cuisine?: string;
  flavorProfile?: string;
  mealTypes: MealSlotType[];
  prepTimeMinutes: number;
  cookTimeMinutes: number;
  difficulty: DifficultyLevel;
  servings: number; // Base servings this recipe yields
  dietaryTags: DietaryTag[];
  macrosPerServing: Macros;
  ingredients: Ingredient[];
  instructions: string[];
  equipment?: string[];
  nutritionHighlights?: string[];
  chefTip?: string;
  batchTip?: string;
  reheatTip?: string;
  swaps?: string[];
  storageDays?: number;
  imageUrl?: string;
  isCustom?: boolean;
}

export interface PlannedMealEntry {
  instanceId: string;
  recipeId: string;
  servings: number;
  isLeftover?: boolean;
  leftoverFromDate?: string; // ISO YYYY-MM-DD of original cooked meal
  completed?: boolean;
}

export type DaySlots = Record<MealSlotType, PlannedMealEntry[]>;

export interface DayPlan {
  date: string; // YYYY-MM-DD
  slots: DaySlots;
  note: string;
}

export interface NutritionTargets {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  weeklyBudget: number;
}

export interface ManualGroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  category: GroceryCategory;
  estimatedPrice: number;
}

export interface MealTemplate {
  id: string;
  name: string;
  tagline: string;
  focusTag: DietaryTag;
  estimatedWeeklyCost: number;
  avgDailyCalories: number;
  avgDailyProtein: number;
  // 7 days (0 = Monday ... 6 = Sunday)
  days: Array<{
    note?: string;
    slots: Partial<Record<MealSlotType, Array<{ recipeId: string; servings: number; isLeftover?: boolean; leftoverOffsetDays?: number }>>>;
  }>;
}

export interface PricingConfig {
  currencyCode: string;
  regionalPriceFactor: number;
  priceOverrides: Record<string, number>;
}

export type ActiveTab = 'calendar' | 'recipes' | 'grocery' | 'nutrition' | 'prep';
