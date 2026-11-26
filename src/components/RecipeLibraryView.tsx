import React, { useMemo, useState } from 'react';
import {
  Heart,
  Plus,
  Clock,
  SlidersHorizontal,
} from 'lucide-react';
import {
  DietaryTag,
  DifficultyLevel,
  MealSlotType,
  Recipe,
} from '../types/mealPlanner';
import { MEAL_SLOT_LABELS } from '../utils/groceryUtils';
import { RecipeImage } from './RecipeImage';
import { SoapBubbleSearch } from '../../components/soap-bubble';
import { BubbleButton, BubbleIconButton } from './BubbleControls';

interface RecipeLibraryViewProps {
  recipes: Recipe[];
  favoriteIds: Set<string>;
  onToggleFavorite: (id: string) => void;
  onSelectRecipe: (recipe: Recipe) => void;
  onOpenCustomModal: () => void;
}

const DIETARY_FILTERS: Array<'All' | DietaryTag> = [
  'All',
  'High Protein',
  'Low Carb',
  'Vegetarian',
  'Gluten-Free',
  'Dairy-Free',
  'Budget',
  'Quick',
  'Batch Friendly',
];

export const RecipeLibraryView: React.FC<RecipeLibraryViewProps> = ({
  recipes,
  favoriteIds,
  onToggleFavorite,
  onSelectRecipe,
  onOpenCustomModal,
}) => {
  const [query, setQuery] = useState('');
  const [slotTab, setSlotTab] = useState<'all' | 'favorites' | MealSlotType>('all');
  const [dietFilter, setDietFilter] = useState<'All' | DietaryTag>('All');
  const [timeFilter, setTimeFilter] = useState<'all' | '20' | '35'>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | DifficultyLevel>('All');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return recipes.filter((r) => {
      if (slotTab === 'favorites' && !favoriteIds.has(r.id)) return false;
      if (
        slotTab !== 'all' &&
        slotTab !== 'favorites' &&
        !r.mealTypes.includes(slotTab)
      ) {
        return false;
      }
      if (dietFilter !== 'All' && !r.dietaryTags.includes(dietFilter)) return false;
      const totalTime = r.prepTimeMinutes + r.cookTimeMinutes;
      if (timeFilter === '20' && totalTime > 20) return false;
      if (timeFilter === '35' && totalTime > 35) return false;
      if (difficultyFilter !== 'All' && r.difficulty !== difficultyFilter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q) ||
        r.ingredients.some((i) => i.name.toLowerCase().includes(q))
      );
    });
  }, [recipes, favoriteIds, slotTab, dietFilter, timeFilter, difficultyFilter, query]);

  const favoriteRecipes = useMemo(
    () => recipes.filter((r) => favoriteIds.has(r.id)),
    [recipes, favoriteIds]
  );

  return (
    <div className="space-y-6">
      {/* Search & Primary Filter Bar */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 max-w-md text-xs">
            <SoapBubbleSearch
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes, ingredients, or flavors..."
              aria-label="Search recipes"
              style={{ height: 38 }}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All' },
                  { id: 'favorites', label: `Favorites (${favoriteIds.size})` },
                  { id: 'breakfast', label: 'Breakfast' },
                  { id: 'lunch', label: 'Lunch' },
                  { id: 'dinner', label: 'Dinner' },
                  { id: 'snacks', label: 'Snacks' },
                ] as const
              ).map((tab) => (
                <BubbleButton
                  key={tab.id}
                  variant={slotTab === tab.id ? 'dark' : 'default'}
                  size="sm"
                  onClick={() => setSlotTab(tab.id)}
                >
                  {tab.label}
                </BubbleButton>
              ))}
            </div>

            <BubbleButton
              variant="primary"
              size="md"
              onClick={onOpenCustomModal}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Quick-Add Meal</span>
            </BubbleButton>
          </div>
        </div>

        {/* Dietary, Cook Time & Difficulty Filters */}
        <div className="pt-3 border-t border-[#E5E7EB] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6B7280] mr-1 shrink-0" />
            {DIETARY_FILTERS.map((tag) => (
              <BubbleButton
                key={tag}
                variant={dietFilter === tag ? 'dark' : 'default'}
                size="xs"
                onClick={() => setDietFilter(tag)}
              >
                {tag}
              </BubbleButton>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0 text-xs">
            <select
              aria-label="Filter by cooking time"
              value={timeFilter}
              onChange={(e) => setTimeFilter(e.target.value as 'all' | '20' | '35')}
              className="px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg bg-white text-[#374151]"
            >
              <option value="all">Any Cook Time</option>
              <option value="20">20 min or less</option>
              <option value="35">35 min or less</option>
            </select>

            <select
              aria-label="Filter by difficulty"
              value={difficultyFilter}
              onChange={(e) =>
                setDifficultyFilter(e.target.value as 'All' | DifficultyLevel)
              }
              className="px-2.5 py-1.5 border border-[#E5E7EB] rounded-lg bg-white text-[#374151]"
            >
              <option value="All">All Difficulties</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Chef">Chef</option>
            </select>
          </div>
        </div>
      </div>

      {/* Favorite Meals Section (when viewing All and favorites exist) */}
      {slotTab === 'all' && dietFilter === 'All' && !query && favoriteRecipes.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#111827]">Favorite Meals</h2>
            <button
              type="button"
              onClick={() => setSlotTab('favorites')}
              className="text-xs font-medium text-[#15803D] hover:underline"
            >
              View all {favoriteRecipes.length}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {favoriteRecipes.slice(0, 4).map((recipe) => (
              <div
                key={`fav-${recipe.id}`}
                className="bg-white border border-[#E5E7EB] rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-[#D1D5DB] transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectRecipe(recipe)}
                  className="min-w-0 text-left flex-1"
                >
                  <div className="text-sm font-medium text-[#111827] truncate">
                    {recipe.title}
                  </div>
                  <div className="text-xs text-[#6B7280] mt-0.5 font-mono tabular-nums">
                    {recipe.macrosPerServing.calories} kcal · {recipe.macrosPerServing.protein}g P ·{' '}
                    {recipe.prepTimeMinutes + recipe.cookTimeMinutes}m
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(recipe.id)}
                  aria-label="Remove from favorites"
                  className="p-1.5 text-[#DC2626] hover:bg-[#FEF2F2] rounded-md shrink-0"
                >
                  <Heart className="w-4 h-4 fill-[#DC2626]" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recipe Grid */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center space-y-3">
          <p className="text-sm text-[#4B5563]">
            No recipes match your active search or dietary filters.
          </p>
          <BubbleButton
            variant="default"
            size="sm"
            onClick={() => {
              setQuery('');
              setSlotTab('all');
              setDietFilter('All');
              setTimeFilter('all');
              setDifficultyFilter('All');
            }}
          >
            Reset Filters
          </BubbleButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((recipe) => {
            const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
            const isFav = favoriteIds.has(recipe.id);

            return (
              <article
                key={recipe.id}
                className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#D1D5DB] transition-colors"
              >
                <div>
                  <div className="relative h-44 bg-[#F3F4F6] overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onSelectRecipe(recipe)}
                      className="w-full h-full block text-left"
                    >
                      <RecipeImage
                        src={recipe.imageUrl}
                        alt={recipe.title}
                        mealTypes={recipe.mealTypes}
                        className="w-full h-full"
                      />
                    </button>
                    <BubbleIconButton
                      variant="default"
                      iconSize="md"
                      onClick={() => onToggleFavorite(recipe.id)}
                      aria-label={isFav ? 'Remove favorite' : 'Add favorite'}
                      className="!absolute top-3 right-3"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          isFav ? 'fill-[#DC2626] text-[#DC2626]' : 'text-[#4B5563]'
                        }`}
                      />
                    </BubbleIconButton>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="text-xs text-[#6B7280] flex items-center gap-1.5">
                      <span>{recipe.mealTypes.map((m) => MEAL_SLOT_LABELS[m]).join(' / ')}</span>
                      <span aria-hidden="true">·</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {totalMins}m
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{recipe.difficulty}</span>
                      {recipe.isCustom && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-[#15803D] font-medium">Custom</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectRecipe(recipe)}
                      className="text-left block w-full"
                    >
                      <h3 className="font-display text-base font-semibold text-[#111827] hover:text-[#15803D] transition-colors leading-snug">
                        {recipe.title}
                      </h3>
                    </button>

                    <p className="text-xs text-[#6B7280] line-clamp-2 leading-relaxed">
                      {recipe.subtitle}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between gap-3">
                  <div className="text-xs font-mono tabular-nums text-[#374151]">
                    <span className="font-semibold text-[#111827]">
                      {recipe.macrosPerServing.calories}
                    </span>{' '}
                    kcal ·{' '}
                    <span className="text-[#15803D] font-medium">
                      {recipe.macrosPerServing.protein}g P
                    </span>
                  </div>

                  <BubbleButton
                    variant="default"
                    size="sm"
                    onClick={() => onSelectRecipe(recipe)}
                  >
                    Open Recipe
                  </BubbleButton>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
