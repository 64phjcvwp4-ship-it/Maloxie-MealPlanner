import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Heart,
  Plus,
  Minus,
  Check,
  Trash2,
  RotateCcw,
  Pencil,
  Link2,
  Loader2,
} from 'lucide-react';
import {
  DietaryTag,
  DifficultyLevel,
  GroceryCategory,
  Ingredient,
  MealSlotType,
  MealTemplate,
  PricingConfig,
  Recipe,
} from '../types/mealPlanner';
import { GROCERY_CATEGORY_ORDER, MEAL_SLOT_LABELS, formatQuantity } from '../utils/groceryUtils';
import {
  convertBaseUsdToLocal,
  convertLocalToBaseUsd,
  formatCurrency,
  getCurrencyOption,
  getIngredientLocalPrice,
  roundForCurrencyInput,
} from '../utils/currencyUtils';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2D24]/45">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
        className="w-full max-w-2xl bg-[#FAF8F6] border border-[#D9D0CB] rounded-xl shadow-lg flex flex-col max-h-[86vh]"
      >
        <div className="px-6 py-4 border-b border-[#D9D0CB] flex items-center justify-between gap-4">
          <div>
            <h2 id="assign-modal-title" className="text-lg font-semibold text-[#2E2D24]">
              Add to {MEAL_SLOT_LABELS[slot]}
            </h2>
            <p className="text-xs text-[#6A6754] mt-0.5">{formatFullDayLabel(date)}</p>
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

        <div className="px-6 py-3 border-b border-[#D9D0CB] bg-[#F3EFEC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0] rounded-full">
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
              <span className="text-[#4A483A]">Servings:</span>
              <div className="inline-flex items-center border border-[#D9D0CB] rounded-full bg-[#FAF8F6] px-0.5">
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.max(1, s - 1))}
                  className="px-2 py-1 text-[#4A483A] hover:text-[#2E2D24]"
                  aria-label="Decrease servings"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono font-medium tabular-nums text-[#2E2D24]">
                  {servings}
                </span>
                <button
                  type="button"
                  onClick={() => setServings((s) => Math.min(8, s + 1))}
                  className="px-2 py-1 text-[#4A483A] hover:text-[#2E2D24]"
                  aria-label="Increase servings"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer text-[#4A483A]">
              <input
                type="checkbox"
                checked={isLeftover}
                onChange={(e) => setIsLeftover(e.target.checked)}
                className="rounded border-[#908B6F] accent-[#6A6754] focus:ring-[#6A6754]"
              />
              <span>Mark as leftover</span>
            </label>
          </div>
        </div>

        <div className="px-6 py-3 border-b border-[#D9D0CB]">
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

        <div className="flex-1 overflow-y-auto divide-y divide-[#D9D0CB]">
          {filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#6A6754]">
              No matching recipes found. Try switching to All Recipes.
            </div>
          ) : (
            filtered.map((recipe) => {
              const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
              return (
                <div
                  key={recipe.id}
                  className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-[#F3EFEC] transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-[#2E2D24] truncate">
                        {recipe.title}
                      </span>
                      {favoriteIds.has(recipe.id) && (
                        <Heart className="w-3.5 h-3.5 text-[#B43C2E] fill-[#B43C2E] shrink-0" />
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6A6754] mt-1">
                      <span className="font-mono tabular-nums text-[#2E2D24]">
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
  pricing: PricingConfig;
  onSetPriceOverride: (key: string, quantity: number, totalLocalPrice: number) => void;
  onClearPriceOverride: (key: string) => void;
  onToggleFavorite: (recipeId: string) => void;
  onClose: () => void;
  onAssignToDate: (recipeId: string, date: string, slot: MealSlotType, servings: number) => void;
  availableDates: string[];
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  isFavorite,
  pricing,
  onSetPriceOverride,
  onClearPriceOverride,
  onToggleFavorite,
  onClose,
  onAssignToDate,
  availableDates,
}) => {
  const [servings, setServings] = useState<number>(recipe?.servings || 2);
  const [selectedDate, setSelectedDate] = useState<string>(availableDates[0] || '');
  const [selectedSlot, setSelectedSlot] = useState<MealSlotType>(recipe?.mealTypes[0] || 'dinner');
  const [addedFeedback, setAddedFeedback] = useState(false);
  const [editingIngKey, setEditingIngKey] = useState<string | null>(null);
  const [draftIngPrice, setDraftIngPrice] = useState('');

  React.useEffect(() => {
    if (recipe) {
      setServings(recipe.servings);
      setSelectedSlot(recipe.mealTypes[0] || 'dinner');
      setAddedFeedback(false);
      setEditingIngKey(null);
    }
  }, [recipe]);

  if (!recipe) return null;

  const activeCurrency = getCurrencyOption(pricing.currencyCode);
  const scale = servings / Math.max(1, recipe.servings);
  const totalTime = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
  const totalRecipeCost = recipe.ingredients.reduce(
    (sum, ing) => sum + getIngredientLocalPrice(ing, scale, pricing).price,
    0
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#2E2D24]/45"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recipe-detail-title"
        className="relative w-full max-w-3xl bg-[#FAF8F6] border border-[#D9D0CB] rounded-xl shadow-lg overflow-hidden flex flex-col max-h-[92dvh]"
      >
        <BubbleIconButton
          variant="default"
          iconSize="md"
          onClick={onClose}
          aria-label="Close recipe details"
          className="!absolute top-3 right-3 z-20 shadow-md"
        >
          <X className="w-4 h-4" />
        </BubbleIconButton>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          <div className="relative h-44 sm:h-56 bg-[#EAE4E0]">
            <RecipeImage
              src={recipe.imageUrl}
              alt={recipe.title}
              mealTypes={recipe.mealTypes}
              className="w-full h-full"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2E2D24]/85 via-[#2E2D24]/25 to-transparent" />
            <div className="absolute bottom-3.5 left-4 right-14 sm:bottom-4 sm:left-6 sm:right-16 text-[#FAF8F6]">
              <div className="text-[11px] sm:text-xs text-[#E5DFDA] flex flex-wrap items-center gap-x-2 gap-y-0.5 mb-1">
                {recipe.cuisine && (
                  <>
                    <span className="font-medium text-[#FAF8F6]">{recipe.cuisine}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span>{recipe.mealTypes.map((m) => MEAL_SLOT_LABELS[m]).join(' / ')}</span>
                <span aria-hidden="true">·</span>
                <span>
                  {totalTime} min total ({recipe.prepTimeMinutes}m prep / {recipe.cookTimeMinutes}m cook)
                </span>
                <span aria-hidden="true">·</span>
                <span>{recipe.difficulty}</span>
              </div>
              <h2 id="recipe-detail-title" className="font-display text-xl sm:text-2xl font-bold leading-tight">
                {recipe.title}
              </h2>
            </div>
          </div>

          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[#D9D0CB] bg-[#F3EFEC] flex flex-wrap items-center justify-between gap-3 sm:gap-4">
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
              <div>
                <span className="text-[#6A6754] block">Calories</span>
                <span className="font-mono font-semibold text-sm tabular-nums text-[#2E2D24]">
                  {recipe.macrosPerServing.calories} kcal
                </span>
              </div>
              <div className="h-6 w-px bg-[#D9D0CB]" />
              <div>
                <span className="text-[#6A6754] block">Protein</span>
                <span className="font-mono font-semibold text-sm tabular-nums text-[#6A6754]">
                  {recipe.macrosPerServing.protein}g
                </span>
              </div>
              <div>
                <span className="text-[#6A6754] block">Carbs</span>
                <span className="font-mono font-semibold text-sm tabular-nums text-[#2E2D24]">
                  {recipe.macrosPerServing.carbs}g
                </span>
              </div>
              <div>
                <span className="text-[#6A6754] block">Fat</span>
                <span className="font-mono font-semibold text-sm tabular-nums text-[#2E2D24]">
                  {recipe.macrosPerServing.fat}g
                </span>
              </div>
              <div className="h-6 w-px bg-[#D9D0CB] hidden sm:block" />
              <div>
                <span className="text-[#6A6754] block">Yield & Prep</span>
                <span className="font-mono font-semibold text-sm tabular-nums text-[#2E2D24]">
                  {recipe.servings} srv · {recipe.prepTimeMinutes}m / {recipe.cookTimeMinutes}m
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <BubbleButton
                variant={isFavorite ? 'danger' : 'default'}
                size="sm"
                onClick={() => onToggleFavorite(recipe.id)}
              >
                <Heart className={`w-3.5 h-3.5 ${isFavorite ? 'fill-[#B43C2E] text-[#B43C2E]' : ''}`} />
                <span>{isFavorite ? 'Favorited' : 'Save Favorite'}</span>
              </BubbleButton>
            </div>
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="space-y-2 pb-4 border-b border-[#D9D0CB]">
              <p className="text-sm text-[#2E2D24] leading-relaxed">{recipe.subtitle}</p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#6A6754]">
              {recipe.flavorProfile && (
                <span className="font-medium text-[#4A483A]">{recipe.flavorProfile}</span>
              )}
              {recipe.flavorProfile && recipe.dietaryTags.length > 0 && (
                <span aria-hidden="true">·</span>
              )}
              {recipe.dietaryTags.length > 0 && (
                <span className="font-semibold text-[#6A6754]">
                  {recipe.dietaryTags.join(' · ')}
                </span>
              )}
            </div>
            {recipe.nutritionHighlights && recipe.nutritionHighlights.length > 0 && (
              <p className="text-xs text-[#4A483A]">
                <span className="font-semibold text-[#2E2D24]">Nutrition Highlights: </span>
                {recipe.nutritionHighlights.join(' · ')}
              </p>
            )}
            {recipe.equipment && recipe.equipment.length > 0 && (
              <p className="text-xs text-[#6A6754]">
                <span className="font-semibold text-[#2E2D24]">Equipment: </span>
                {recipe.equipment.join(' · ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#2E2D24]">Ingredients</h3>
                  <p className="text-[11px] font-mono tabular-nums text-[#14532D]">
                    Est. {formatCurrency(totalRecipeCost, pricing.currencyCode)} ({formatCurrency(totalRecipeCost / Math.max(1, servings), pricing.currencyCode)}/srv)
                  </p>
                </div>
                <div className="inline-flex items-center gap-1 border border-[#D9D0CB] rounded-full px-2 py-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.max(1, s - 1))}
                    className="p-0.5 text-[#6A6754] hover:text-[#2E2D24]"
                    aria-label="Decrease recipe servings"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="font-mono tabular-nums px-1 text-[#2E2D24]">
                    {servings} srv
                  </span>
                  <button
                    type="button"
                    onClick={() => setServings((s) => Math.min(12, s + 1))}
                    className="p-0.5 text-[#6A6754] hover:text-[#2E2D24]"
                    aria-label="Increase recipe servings"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <ul className="divide-y divide-[#D9D0CB] border-t border-b border-[#D9D0CB]">
                {recipe.ingredients.map((ing) => {
                  const scaledQty = ing.quantity * scale;
                  const { key, price, isCustom } = getIngredientLocalPrice(ing, scale, pricing);
                  const isEditing = editingIngKey === key;

                  return (
                    <li key={ing.id} className="py-2 flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="text-[#4A483A]">{ing.name}</span>
                        {isCustom && (
                          <span className="ml-1.5 text-[10px] text-[#9E5236] font-medium">
                            · Local
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0 font-mono tabular-nums">
                        <span className="text-[#2E2D24] whitespace-nowrap">
                          {formatQuantity(scaledQty)} {ing.unit}
                        </span>

                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              step="any"
                              value={draftIngPrice}
                              onChange={(e) => setDraftIngPrice(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  const num = Number(draftIngPrice);
                                  if (!Number.isNaN(num) && num >= 0) {
                                    onSetPriceOverride(key, scaledQty, num);
                                  }
                                  setEditingIngKey(null);
                                } else if (e.key === 'Escape') {
                                  setEditingIngKey(null);
                                }
                              }}
                              aria-label={`Price for ${ing.name}`}
                              className="w-16 px-1.5 py-0.5 text-[11px] bg-[#FAF8F6] text-[#14532D] border border-[#908B6F] rounded focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const num = Number(draftIngPrice);
                                if (!Number.isNaN(num) && num >= 0) {
                                  onSetPriceOverride(key, scaledQty, num);
                                }
                                setEditingIngKey(null);
                              }}
                              aria-label={`Save price for ${ing.name}`}
                              className="p-0.5 rounded bg-[#6A6754] text-[#FAF8F6]"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingIngKey(key);
                              setDraftIngPrice(
                                String(roundForCurrencyInput(price, pricing.currencyCode))
                              );
                            }}
                            title="Edit local ingredient price"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#14532D] hover:text-[#2E2D24]"
                          >
                            <span>{formatCurrency(price, pricing.currencyCode)}</span>
                            <Pencil className="w-2.5 h-2.5 opacity-45" />
                          </button>
                        )}

                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => onClearPriceOverride(key)}
                            title="Reset ingredient price"
                            aria-label={`Reset price for ${ing.name}`}
                            className="text-[#908B6F] hover:text-[#2E2D24]"
                          >
                            <RotateCcw className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="md:col-span-7 space-y-5">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[#2E2D24]">Instructions</h3>
                <ol className="space-y-3">
                  {recipe.instructions.map((step, i) => (
                    <li key={i} className="flex gap-3 text-sm text-[#4A483A] leading-relaxed">
                      <span className="font-mono text-xs font-semibold text-[#6A6754] pt-0.5 shrink-0">
                        {String(i + 1).padStart(2, '0')}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {recipe.chefTip && (
                <div className="pt-4 border-t border-[#D9D0CB] text-xs text-[#4A483A] space-y-1">
                  <div className="font-semibold text-[#2E2D24]">Chef&apos;s Technique</div>
                  <p className="leading-relaxed">{recipe.chefTip}</p>
                </div>
              )}

              {recipe.swaps && recipe.swaps.length > 0 && (
                <div className="pt-4 border-t border-[#D9D0CB] text-xs text-[#4A483A] space-y-1.5">
                  <div className="font-semibold text-[#2E2D24]">Smart Swaps & Variations</div>
                  <ul className="space-y-1 list-disc pl-4">
                    {recipe.swaps.map((swap, idx) => (
                      <li key={idx} className="leading-relaxed">
                        {swap}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(recipe.batchTip || recipe.reheatTip || recipe.storageDays) && (
                <div className="p-3.5 bg-[#F3EFEC] border border-[#D9D0CB] rounded-lg text-xs text-[#4A483A] space-y-1.5">
                  <div className="font-semibold text-[#2E2D24]">
                    Batch, Storage & Reheating
                    {recipe.storageDays ? ` · Keeps ${recipe.storageDays} days chilled` : ''}
                  </div>
                  {recipe.batchTip && <p className="leading-relaxed">{recipe.batchTip}</p>}
                  {recipe.reheatTip && (
                    <p className="leading-relaxed">
                      <span className="font-semibold text-[#2E2D24]">Reheating: </span>
                      {recipe.reheatTip}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
          </div>
        </div>

        <div className="shrink-0 px-4 py-2.5 sm:px-6 sm:py-3.5 border-t border-[#D9D0CB] bg-[#F3EFEC] flex flex-wrap items-center justify-between gap-2.5 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-[#4A483A] hidden sm:inline">Schedule meal:</span>
            <select
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-2.5 py-1.5 border border-[#D9D0CB] rounded-md bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
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
              className="px-2.5 py-1.5 border border-[#D9D0CB] rounded-md bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
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
  initialMode?: 'manual' | 'import';
  pricing: PricingConfig;
  onClose: () => void;
  onSaveRecipe: (recipe: Recipe) => void;
}

function sanitizeSafeWebImageUrl(raw: string): string | undefined {
  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

export const CustomRecipeModal: React.FC<CustomRecipeModalProps> = ({
  open,
  initialMode = 'manual',
  pricing,
  onClose,
  onSaveRecipe,
}) => {
  const activeCurrency = getCurrencyOption(pricing.currencyCode);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [importUrl, setImportUrl] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [imageUrl, setImageUrl] = useState('');
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
  const [localPrices, setLocalPrices] = useState<Record<string, string>>({});
  const [instructionsText, setInstructionsText] = useState(
    'Season protein and prep vegetables.\nCook in skillet over medium-high heat until golden.\nServe warm.'
  );

  useEffect(() => {
    if (open && initialMode === 'import') {
      const timer = window.setTimeout(() => {
        urlInputRef.current?.focus();
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [open, initialMode]);

  if (!open) return null;

  const resetForm = () => {
    setImportUrl('');
    setImportError(null);
    setImportSuccess(null);
    setTitle('');
    setSubtitle('');
    setCuisine('');
    setImageUrl('');
    setMealTypes(['dinner']);
    setPrepTime(10);
    setCookTime(15);
    setDifficulty('Easy');
    setServings(2);
    setDietaryTags(['High Protein']);
    setCalories(480);
    setProtein(32);
    setCarbs(40);
    setFat(18);
    setIngredients([
      {
        id: `custom-${Date.now()}-1`,
        name: 'Chicken breast',
        quantity: 300,
        unit: 'g',
        category: 'Meat & Fish',
        estimatedPrice: 4.5,
      },
    ]);
    setLocalPrices({});
    setInstructionsText(
      'Season protein and prep vegetables.\nCook in skillet over medium-high heat until golden.\nServe warm.'
    );
  };

  const handleImportUrl = async () => {
    const trimmed = importUrl.trim();
    setImportError(null);
    setImportSuccess(null);

    if (!trimmed) {
      setImportError('Paste a recipe page URL first (starting with https://).');
      return;
    }

    let normalizedUrl: string;
    try {
      const parsed = new URL(trimmed);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        setImportError('Only public http:// and https:// web links can be imported.');
        return;
      }
      normalizedUrl = parsed.toString();
    } catch {
      setImportError('Please enter a full web link including https://');
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch('/api/import-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        recipe?: {
          title?: string;
          subtitle?: string;
          cuisine?: string;
          imageUrl?: string;
          mealTypes?: MealSlotType[];
          prepTimeMinutes?: number;
          cookTimeMinutes?: number;
          difficulty?: DifficultyLevel;
          servings?: number;
          dietaryTags?: DietaryTag[];
          macrosPerServing?: { calories?: number; protein?: number; carbs?: number; fat?: number };
          ingredients?: Ingredient[];
          instructions?: string[];
          usedFallbackMeta?: boolean;
        };
      };

      if (!response.ok || !data.recipe) {
        setImportError(
          data.error || 'Could not extract recipe details from that web page.'
        );
        return;
      }

      const r = data.recipe;
      if (r.title) setTitle(r.title);
      if (r.subtitle) setSubtitle(r.subtitle);
      setCuisine(r.cuisine || '');
      setImageUrl(r.imageUrl ? sanitizeSafeWebImageUrl(r.imageUrl) || '' : '');
      if (Array.isArray(r.mealTypes) && r.mealTypes.length > 0) setMealTypes(r.mealTypes);
      if (typeof r.prepTimeMinutes === 'number') setPrepTime(r.prepTimeMinutes);
      if (typeof r.cookTimeMinutes === 'number') setCookTime(r.cookTimeMinutes);
      if (r.difficulty) setDifficulty(r.difficulty);
      if (typeof r.servings === 'number') setServings(r.servings);
      if (Array.isArray(r.dietaryTags) && r.dietaryTags.length > 0) {
        setDietaryTags(r.dietaryTags);
      }
      if (r.macrosPerServing) {
        setCalories(r.macrosPerServing.calories ?? 450);
        setProtein(r.macrosPerServing.protein ?? 24);
        setCarbs(r.macrosPerServing.carbs ?? 42);
        setFat(r.macrosPerServing.fat ?? 16);
      }
      if (Array.isArray(r.ingredients) && r.ingredients.length > 0) {
        setIngredients(r.ingredients);
        setLocalPrices({});
      } else {
        setIngredients([
          {
            id: `custom-${Date.now()}-0`,
            name: '',
            quantity: 1,
            unit: 'whole',
            category: 'Produce',
            estimatedPrice: 1.5,
          },
        ]);
      }
      if (Array.isArray(r.instructions) && r.instructions.length > 0) {
        setInstructionsText(r.instructions.join('\n'));
      }

      setImportSuccess(
        r.usedFallbackMeta
          ? 'Imported page summary — add ingredients and steps below before saving.'
          : `Imported "${r.title}" — review ingredients, local prices, and click Save to Library.`
      );
    } catch {
      setImportError('Network error while fetching that recipe link. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

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

    const validIngredients = ingredients
      .filter((i) => i.name.trim().length > 0)
      .map((ing) => {
        const enteredLocal = localPrices[ing.id];
        if (enteredLocal !== undefined && !Number.isNaN(Number(enteredLocal))) {
          return {
            ...ing,
            estimatedPrice: convertLocalToBaseUsd(Math.max(0, Number(enteredLocal)), pricing),
          };
        }
        return ing;
      });

    const safeImageUrl = sanitizeSafeWebImageUrl(imageUrl);

    const newRecipe: Recipe = {
      id: `custom-${Date.now()}`,
      title: title.trim(),
      subtitle: subtitle.trim() || 'Custom home kitchen recipe',
      ...(cuisine.trim() ? { cuisine: cuisine.trim() } : {}),
      ...(safeImageUrl ? { imageUrl: safeImageUrl } : {}),
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
    resetForm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2D24]/45">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-recipe-title"
        className="w-full max-w-2xl bg-[#FAF8F6] border border-[#D9D0CB] rounded-xl shadow-lg flex flex-col max-h-[90vh]"
      >
        <div className="px-6 py-4 border-b border-[#D9D0CB] flex items-center justify-between">
          <div>
            <h2 id="custom-recipe-title" className="text-lg font-semibold text-[#2E2D24]">
              {initialMode === 'import' ? 'Import Recipe or Quick-Add Meal' : 'Quick-Add Custom Meal'}
            </h2>
            <p className="text-xs text-[#6A6754] mt-0.5">
              Paste a recipe link from the web or enter your own dish below.
            </p>
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

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Import from Web URL Card */}
          <div className="p-4 rounded-xl bg-[#F3EFEC] border border-[#D9D0CB] space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#2E2D24]">
                <Link2 className="w-3.5 h-3.5 text-[#B86B4B]" />
                <span>Import from Web URL</span>
              </div>
              <span className="text-[11px] text-[#6A6754]">Auto-fills ingredients, macros & steps</span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                ref={urlInputRef}
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleImportUrl();
                  }
                }}
                placeholder="https://www.example.com/recipes/garlic-herb-salmon"
                aria-label="Recipe web URL"
                className="flex-1 px-3 py-2 text-xs bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
              />
              <BubbleButton
                variant="terracotta"
                size="md"
                disabled={isImporting}
                onClick={() => void handleImportUrl()}
                className="shrink-0"
              >
                {isImporting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Importing...</span>
                  </>
                ) : (
                  <>
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Import Recipe</span>
                  </>
                )}
              </BubbleButton>
            </div>

            {importError && (
              <p role="alert" className="text-xs text-[#B43C2E] font-medium">
                {importError}
              </p>
            )}

            {importSuccess && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-[#14532D] font-medium flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 shrink-0" />
                  <span>{importSuccess}</span>
                </p>
                {imageUrl && (
                  <div className="flex items-center gap-2 shrink-0">
                    <img
                      src={imageUrl}
                      alt={title || 'Imported dish preview'}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-md object-cover border border-[#D9D0CB]"
                    />
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-[11px] text-[#6A6754] hover:text-[#2E2D24] underline"
                    >
                      Remove photo
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-[#4A483A] mb-1">
                Meal Title
              </label>
              <input
                required
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Seared Teriyaki Tofu Rice Bowl"
                className="w-full px-3 py-2 text-sm bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
              />
            </div>

            <div className="sm:col-span-1">
              <label className="block text-xs font-medium text-[#4A483A] mb-1">
                Cuisine / Style (optional)
              </label>
              <input
                type="text"
                value={cuisine}
                onChange={(e) => setCuisine(e.target.value)}
                placeholder="e.g. Mediterranean, Japanese"
                className="w-full px-3 py-2 text-sm bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#4A483A] mb-1">
                Short Description
              </label>
              <input
                type="text"
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Crisp pan-fried tofu with steamed broccoli and sesame glaze"
                className="w-full px-3 py-2 text-sm bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4A483A] mb-1">
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
                <label className="block text-xs font-medium text-[#4A483A] mb-1">Prep (m)</label>
                <input
                  type="number"
                  min={0}
                  value={prepTime}
                  onChange={(e) => setPrepTime(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A483A] mb-1">Cook (m)</label>
                <input
                  type="number"
                  min={0}
                  value={cookTime}
                  onChange={(e) => setCookTime(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4A483A] mb-1">Difficulty</label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full px-2 py-1.5 text-sm border border-[#D9D0CB] rounded-lg bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Chef">Chef</option>
                </select>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A483A] mb-1.5">
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
              <span className="text-xs font-medium text-[#4A483A]">
                Nutrition Per Serving
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[#6A6754]">Base Servings:</span>
                <input
                  type="number"
                  min={1}
                  max={12}
                  value={servings}
                  onChange={(e) => setServings(Number(e.target.value))}
                  className="w-14 px-2 py-1 text-xs font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] text-[#6A6754] mb-1">Calories</label>
                <input
                  type="number"
                  min={0}
                  value={calories}
                  onChange={(e) => setCalories(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6A6754] mb-1">Protein (g)</label>
                <input
                  type="number"
                  min={0}
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6A6754] mb-1">Carbs (g)</label>
                <input
                  type="number"
                  min={0}
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
              <div>
                <label className="block text-[11px] text-[#6A6754] mb-1">Fat (g)</label>
                <input
                  type="number"
                  min={0}
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-sm font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                />
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-[#4A483A]">
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
              {ingredients.map((ing, idx) => {
                const defaultLocal = roundForCurrencyInput(
                  convertBaseUsdToLocal(ing.estimatedPrice, pricing),
                  pricing.currencyCode
                );
                const priceVal = localPrices[ing.id] ?? String(defaultLocal);
                return (
                  <div key={ing.id} className="grid grid-cols-12 gap-1.5 items-center">
                    <input
                      type="text"
                      placeholder="Ingredient"
                      value={ing.name}
                      onChange={(e) => updateIngredient(idx, { name: e.target.value })}
                      className="col-span-3 px-2 py-1.5 text-xs bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                    />
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={ing.quantity}
                      onChange={(e) => updateIngredient(idx, { quantity: Number(e.target.value) })}
                      aria-label="Ingredient quantity"
                      className="col-span-2 px-2 py-1.5 text-xs font-mono bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                    />
                    <input
                      type="text"
                      placeholder="unit"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                      aria-label="Ingredient unit"
                      className="col-span-2 px-2 py-1.5 text-xs bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                    />
                    <select
                      value={ing.category}
                      onChange={(e) =>
                        updateIngredient(idx, { category: e.target.value as GroceryCategory })
                      }
                      aria-label="Ingredient category"
                      className="col-span-2 px-1.5 py-1.5 text-xs border border-[#D9D0CB] rounded-md bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                    >
                      {GROCERY_CATEGORY_ORDER.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                    <div className="col-span-2 relative flex items-center">
                      <span className="absolute left-1.5 text-[10px] font-mono text-[#6A6754] pointer-events-none">
                        {activeCurrency.symbol.trim()}
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={priceVal}
                        onChange={(e) =>
                          setLocalPrices((prev) => ({ ...prev, [ing.id]: e.target.value }))
                        }
                        aria-label={`Price in ${activeCurrency.code}`}
                        className="w-full pl-6 pr-1.5 py-1.5 text-xs font-mono bg-[#FAF8F6] text-[#14532D] border border-[#D9D0CB] rounded-md focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setIngredients((prev) => prev.filter((_, i) => i !== idx))
                      }
                      aria-label="Remove ingredient"
                      className="col-span-1 p-1 text-[#908B6F] hover:text-[#B43C2E] flex justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4A483A] mb-1">
              Instructions (one step per line)
            </label>
            <textarea
              rows={3}
              value={instructionsText}
              onChange={(e) => setInstructionsText(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-[#FAF8F6] text-[#2E2D24] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-[#D9D0CB]">
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
  pricing: PricingConfig;
  onClose: () => void;
  onApplyTemplate: (template: MealTemplate, scope: 'current' | 'all') => void;
  onSaveCurrentAsTemplate: (name: string) => void;
}

export const ApplyTemplateModal: React.FC<ApplyTemplateModalProps> = ({
  open,
  templates,
  activeWeekIndex,
  planningHorizonWeeks,
  pricing,
  onClose,
  onApplyTemplate,
  onSaveCurrentAsTemplate,
}) => {
  const [applyScope, setApplyScope] = useState<'current' | 'all'>('current');
  const [customName, setCustomName] = useState('');

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2E2D24]/45">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-modal-title"
        className="w-full max-w-2xl bg-[#FAF8F6] border border-[#D9D0CB] rounded-xl shadow-lg flex flex-col max-h-[88vh]"
      >
        <div className="px-6 py-4 border-b border-[#D9D0CB] flex items-center justify-between">
          <div>
            <h2 id="template-modal-title" className="text-lg font-semibold text-[#2E2D24]">
              Meal Plan Templates
            </h2>
            <p className="text-xs text-[#6A6754] mt-0.5">
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

        <div className="px-6 py-3 border-b border-[#D9D0CB] bg-[#F3EFEC] flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-medium text-[#4A483A]">Apply template to:</span>
          <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0] rounded-xl">
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

        <div className="flex-1 overflow-y-auto divide-y divide-[#D9D0CB]">
          {templates.map((tmpl) => (
            <div
              key={tmpl.id}
              className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-[#F3EFEC]"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-[#2E2D24]">{tmpl.name}</h3>
                  <span className="text-xs text-[#6A6754] font-semibold">· {tmpl.focusTag}</span>
                </div>
                <p className="text-xs text-[#6A6754]">{tmpl.tagline}</p>
                <div className="flex items-center gap-2 text-xs text-[#4A483A] pt-0.5 font-mono tabular-nums">
                  <span>~{tmpl.avgDailyCalories} kcal/day</span>
                  <span aria-hidden="true">·</span>
                  <span>~{tmpl.avgDailyProtein}g protein</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-semibold text-[#14532D]">
                    ~
                    {formatCurrency(
                      convertBaseUsdToLocal(tmpl.estimatedWeeklyCost, pricing),
                      pricing.currencyCode,
                      { compact: true }
                    )}
                    /wk
                  </span>
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

        <div className="px-6 py-4 border-t border-[#D9D0CB] bg-[#F3EFEC] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={`Save Week ${activeWeekIndex + 1} as template name...`}
              className="flex-1 px-3 py-1.5 text-xs bg-[#FAF8F6] text-[#2E2D24] placeholder:text-[#908B6F] border border-[#D9D0CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
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
          <span className="text-[11px] text-[#6A6754] flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Replaces target week slots
          </span>
        </div>
      </div>
    </div>
  );
};
