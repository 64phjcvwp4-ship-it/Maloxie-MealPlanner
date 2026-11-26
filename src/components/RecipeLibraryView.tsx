import React, { useMemo, useState } from 'react';
import {
  Heart,
  Plus,
  Clock,
  SlidersHorizontal,
  LayoutGrid,
  Columns3,
} from 'lucide-react';
import {
  DietaryTag,
  DifficultyLevel,
  MealSlotType,
  Recipe,
} from '../types/mealPlanner';
import { MEAL_SLOT_LABELS } from '../utils/groceryUtils';
import { getRecipeCarouselSrc } from '../utils/recipeCardDataUri';
import { RecipeImage } from './RecipeImage';
import { SoapBubbleSearch } from '../../components/soap-bubble';
import { BubbleButton, BubbleIconButton } from './BubbleControls';
import AnimatedContent from '../../components/AnimatedContent';
import FlexCarousel from '../../components/FlexCarousel';
import Masonry, { type MasonryItem } from '../../components/Masonry';

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
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [browseLayout, setBrowseLayout] = useState<'masonry' | 'grid'>('masonry');

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

  React.useEffect(() => {
    setCarouselIndex(0);
  }, [query, slotTab, dietFilter, timeFilter, difficultyFilter, recipes.length]);

  const carouselItems = useMemo(
    () =>
      filtered.map((r) => ({
        src: getRecipeCarouselSrc(r),
        alt: r.title,
        title: r.title,
        subtitle: `${r.macrosPerServing.calories} kcal · ${r.macrosPerServing.protein}g P · ${
          r.prepTimeMinutes + r.cookTimeMinutes
        } min`,
      })),
    [filtered]
  );

  const activeCarouselRecipe = filtered[carouselIndex] || filtered[0] || null;

  const masonryItems: MasonryItem[] = useMemo(() => {
    const heights = [480, 620, 520, 660, 460, 580];
    return filtered.map((r, idx) => ({
      id: r.id,
      img: getRecipeCarouselSrc(r),
      alt: r.title,
      title: r.title,
      description: `${r.macrosPerServing.calories} kcal · ${r.macrosPerServing.protein}g P · ${
        r.prepTimeMinutes + r.cookTimeMinutes
      } min`,
      width: 640,
      height: heights[idx % heights.length],
      span: idx === 0 && r.imageUrl ? 2 : 1,
    }));
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Search & Primary Filter Bar */}
      <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-4 space-y-4 shadow-sm">
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
            <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0]/75 rounded-full overflow-x-auto">
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
        <div className="pt-3 border-t border-[#D9D0CB] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#6A6754] mr-1 shrink-0" />
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
              className="px-2.5 py-1.5 border border-[#D9D0CB] rounded-lg bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
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
              className="px-2.5 py-1.5 border border-[#D9D0CB] rounded-lg bg-[#FAF8F6] text-[#2E2D24] focus:outline-none focus:ring-2 focus:ring-[#6A6754]"
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
            <h2 className="text-sm font-semibold text-[#FAF8F6] drop-shadow-[0_1px_6px_rgba(46,45,36,0.5)]">Favorite Meals</h2>
            <button
              type="button"
              onClick={() => setSlotTab('favorites')}
              className="text-xs font-medium text-[#E5DFDA] hover:text-[#FAF8F6] hover:underline"
            >
              View all {favoriteRecipes.length}
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {favoriteRecipes.slice(0, 4).map((recipe) => (
              <div
                key={`fav-${recipe.id}`}
                className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-3.5 flex items-center justify-between gap-3 hover:border-[#908B6F] transition-colors shadow-sm"
              >
                <button
                  type="button"
                  onClick={() => onSelectRecipe(recipe)}
                  className="min-w-0 text-left flex-1"
                >
                  <div className="text-sm font-medium text-[#2E2D24] truncate">
                    {recipe.title}
                  </div>
                  <div className="text-xs text-[#6A6754] mt-0.5 font-mono tabular-nums">
                    {recipe.macrosPerServing.calories} kcal · {recipe.macrosPerServing.protein}g P ·{' '}
                    {recipe.prepTimeMinutes + recipe.cookTimeMinutes}m
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(recipe.id)}
                  aria-label="Remove from favorites"
                  className="p-1.5 text-[#B43C2E] hover:bg-[#FBEAE7] rounded-full shrink-0"
                >
                  <Heart className="w-4 h-4 fill-[#B43C2E]" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Recipe Grid */}
      {filtered.length === 0 ? (
        <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-12 text-center space-y-3 shadow-sm">
          <p className="text-sm text-[#4A483A]">
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
        <>
          {/* Liquid FlexCarousel Showcase */}
          <section className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl overflow-hidden shadow-sm">
            <div className="px-5 py-3.5 border-b border-[#D9D0CB]/80 bg-[#F3EFEC]/70 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#2E2D24]">
                  Recipe Showcase ({filtered.length})
                </h2>
                <p className="text-xs text-[#6A6754]">
                  Drag, scroll, or click a card to zoom into focus
                </p>
              </div>
              {activeCarouselRecipe && (
                <div className="flex items-center gap-2">
                  <BubbleIconButton
                    variant="default"
                    iconSize="sm"
                    onClick={() => onToggleFavorite(activeCarouselRecipe.id)}
                    aria-label={
                      favoriteIds.has(activeCarouselRecipe.id)
                        ? 'Remove active recipe from favorites'
                        : 'Save active recipe to favorites'
                    }
                  >
                    <Heart
                      className={`w-3.5 h-3.5 ${
                        favoriteIds.has(activeCarouselRecipe.id)
                          ? 'fill-[#B43C2E] text-[#B43C2E]'
                          : 'text-[#4A483A]'
                      }`}
                    />
                  </BubbleIconButton>
                  <BubbleButton
                    variant="primary"
                    size="sm"
                    onClick={() => onSelectRecipe(activeCarouselRecipe)}
                  >
                    Open Full Recipe
                  </BubbleButton>
                </div>
              )}
            </div>

            <div
              style={{ width: '100%', height: '560px', position: 'relative' }}
              className="bg-gradient-to-b from-[#FAF8F6]/55 via-[#F4F1EE]/45 to-[#EAE4E0]/60 text-[#2E2D24]"
            >
              <FlexCarousel
                items={carouselItems}
                preset="liquid"
                intro="rise"
                cardHeight={0.5}
                gap={12}
                squeeze={0.2}
                focusOnClick
                captions
                fit="natural"
                radius={0}
                lensWidth={0.74}
                lensHeight={1.18}
                tilt={62}
                roundness={1}
                bend={0.34}
                reach={0.38}
                curl="twist"
                dispersion={0.45}
                liquid={0}
                followCursor={false}
                autoplay={false}
                interval={4}
                captureWheel
                onChange={(idx) => setCarouselIndex(idx)}
              />
            </div>

            {activeCarouselRecipe && (
              <div className="px-5 py-3 border-t border-[#D9D0CB]/80 bg-[#F3EFEC]/70 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2 text-[#4A483A] min-w-0">
                  <span className="font-semibold text-[#2E2D24]">
                    {activeCarouselRecipe.title}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeCarouselRecipe.dietaryTags.slice(0, 3).join(' · ')}</span>
                </div>
                <div className="font-mono tabular-nums text-[#4A483A] shrink-0">
                  {activeCarouselRecipe.macrosPerServing.calories} kcal ·{' '}
                  <span className="text-[#6A6754] font-semibold">
                    {activeCarouselRecipe.macrosPerServing.protein}g P
                  </span>{' '}
                  · {activeCarouselRecipe.macrosPerServing.carbs}g C ·{' '}
                  {activeCarouselRecipe.macrosPerServing.fat}g F
                </div>
              </div>
            )}
          </section>

          {/* Browse All Recipes: Masonry Board or Card Grid */}
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-[#FAF8F6] drop-shadow-[0_1px_6px_rgba(46,45,36,0.5)]">
                  Recipe Collection ({filtered.length})
                </h2>
                <p className="text-xs text-[#E5DFDA]">
                  {browseLayout === 'masonry'
                    ? 'Drag tiles to arrange your board or click any dish for full instructions'
                    : 'Compare cooking times, macros, and dietary tags side by side'}
                </p>
              </div>
              <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0]/85 rounded-full">
                <BubbleButton
                  variant={browseLayout === 'masonry' ? 'dark' : 'default'}
                  size="sm"
                  onClick={() => setBrowseLayout('masonry')}
                >
                  <Columns3 className="w-3.5 h-3.5" />
                  <span>Masonry Board</span>
                </BubbleButton>
                <BubbleButton
                  variant={browseLayout === 'grid' ? 'dark' : 'default'}
                  size="sm"
                  onClick={() => setBrowseLayout('grid')}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>Card Grid</span>
                </BubbleButton>
              </div>
            </div>

            {browseLayout === 'masonry' ? (
              <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl p-4 sm:p-5 shadow-sm">
                <Masonry
                  items={masonryItems}
                  columns="auto"
                  columnWidth={240}
                  gap={14}
                  radius={12}
                  animateFrom="bottom"
                  stagger={0.03}
                  blurToFocus={false}
                  hoverEffect="zoom"
                  focusOnHover
                  captions="always"
                  draggable
                  lightbox={false}
                  onItemClick={(item) => {
                    const match = filtered.find((r) => r.id === String(item.id));
                    if (match) onSelectRecipe(match);
                  }}
                />
              </div>
            ) : (
              <AnimatedContent
                distance={20}
                direction="vertical"
                duration={0.35}
                ease="power3.out"
                blur={0}
                stagger={0.025}
                trigger="mount"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
              >
          {filtered.map((recipe) => {
            const totalMins = recipe.prepTimeMinutes + recipe.cookTimeMinutes;
            const isFav = favoriteIds.has(recipe.id);

            return (
              <article
                key={recipe.id}
                className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-xl overflow-hidden flex flex-col justify-between hover:border-[#908B6F] transition-colors shadow-sm"
              >
                <div>
                  <div className="relative h-44 bg-[#EAE4E0] overflow-hidden">
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
                          isFav ? 'fill-[#B43C2E] text-[#B43C2E]' : 'text-[#4A483A]'
                        }`}
                      />
                    </BubbleIconButton>
                  </div>

                  <div className="p-4 space-y-2">
                    <div className="text-xs text-[#6A6754] flex items-center gap-1.5">
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
                          <span className="text-[#6A6754] font-semibold">Custom</span>
                        </>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onSelectRecipe(recipe)}
                      className="text-left block w-full"
                    >
                      <h3 className="font-display text-base font-semibold text-[#2E2D24] hover:text-[#6A6754] transition-colors leading-snug">
                        {recipe.title}
                      </h3>
                    </button>

                    <p className="text-xs text-[#6A6754] line-clamp-2 leading-relaxed">
                      {recipe.subtitle}
                    </p>
                  </div>
                </div>

                <div className="px-4 py-3 border-t border-[#D9D0CB]/80 bg-[#F3EFEC]/70 flex items-center justify-between gap-3">
                  <div className="text-xs font-mono tabular-nums text-[#4A483A]">
                    <span className="font-semibold text-[#2E2D24]">
                      {recipe.macrosPerServing.calories}
                    </span>{' '}
                    kcal ·{' '}
                    <span className="text-[#6A6754] font-semibold">
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
              </AnimatedContent>
            )}
          </section>
        </>
      )}
    </div>
  );
};
