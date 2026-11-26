import React, { useMemo, useState } from 'react';
import {
  X,
  Heart,
  Plus,
  Minus,
  Check,
  Trash2,
  RotateCcw,
} from 'lucide-react';
import {
  DietaryTag,
  DifficultyLevel,
  GroceryCategory,
  Ingredient,
  MealSlotType,
  MealTemplate,
  Recipe,
} from '../types/mealPlanner';
import { GROCERY_CATEGORY_ORDER, MEAL_SLOT_LABELS, formatQuantity } from '../utils/groceryUtils';
import { formatFullDayLabel } from '../utils/dateUtils';
import { RecipeImage } from './RecipeImage';
import { SoapBubbleSearch } from '../../components/soap-bubble';
import { BubbleButton, BubbleIconButton } from './BubbleControls';

const ALL_DIETARY_TAGS: DietaryTag[] = [
  'High Protein',
  'Low Carb',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Budget',
  'Quick',
  'Batch Friendly',
];

/* -------------------------------------------------------------------------- */
/* 1. Assign Meal Modal                                                       */
/* -------------------------------------------------------------------------- */

interface AssignMealModalProps {
  open: boolean;
  date: string;
  slot: MealSlotType;
  recipes: Recipe[];
  favoriteIds: Set<string>;
  onClose: () => void;
  onAssign: (recipeId: string, servings: number, isLeftover: boolean) => void;
}

export const AssignMealModal: React.FC<AssignMealModalProps> = ({
  open,
  date,
  slot,
  recipes,
  favoriteIds,
  onClose,
  onAssign,
}) => {
  const [query, setQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'recommended' | 'favorites' | 'all'>('recommended');
  const [servings, setServings] = useState(1);
  const [isLeftover, setIsLeftover] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (filterMode === 'recommended' && !r.mealTypes.includes(slot)) return false;
      if (filterMode === 'favorites' && !favoriteIds.has(r.id)) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.dietaryTags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [recipes, slot, filterMode, favoriteIds, query]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
        className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-xl shadow-lg flex flex-col max-h-[86vh]"
      >
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between gap-4">
          <div>
            <h2 id="assign-modal-title" className="text-lg font-semibold text-[#111827]">
              Add to {MEAL_SLOT_LABELS[slot]}
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">{formatFullDayLabel(date)}</p>
          </div>
          <BubbleIconButton
            variant="default"
            iconSize="md"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </BubbleIconButton>
        </div>

        <div className="px-6 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#E5E7EB]/60 rounded-full">
            {(['recommended', 'favorites', 'all'] as const).map((mode) => (
              <BubbleButton
                key={mode}
                variant={filterMode === mode ? 'dark' : 'default'}
                size="sm"
                onClick={() => setFilterMode(mode)}
              >
                {mode === 'recommended'
                  ? `Best for ${MEAL_SLOT_LABELS[slot]}`
                  : mode === 'favorites'
                  ? 'Favorites'
                  : 'All Recipes'}
              </BubbleButton>
            ))}
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[#4B5563]">Servings:</span>
              <div className="inline-flex items-center border border-[#E5E7EB] rounded-full bg-white px-0.5">
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                  className="px-2 py-1 text-[#4B5563] hover:text-[#111827]"
                  aria-label="Decrease servings"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-medium tabular-nums text-[#111827]">
                  {servings}
                </span>
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.min(8, s + 1))}
                  className="px-2 py-1 text-[#4B5563] hover:text-[#111827]"
                  aria-label="Increase servings"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[#4B5563]">
              <input
                type="checkbox"
                checked={isLeftover}
                onChange={(e) => setIsLeftover(e.target.checked)}
                className="rounded border-[#D1D5DB] text-[#15803D] focus:ring-[#15803D]"
              />
              <span>Mark as leftover</span>
            </label>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-[#E5E7EB]">
          <div className="text-xs">
            <SoapBubbleSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes or dietary tags..."
              aria-label="Search recipes or dietary tags"
              style={{ height: 38 }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6B7280]">
              No matching recipes found. Try switching to All Recipes.
            </div>
          ) : (
            filtered.map((recipe) => {
              const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
              return (
                <div
                  key={recipe.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F9FAFB] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#111827] truncate">
                        {recipe.title}
                      </span>
                      {favoriteIds.has(recipe.id) && (
                        <Heart className="w-3.5 h-3.5 text-[#DC2626] fill-[#DC2626] shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6B7280] mt-1">
                      <span className="font-mono tabular-nums text-[#111827]">
                        {recipe.macrosPerServing.calories} kcal
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        {recipe.macrosPerServing.protein}g P
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{totalMins} min</span>
                      <span aria-hidden="true">·</span>
                      <span>{recipe.dietaryTags.slice(0, 2).join(', ')}</span>
                    </div>
                  </div>

                  <BubbleButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      onAssign(recipe.id, servings, isLeftover);
                      onClose();
                    }}
                  >
                    Assign
                  </BubbleButton>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 2. Recipe Detail Modal                                                     */
/* -------------------------------------------------------------------------- */

interface RecipeDetailModalProps {
  recipe: Recipe | null;
  isFavorite: boolean;
  onToggleFavorite: (recipeId: string) => void;
  onClose: () => void;
  onAssignToDate: (recipeId: string, date: string, slot: MealSlotType, servings: number) => void;
  availableDates: string[];
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  isFavorite,
  onToggleFavorite,
  onClose,
  onAssignToDate,
  availableDates,
}) => {
  const [servings, setServings] = useState<number>(recipe?.servings || 2);
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0] || '');
  const [selectedSlot, setSelectedSlot] = useState<MealSlotType>(recipe?.mealTypes[0] || 'dinner');
  const [addedFeedback, setAddedFeedback] = useState(false);

  React.useEffect(() => {
    if (recipe) {
      setServings(recipe.servings);
      setSelectedSlot(recipe.mealTypes[0] || 'dinner');
      setAddedFeedback(false);
    }
  }, [recipe]);

  if (!recipe) return null;

  const scale = servings / Math.max(1, recipe.servings);
  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-detail-title"
        className="w-full max-w-3xl bg-white border border-[#E5E7EB] rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[90vh]"
      >
        <div className="relative h-56 shrink-0 bg-[#F3F4F6]">
          <RecipeImage
            src={recipe.imageUrl}
            alt={recipe.title}
            mealTypes={recipe.mealTypes}
            className="w-full h-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent" />
          <BubbleIconButton
            variant="default"
            iconSize="md"
            onClick={onClose}
            aria-label="Close recipe details"
            className="!absolute top-4 right-4"
          >
            <X className="w-4 h-4" />
          </BubbleIconButton>
          <div className="absolute bottom-4 left-6 right-6 text-white">
            <div className="text-xs text-white/85 flex items-center gap-2 mb-1">
              <span>{recipe.mealTypes.map((m) => MEAL_SLOT_LABELS[m]).join(' / ')}</span>
              <span aria-hidden="true">·</span>
              <span>{totalTime} min total</span>
              <span aria-hidden="true">·</span>
              <span>{recipe.difficulty}</span>
            </div>
            <h2 id="recipe-detail-title" className="font-display text-2xl font-bold leading-tight">
              {recipe.title}
            </h2>
          </div>
        </div>

        <div className="px-6 py-4 border-b border-[#E5E7EB] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <div>
              <span className="text-[#6B7280] block">Calories</span>
              <span className="font-mono font-semibold text-sm tabular-nums text-[#111827]">
                {recipe.macrosPerServing.calories} kcal
              </span>
            </div>
            <div className="h-6 w-px bg-[#E5E7EB]" />
            <div>
              <span className="text-[#6B7280] block">Protein</span>
              <span className="font-mono font-semibold text-sm tabular-nums text-[#15803D]">
                {recipe.macrosPerServing.protein}g
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block">Carbs</span>
              <span className="font-mono font-semibold text-sm tabular-nums text-[#111827]">
                {recipe.macrosPerServing.carbs}g
              </span>
            </div>
            <div>
              <span className="text-[#6B7280] block">Fat</span>
              <span className="font-mono font-semibold text-sm tabular-nums text-[#111827]">
                {recipe.macrosPerServing.fat}g
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <BubbleButton
              variant={isFavorite ? 'danger' : 'default'}
              size="sm"
              onClick={() => onToggleFavorite(recipe.id)}
            >
              <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#DC2626] text-[#DC2626]' : ''}`} />
              <span>{isFavorite ? 'Favorited' : 'Save Favorite'}</span>
            </BubbleButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#4B5563]">
            <span>{recipe.subtitle}</span>
            {recipe.dietaryTags.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-[#15803D] font-medium">
                  {recipe.dietaryTags.join(' · ')}
                </span>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#111827]">Ingredients</h3>
                <div className="inline-flex items-center gap-1 border border-[#E5E7EB] rounded-full px-2 py-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    className="p-0.5 text-[#6B7280] hover:text-[#111827]"
                    aria-label="Decrease recipe servings"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono tabular-nums px-1 text-[#111827]">
                    {servings} srv
                  </span>
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.min(12, s + 1))}
                    className="p-0.5 text-[#6B7280] hover:text-[#111827]"
                    aria-label="Increase recipe servings"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-[#E5E7EB] border-t border-b border-[#E5E7EB]">
                {recipe.ingredients.map((ing) => (
                  <li key={ing.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                    <span className="text-[#374151]">{ing.name}</span>
                    <span className="font-mono tabular-nums text-[#111827] whitespace-nowrap">
                      {formatQuantity(ing.quantity * scale)} {ing.unit}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-7 space-y-4">
              <h3 className="text-sm font-semibold text-[#111827]">Instructions</h3>
              <ol className="space-y-3">
                {recipe.instructions.map((step, i) => (
                  <li key={i} className="flex gap-3 text-sm text-[#374151] leading-relaxed">
                    <span className="font-mono text-xs font-semibold text-[#15803D] pt-0.5 shrink-0">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              {(recipe.batchTip || recipe.storageDays) && (
                <div className="p-3.5 bg-[#F8FAFC] border border-[#E5E7EB] rounded-lg text-xs text-[#4B5563] space-y-1">
                  <div className="font-medium text-[#111827]">
                    Batch & Storage{recipe.storageDays ? ` · Keeps ${recipe.storageDays} days chilled` : ''}
                  </div>
                  {recipe.batchTip && <p>{recipe.batchTip}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-[#E5E7EB] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-[#374151]">Schedule meal:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 border border-[#E5E7EB] rounded-md bg-white text-[#111827]"
            >
              {availableDates.map((d) => (
                <option key={d} value={d}>
                  {formatFullDayLabel(d)}
                </option>
              ))}
            </select>
            <select
              value={selectedSlot}
              onChange={(e) => setSelectedSlot(e.target.value as MealSlotType)}
              className="px-2.5 py-1.5 border border-[#E5E7EB] rounded-md bg-white text-[#111827]"
            >
              {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).map((s) => (
                <option key={s} value={s}>
                  {MEAL_SLOT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          <BubbleButton
            variant="primary"
            size="md"
            onClick={() => {
              if (!selectedDate) return;
              onAssignToDate(recipe.id, selectedDate, selectedSlot, 1);
              setAddedFeedback(true);
            }}
          >
            {addedFeedback ? <Check className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            <span>{addedFeedback ? 'Added to Calendar' : 'Add to Plan'}</span>
          </BubbleButton>
        </div>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 3. Quick-Add Custom Meal Modal                                             */
/* -------------------------------------------------------------------------- */

interface CustomRecipeModalProps {
  open: boolean;
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
}

export const CustomRecipeModal: React.FC<CustomRecipeModalProps> = ({
  open,
  onClose,
  onSaveRecipe,
}) => {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [mealTypes, setMealTypes] = useState<MealSlotType[]>(['dinner']);
  const [prepTime, setPrepTime] = useState(10);
  const [cookTime, setCookTime] = useState(15);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('Easy');
  const [servings, setServings] = useState(2);
  const [dietaryTags, setDietaryTags] = useState<DietaryTag[]>(['High Protein']);
  const [calories, setCalories] = useState(480);
  const [protein, setProtein] = useState(32);
  const [carbs, setCarbs] = useState(40);
  const [fat, setFat] = useState(18);
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    {
      id: 'custom-1',
      name: 'Chicken breast',
      quantity: 300,
      unit: 'g',
      category: 'Meat & Fish',
      estimatedPrice: 4.5,
    },
  ]);
  const [instructionsText, setInstructionsText] = useState(
    'Season protein and prep vegetables.\nCook in skillet over medium-high heat until golden.\nServe warm.'
  );

  if (!open) return null;

  const toggleMealType = (slot: MealSlotType) => {
    setMealTypes((prev) =>
      prev.includes(slot)
        ? prev.length > 1
          ? prev.filter((s) => s !== slot)
          : prev
        : [...prev, slot]
    );
  };

  const toggleTag = (tag: DietaryTag) => {
    setDietaryTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const addIngredientRow = () => {
    setIngredients((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${prev.length}`,
        name: '',
        quantity: 1,
        unit: 'whole',
        category: 'Produce',
        estimatedPrice: 1.5,
      },
    ]);
  };

  const updateIngredient = (idx: number, patch: Partial<Ingredient>) => {
    setIngredients((prev) => prev.map((item, i) => (i === idx ? { ...item, ...patch } : item)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const validIngredients = ingredients.filter((i) => i.name.trim().length > 0);
    const newRecipe: Recipe = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Custom home kitchen recipe',
      mealTypes,
      prepTimeMinutes: Math.max(0, prepTime),
      cookTimeMinutes: Math.max(0, cookTime),
      difficulty,
      servings: Math.max(1, servings),
      dietaryTags,
      macrosPerServing: {
        calories: Math.max(0, calories),
        protein: Math.max(0, protein),
        carbs: Math.max(0, carbs),
        fat: Math.max(0, fat),
      },
      ingredients:
        validIngredients.length > 0
          ? validIngredients
          : [
              {
                id: `ing-fallback-${Date.now()}`,
                name: title.trim(),
                quantity: 1,
                unit: 'serving',
                category: 'Pantry',
                estimatedPrice: 3.5,
              },
            ],
      instructions: instructionsText
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
      storageDays: 3,
      isCustom: true,
    };

    onSaveRecipe(newRecipe);
    setTitle('');
    setSubtitle('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-recipe-title"
        className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-xl shadow-lg flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 id="custom-recipe-title" className="text-lg font-semibold text-[#111827]">
            Quick-Add Custom Meal
          </h2>
          <BubbleIconButton
            variant="default"
            iconSize="md"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </BubbleIconButton>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#374151] mb-1">
                Meal Title
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Seared Teriyaki Tofu Rice Bowl"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#374151] mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Crisp pan-fried tofu with steamed broccoli and sesame glaze"
                className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#374151] mb-1">
                Meal Slots
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).map((slot) => (
                  <BubbleButton
                    key={slot}
                    variant={mealTypes.includes(slot) ? 'sage' : 'default'}
                    size="xs"
                    onClick={() => toggleMealType(slot)}
                  >
                    {MEAL_SLOT_LABELS[slot]}
                  </BubbleButton>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Prep (m)</label>
                <input
                  type="number"
                  min={0}
                  value={prepTime}
                  onChange={(e) => setPrepTime(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-[#E5E7EB] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Cook (m)</label>
                <input
                  type="number"
                  min={0}
                  value={cookTime}
                  onChange={(e) => setCookTime(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-[#E5E7EB] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#374151] mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full px-2 py-1.5 text-sm border border-[#E5E7EB] rounded-lg bg-white"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Chef">Chef</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1.5">
              Dietary Tags
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_DIETARY_TAGS.map((tag) => (
                <BubbleButton
                  key={tag}
                  variant={dietaryTags.includes(tag) ? 'sage' : 'default'}
                  size="xs"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
                </BubbleButton>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-[#374151]">
                Nutrition Per Serving
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#6B7280]">Base Servings:</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="w-14 px-2 py-1 text-xs font-mono border border-[#E5E7EB] rounded-md"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-[#6B7280] mb-1">Calories</label>
                <input
                  type="number"
                  min={0}
                  value={calories}
                  onChange={(e) => setCalories(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-[#E5E7EB] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6B7280] mb-1">Protein (g)</label>
                <input
                  type="number"
                  min={0}
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-[#E5E7EB] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6B7280] mb-1">Carbs (g)</label>
                <input
                  type="number"
                  min={0}
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-[#E5E7EB] rounded-lg"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6B7280] mb-1">Fat (g)</label>
                <input
                  type="number"
                  min={0}
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono border border-[#E5E7EB] rounded-lg"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#374151]">
                Ingredients (for {servings} servings)
              </span>
              <BubbleButton
                variant="sage"
                size="xs"
                onClick={addIngredientRow}
              >
                + Add ingredient
              </BubbleButton>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, idx) => (
                <div key={ing.id} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Ingredient"
                    value={ing.name}
                    onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                    className="col-span-4 px-2.5 py-1.5 text-xs border border-[#E5E7EB] rounded-md"
                  />
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    value={ing.quantity}
                    onChange={(e) => updateIngredient(idx, { quantity: Number(e.target.value) })}
                    className="col-span-2 px-2 py-1.5 text-xs font-mono border border-[#E5E7EB] rounded-md"
                  />
                  <input
                    type="text"
                    placeholder="unit"
                    value={ing.unit}
                    onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                    className="col-span-2 px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-md"
                  />
                  <select
                    value={ing.category}
                    onChange={(e) =>
                      updateIngredient(idx, { category: e.target.value as GroceryCategory })
                    }
                    className="col-span-3 px-2 py-1.5 text-xs border border-[#E5E7EB] rounded-md bg-white"
                  >
                    {GROCERY_CATEGORY_ORDER.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() =>
                      setIngredients((prev) => prev.filter((_, i) => i !== idx))
                    }
                    aria-label="Remove ingredient"
                    className="col-span-1 p-1 text-[#9CA3AF] hover:text-[#DC2626] flex justify-center"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#374151] mb-1">
              Instructions (one step per line)
            </label>
            <textarea
              rows={3}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#E5E7EB]">
            <BubbleButton
              variant="default"
              size="md"
              onClick={onClose}
            >
              Cancel
            </BubbleButton>
            <BubbleButton
              type="submit"
              variant="primary"
              size="md"
            >
              Save to Library
            </BubbleButton>
          </div>
        </form>
      </div>
    </div>
  );
};

/* -------------------------------------------------------------------------- */
/* 4. Apply Template Modal                                                    */
/* -------------------------------------------------------------------------- */

interface ApplyTemplateModalProps {
  open: boolean;
  templates: MealTemplate[];
  activeWeekIndex: number;
  planningHorizonWeeks: number;
  onClose: () => void;
  onApplyTemplate: (template: MealTemplate, scope: 'current' | 'all') => void;
  onSaveCurrentAsTemplate: (name: string) => void;
}

export const ApplyTemplateModal: React.FC<ApplyTemplateModalProps> = ({
  open,
  templates,
  activeWeekIndex,
  planningHorizonWeeks,
  onClose,
  onApplyTemplate,
  onSaveCurrentAsTemplate,
}) => {
  const [applyScope, setApplyScope] = useState<'current' | 'all'>('current');
  const [customName, setCustomName] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        className="w-full max-w-2xl bg-white border border-[#E5E7EB] rounded-xl shadow-lg flex flex-col max-h-[88vh]"
      >
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div>
            <h2 id="template-modal-title" className="text-lg font-semibold text-[#111827]">
              Meal Plan Templates
            </h2>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Populate a full 7-day plan with built-in leftovers, or save your current week.
            </p>
          </div>
          <BubbleIconButton
            variant="default"
            iconSize="md"
            onClick={onClose}
            aria-label="Close templates modal"
          >
            <X className="w-4 h-4" />
          </BubbleIconButton>
        </div>

        <div className="px-6 py-3 border-b border-[#E5E7EB] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#374151]">Apply template to:</span>
          <div className="flex items-center gap-1.5 p-1 bg-[#E5E7EB]/60 rounded-xl">
            <BubbleButton
              variant={applyScope === 'current' ? 'dark' : 'default'}
              size="sm"
              onClick={() => setApplyScope('current')}
            >
              Week {activeWeekIndex + 1} Only
            </BubbleButton>
            <BubbleButton
              variant={applyScope === 'all' ? 'dark' : 'default'}
              size="sm"
              onClick={() => setApplyScope('all')}
            >
              All {planningHorizonWeeks} Planned Weeks
            </BubbleButton>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[#E5E7EB]">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F9FAFB]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#111827]">{tmpl.name}</h3>
                  <span className="text-xs text-[#15803D] font-medium">· {tmpl.focusTag}</span>
                </div>
                <p className="text-xs text-[#6B7280]">{tmpl.tagline}</p>
                <div className="flex items-center gap-2 text-xs text-[#4B5563] pt-0.5 font-mono tabular-nums">
                  <span>~{tmpl.avgDailyCalories} kcal/day</span>
                  <span aria-hidden="true">·</span>
                  <span>~{tmpl.avgDailyProtein}g protein</span>
                  <span aria-hidden="true">·</span>
                  <span>~${tmpl.estimatedWeeklyCost}/wk</span>
                </div>
              </div>

              <BubbleButton
                variant="primary"
                size="md"
                onClick={() => {
                  onApplyTemplate(tmpl, applyScope);
                  onClose();
                }}
              >
                Apply Template
              </BubbleButton>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-[#E5E7EB] bg-[#FAFAFA] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={`Save Week ${activeWeekIndex + 1} as template name...`}
              className="flex-1 px-3 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#15803D]"
            />
            <BubbleButton
              variant="default"
              size="sm"
              disabled={!customName.trim()}
              onClick={() => {
                if (!customName.trim()) return;
                onSaveCurrentAsTemplate(customName.trim());
                setCustomName('');
              }}
              className="disabled:opacity-40"
            >
              Save Current Week
            </BubbleButton>
          </div>
          <span className="text-[11px] text-[#6B7280] flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Replaces target week slots
          </span>
        </div>
      </div>
    </div>
  );
};
