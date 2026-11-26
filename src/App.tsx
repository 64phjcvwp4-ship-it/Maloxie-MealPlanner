import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Sparkles,
  Check,
  CalendarDays,
  BookOpen,
  ShoppingBasket,
  Activity,
  ChefHat,
} from 'lucide-react';
import {
  ActiveTab,
  DayPlan,
  ManualGroceryItem,
  MealSlotType,
  MealTemplate,
  NutritionTargets,
  Recipe,
} from './types/mealPlanner';
import { INITIAL_RECIPES } from './data/recipes';
import { instantiateTemplateForWeek, MEAL_TEMPLATES } from './data/templates';
import {
  formatWeekRangeLabel,
  getMondayOfCurrentWeek,
  getWeekDates,
} from './utils/dateUtils';
import { computeDayMacros, generateGroceryList } from './utils/groceryUtils';
import { GlassSlabLogo } from '../components/glass-slab-logo';
import MoltenMetal from '../components/MoltenMetal';
import AnimatedContent from '../components/AnimatedContent';
import Crosshair from '../components/Crosshair';
import { SoapBubbleMaterial } from '../components/soap-bubble';
import { BubbleButton } from './components/BubbleControls';
import { MaloxieMark } from './components/MaloxieMark';
import { CalendarView } from './components/CalendarView';
import { RecipeLibraryView } from './components/RecipeLibraryView';
import { GroceryListView } from './components/GroceryListView';
import { NutritionView } from './components/NutritionView';
import { PrepGuideView } from './components/PrepGuideView';
import {
  ApplyTemplateModal,
  AssignMealModal,
  CustomRecipeModal,
  RecipeDetailModal,
} from './components/Modals';

const STORAGE_KEY = 'mise-meal-planner-v1';
const MALOXIE_LOGO = '/assets/aistudio/IMG_4277_e1118095.jpeg';

interface PersistedState {
  planningHorizonWeeks: number;
  daysMap: Record<string, DayPlan>;
  customRecipes: Recipe[];
  customTemplates: MealTemplate[];
  favoriteIds: string[];
  targets: NutritionTargets;
  householdMultiplier: number;
  checkedKeys: string[];
  alreadyHaveKeys: string[];
  clearedKeys: string[];
  manualItems: ManualGroceryItem[];
  completedPrepTaskIds: string[];
}

function buildInitialDaysMap(startMonday: Date): Record<string, DayPlan> {
  const week1 = getWeekDates(startMonday, 0);
  const week2 = getWeekDates(startMonday, 1);
  let map: Record<string, DayPlan> = {};
  map = instantiateTemplateForWeek(MEAL_TEMPLATES[0], week1, map);
  map = instantiateTemplateForWeek(MEAL_TEMPLATES[1], week2, map);
  return map;
}

const WORKSPACE_TABS: Array<{
  id: ActiveTab;
  label: string;
  navLabel: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'calendar', label: 'Meal Calendar', navLabel: 'Calendar', icon: CalendarDays },
  { id: 'recipes', label: 'Recipe Library', navLabel: 'Recipes', icon: BookOpen },
  { id: 'grocery', label: 'Grocery List', navLabel: 'Grocery List', icon: ShoppingBasket },
  { id: 'nutrition', label: 'Nutrition & Targets', navLabel: 'Nutrition', icon: Activity },
  { id: 'prep', label: 'Prep & Kitchen Guide', navLabel: 'Prep Guide', icon: ChefHat },
];

export default function App() {
  const startMonday = useMemo(() => getMondayOfCurrentWeek(new Date()), []);
  const pageRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const loadInitialState = (): PersistedState => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        if (parsed && parsed.daysMap && parsed.targets) {
          return {
            planningHorizonWeeks: parsed.planningHorizonWeeks || 2,
            daysMap: parsed.daysMap,
            customRecipes: parsed.customRecipes || [],
            customTemplates: parsed.customTemplates || [],
            favoriteIds: parsed.favoriteIds || [
              'miso-salmon-bowl',
              'herb-lemon-chicken-skillet',
              'berry-almond-overnight-oats',
              'coconut-lentil-dal',
            ],
            targets: parsed.targets,
            householdMultiplier: parsed.householdMultiplier || 1,
            checkedKeys: parsed.checkedKeys || [],
            alreadyHaveKeys: parsed.alreadyHaveKeys || [],
            clearedKeys: parsed.clearedKeys || [],
            manualItems: parsed.manualItems || [],
            completedPrepTaskIds: parsed.completedPrepTaskIds || [],
          };
        }
      }
    } catch {
      // Fallback to seeded state
    }

    return {
      planningHorizonWeeks: 2,
      daysMap: buildInitialDaysMap(startMonday),
      customRecipes: [],
      customTemplates: [],
      favoriteIds: [
        'miso-salmon-bowl',
        'herb-lemon-chicken-skillet',
        'berry-almond-overnight-oats',
        'coconut-lentil-dal',
      ],
      targets: {
        calories: 2000,
        protein: 150,
        carbs: 200,
        fat: 65,
        weeklyBudget: 120,
      },
      householdMultiplier: 1,
      checkedKeys: [],
      alreadyHaveKeys: [],
      clearedKeys: [],
      manualItems: [],
      completedPrepTaskIds: [],
    };
  };

  const [initial] = useState<PersistedState>(loadInitialState);

  const [activeTab, setActiveTab] = useState<ActiveTab>('calendar');
  const [planningHorizonWeeks, setPlanningHorizonWeeks] = useState<number>(
    initial.planningHorizonWeeks
  );
  const [activeWeekIndex, setActiveWeekIndex] = useState<number>(0);
  const [daysMap, setDaysMap] = useState<Record<string, DayPlan>>(initial.daysMap);
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(initial.customRecipes);
  const [customTemplates, setCustomTemplates] = useState<MealTemplate[]>(
    initial.customTemplates
  );
  const [favoriteIdsArr, setFavoriteIdsArr] = useState<string[]>(initial.favoriteIds);
  const [targets, setTargets] = useState<NutritionTargets>(initial.targets);
  const [householdMultiplier, setHouseholdMultiplier] = useState<number>(
    initial.householdMultiplier
  );
  const [checkedKeysArr, setCheckedKeysArr] = useState<string[]>(initial.checkedKeys);
  const [alreadyHaveKeysArr, setAlreadyHaveKeysArr] = useState<string[]>(
    initial.alreadyHaveKeys
  );
  const [clearedKeysArr, setClearedKeysArr] = useState<string[]>(initial.clearedKeys);
  const [manualItems, setManualItems] = useState<ManualGroceryItem[]>(
    initial.manualItems
  );
  const [completedPrepIdsArr, setCompletedPrepIdsArr] = useState<string[]>(
    initial.completedPrepTaskIds
  );

  // Modals & transient state
  const [assignModalTarget, setAssignModalTarget] = useState<{
    date: string;
    slot: MealSlotType;
  } | null>(null);
  const [detailRecipe, setDetailRecipe] = useState<Recipe | null>(null);
  const [customMealOpen, setCustomMealOpen] = useState(false);
  const [templatesModalOpen, setTemplatesModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    try {
      const payload: PersistedState = {
        planningHorizonWeeks,
        daysMap,
        customRecipes,
        customTemplates,
        favoriteIds: favoriteIdsArr,
        targets,
        householdMultiplier,
        checkedKeys: checkedKeysArr,
        alreadyHaveKeys: alreadyHaveKeysArr,
        clearedKeys: clearedKeysArr,
        manualItems,
        completedPrepTaskIds: completedPrepIdsArr,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore storage quota errors
    }
  }, [
    planningHorizonWeeks,
    daysMap,
    customRecipes,
    customTemplates,
    favoriteIdsArr,
    targets,
    householdMultiplier,
    checkedKeysArr,
    alreadyHaveKeysArr,
    clearedKeysArr,
    manualItems,
    completedPrepIdsArr,
  ]);

  const recipes = useMemo(
    () => [...customRecipes, ...INITIAL_RECIPES],
    [customRecipes]
  );

  const recipesMap = useMemo(() => {
    const map: Record<string, Recipe> = {};
    for (const r of recipes) map[r.id] = r;
    return map;
  }, [recipes]);

  const allTemplates = useMemo(
    () => [...customTemplates, ...MEAL_TEMPLATES],
    [customTemplates]
  );

  const favoriteIds = useMemo(() => new Set(favoriteIdsArr), [favoriteIdsArr]);
  const checkedKeys = useMemo(() => new Set(checkedKeysArr), [checkedKeysArr]);
  const alreadyHaveKeys = useMemo(
    () => new Set(alreadyHaveKeysArr),
    [alreadyHaveKeysArr]
  );
  const clearedKeys = useMemo(() => new Set(clearedKeysArr), [clearedKeysArr]);
  const completedPrepTaskIds = useMemo(
    () => new Set(completedPrepIdsArr),
    [completedPrepIdsArr]
  );

  const weeksDates = useMemo(() => {
    return Array.from({ length: planningHorizonWeeks }, (_, idx) =>
      getWeekDates(startMonday, idx)
    );
  }, [startMonday, planningHorizonWeeks]);

  useEffect(() => {
    if (activeWeekIndex >= weeksDates.length) {
      setActiveWeekIndex(Math.max(0, weeksDates.length - 1));
    }
  }, [weeksDates.length, activeWeekIndex]);

  const activeWeekDates = weeksDates[activeWeekIndex] || weeksDates[0] || [];

  const activeWeekSummary = useMemo(() => {
    let plannedMeals = 0;
    let totalCals = 0;
    let activeDays = 0;
    for (const date of activeWeekDates) {
      const day = daysMap[date];
      if (!day) continue;
      const count =
        day.slots.breakfast.length +
        day.slots.lunch.length +
        day.slots.dinner.length +
        day.slots.snacks.length;
      plannedMeals += count;
      const macros = computeDayMacros(day, recipesMap);
      if (macros.calories > 0) {
        totalCals += macros.calories;
        activeDays += 1;
      }
    }
    const grocery = generateGroceryList(
      activeWeekDates,
      daysMap,
      recipesMap,
      householdMultiplier,
      manualItems
    ).filter((i) => !clearedKeys.has(i.key) && !alreadyHaveKeys.has(i.key));

    const estCost = grocery.reduce((s, i) => s + i.estimatedPrice, 0);
    const uncheckedCount = grocery.filter((i) => !checkedKeys.has(i.key)).length;

    return {
      plannedMeals,
      avgDailyCalories: activeDays > 0 ? Math.round(totalCals / activeDays) : 0,
      estCost,
      uncheckedCount,
    };
  }, [
    activeWeekDates,
    daysMap,
    recipesMap,
    householdMultiplier,
    manualItems,
    clearedKeys,
    alreadyHaveKeys,
    checkedKeys,
  ]);

  /* ---------------------------- Mutation Handlers --------------------------- */

  const ensureDay = (map: Record<string, DayPlan>, date: string): DayPlan => {
    return (
      map[date] || {
        date,
        slots: { breakfast: [], lunch: [], dinner: [], snacks: [] },
        note: '',
      }
    );
  };

  const handleAssignMeal = (
    date: string,
    slot: MealSlotType,
    recipeId: string,
    servings: number,
    isLeftover = false,
    leftoverFromDate?: string
  ) => {
    setDaysMap((prev) => {
      const day = ensureDay(prev, date);
      const entry = {
        instanceId: `${date}-${slot}-${Math.random().toString(36).slice(2, 9)}`,
        recipeId,
        servings,
        isLeftover,
        leftoverFromDate,
      };
      return {
        ...prev,
        [date]: {
          ...day,
          slots: {
            ...day.slots,
            [slot]: [...day.slots[slot], entry],
          },
        },
      };
    });
    if (isLeftover) {
      showToast('Leftover scheduled for next day');
    }
  };

  const handleMoveMeal = (
    fromDate: string,
    fromSlot: MealSlotType,
    instanceId: string,
    toDate: string,
    toSlot: MealSlotType
  ) => {
    setDaysMap((prev) => {
      const sourceDay = ensureDay(prev, fromDate);
      const entry = sourceDay.slots[fromSlot].find((e) => e.instanceId === instanceId);
      if (!entry) return prev;

      const updatedFromDay: DayPlan = {
        ...sourceDay,
        slots: {
          ...sourceDay.slots,
          [fromSlot]: sourceDay.slots[fromSlot].filter((e) => e.instanceId !== instanceId),
        },
      };

      const nextMap = { ...prev, [fromDate]: updatedFromDay };
      const targetDay = ensureDay(nextMap, toDate);
      const updatedToDay: DayPlan = {
        ...targetDay,
        slots: {
          ...targetDay.slots,
          [toSlot]: [...targetDay.slots[toSlot], entry],
        },
      };

      return { ...nextMap, [toDate]: updatedToDay };
    });
  };

  const handleRemoveMeal = (date: string, slot: MealSlotType, instanceId: string) => {
    setDaysMap((prev) => {
      const day = ensureDay(prev, date);
      return {
        ...prev,
        [date]: {
          ...day,
          slots: {
            ...day.slots,
            [slot]: day.slots[slot].filter((e) => e.instanceId !== instanceId),
          },
        },
      };
    });
  };

  const handleUpdateServings = (
    date: string,
    slot: MealSlotType,
    instanceId: string,
    delta: number
  ) => {
    setDaysMap((prev) => {
      const day = ensureDay(prev, date);
      return {
        ...prev,
        [date]: {
          ...day,
          slots: {
            ...day.slots,
            [slot]: day.slots[slot].map((e) =>
              e.instanceId === instanceId
                ? { ...e, servings: Math.max(1, Math.min(12, e.servings + delta)) }
                : e
            ),
          },
        },
      };
    });
  };

  const handleToggleLeftover = (date: string, slot: MealSlotType, instanceId: string) => {
    setDaysMap((prev) => {
      const day = ensureDay(prev, date);
      return {
        ...prev,
        [date]: {
          ...day,
          slots: {
            ...day.slots,
            [slot]: day.slots[slot].map((e) =>
              e.instanceId === instanceId ? { ...e, isLeftover: !e.isLeftover } : e
            ),
          },
        },
      };
    });
  };

  const handleUpdateNote = (date: string, note: string) => {
    setDaysMap((prev) => {
      const day = ensureDay(prev, date);
      return {
        ...prev,
        [date]: { ...day, note },
      };
    });
  };

  const handleApplyTemplate = (template: MealTemplate, scope: 'current' | 'all') => {
    setDaysMap((prev) => {
      let next = { ...prev };
      const targetWeeks = scope === 'current' ? [activeWeekDates] : weeksDates;
      for (const week of targetWeeks) {
        next = instantiateTemplateForWeek(template, week, next);
      }
      return next;
    });
    showToast(`Applied "${template.name}" template`);
  };

  const handleSaveCurrentAsTemplate = (name: string) => {
    const days = activeWeekDates.map((date) => {
      const day = daysMap[date];
      const slots: MealTemplate['days'][number]['slots'] = {};
      if (day) {
        (['breakfast', 'lunch', 'dinner', 'snacks'] as MealSlotType[]).forEach((s) => {
          if (day.slots[s].length > 0) {
            slots[s] = day.slots[s].map((e) => ({
              recipeId: e.recipeId,
              servings: e.servings,
              isLeftover: e.isLeftover,
            }));
          }
        });
      }
      return { note: day?.note, slots };
    });

    const newTmpl: MealTemplate = {
      id: `custom-tmpl-${Date.now()}`,
      name,
      tagline: 'Custom saved weekly plan',
      focusTag: 'Batch Friendly',
      estimatedWeeklyCost: Math.round(activeWeekSummary.estCost),
      avgDailyCalories: activeWeekSummary.avgDailyCalories,
      avgDailyProtein: targets.protein,
      days,
    };
    setCustomTemplates((prev) => [newTmpl, ...prev]);
    showToast(`Saved "${name}" to templates`);
  };

  const handleClearWeek = (weekDates: string[]) => {
    setDaysMap((prev) => {
      const next = { ...prev };
      for (const date of weekDates) {
        next[date] = {
          date,
          slots: { breakfast: [], lunch: [], dinner: [], snacks: [] },
          note: '',
        };
      }
      return next;
    });
    showToast('Week cleared');
  };

  const handleToggleFavorite = (recipeId: string) => {
    setFavoriteIdsArr((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  const handleSaveCustomRecipe = (recipe: Recipe) => {
    setCustomRecipes((prev) => [recipe, ...prev]);
    showToast(`Added "${recipe.title}" to library`);
  };

  const handleToggleGroceryChecked = (key: string) => {
    setCheckedKeysArr((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleToggleAlreadyHave = (key: string) => {
    setAlreadyHaveKeysArr((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const handleClearCompletedGroceries = () => {
    setClearedKeysArr((prev) => Array.from(new Set([...prev, ...checkedKeysArr])));
    setCheckedKeysArr([]);
    showToast('Cleared completed grocery items');
  };

  const handleRestoreAllCleared = () => {
    setClearedKeysArr([]);
    showToast('Restored cleared items');
  };

  const handleTogglePrepTask = (id: string) => {
    setCompletedPrepIdsArr((prev) =>
      prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id]
    );
  };

  const handleAssignBatchWithLeftover = (
    cookDate: string,
    slot: MealSlotType,
    recipeId: string,
    leftoverDate: string
  ) => {
    handleAssignMeal(cookDate, slot, recipeId, 1, false);
    handleAssignMeal(leftoverDate, 'lunch', recipeId, 1, true, cookDate);
    showToast('Scheduled batch cook + next-day leftover');
  };

  const navigateAndScroll = (tab: ActiveTab) => {
    setActiveTab(tab);
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const allPlannedDatesFlat = useMemo(() => weeksDates.flat(), [weeksDates]);

  return (
    <div ref={pageRef} data-theme="light" className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#111827]">
      <SoapBubbleMaterial
        backdrop={pageRef}
        iridescence={0.5}
        oilCoverage={0.73}
        oilEdgeFade={2.33}
        clearCenter={0.57}
        windowLength={1.3}
        windowMargin={0.85}
        windowBend={0.75}
        windowSize={0.75}
        windowWidth={0.8}
        windowGradient={0.96}
        windowHead={0.7}
        windowTail={0.6}
        glintSize={1.65}
        glintIntensity={0}
        glintDistance={-0.45}
        glintHeight={0.65}
        windowIntensity={0.85}
        windowTwin={false}
        bottomShadeColor="#ffffff"
      >
      {/* Top Navigation Bar: Transparent Flat Logo (Without Glass Slab) + Maloxie + Nav + Action */}
      <header data-theme="dark" className="h-16 bg-[#0F1117] border-b border-white/10 px-4 sm:px-8 flex items-center justify-between gap-8 sticky top-0 z-40">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-3 font-display text-xl font-bold tracking-tight text-white whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded"
        >
          <MaloxieMark className="h-9 w-auto" />
          <span>Maloxie</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-white/75">
          {WORKSPACE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigateAndScroll(t.id)}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.id ? 'text-white underline underline-offset-8 decoration-[#4ADE80]' : ''
              }`}
            >
              {t.navLabel}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <BubbleButton
            variant="primary"
            size="md"
            onClick={() => setCustomMealOpen(true)}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Quick-Add Meal</span>
          </BubbleButton>
        </div>
      </header>

      {/* Hero Section: MoltenMetal Background + Crosshair + Centered GlassSlabLogo */}
      <section
        id="top"
        ref={heroRef}
        className="relative overflow-hidden bg-[#0F1117] pt-10 pb-14 px-4 sm:px-8"
      >
        <Crosshair
          containerRef={heroRef}
          color="#ffffff"
          targetEffect="lock"
          thickness={1}
          opacity={0.85}
          smoothing={0.35}
          showCoordinates
          lineStyle="solid"
          blendMode="normal"
          gap={0}
          fade={0}
          clickPulse
          hideCursor={false}
        />
        <div className="absolute inset-0 w-full h-full">
          <MoltenMetal
            colors={['#ffffff', '#ffffff']}
            coreColor="#FFFFFF"
            speed={0.35}
            scale={7.6}
            detail={3}
            glow={2.7}
            thickness={1.31}
            haze={0.75}
            mouseInteraction
            flareOnClick
            lightMode
            swirl={1.25}
            turbulence={0.2}
            brightness={1.2}
            colorMode="molten"
            rotation={0}
            offsetX={0}
            offsetY={0}
            grain={0.05}
            opacity={1}
            drift={0.3}
            intro
            mouseStrength={0.5}
            paused={false}
            style={{ width: '100%', height: '100%' }}
          />
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0F1117]/30 via-[#0F1117]/55 to-[#F8F9FA]"
        />

        <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
          <div className="w-full max-w-[300px] sm:max-w-[340px]">
            <GlassSlabLogo
              logo={MALOXIE_LOGO}
              colorPreset="oilDark"
              backgroundColor="transparent"
              style={{ height: 220 }}
              aria-label="Maloxie glass slab logo"
            />
          </div>

          <AnimatedContent
            distance={100}
            direction="vertical"
            duration={0.8}
            ease="power3.out"
            blur={0}
            stagger={0.08}
            threshold={0.1}
            trigger="mount"
            className="w-full flex flex-col items-center"
          >
            <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold tracking-tight text-white leading-[1.12]">
              Plan meals that{' '}
              <span className="text-[#86EFAC]">actually stick</span>
            </h1>

            <p className="mt-3.5 text-sm sm:text-base text-white/80 max-w-xl leading-relaxed">
              Maloxie turns weekly meal planning into a calm daily ritual. Schedule
              multi-week menus, auto-build smart grocery lists, and track macros in
              one place.
            </p>

            {/* Compact Weekly Snapshot Strip */}
            <div className="mt-8 w-full max-w-2xl grid grid-cols-3 gap-4 px-5 py-4 rounded-2xl bg-white/85 backdrop-blur-md border border-[#E5E7EB]">
              <button
                type="button"
                onClick={() => navigateAndScroll('calendar')}
                className="text-center rounded-xl py-1 hover:bg-black/5 transition-colors"
              >
                <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#111827]">
                  {activeWeekSummary.plannedMeals}
                </div>
                <div className="text-xs text-[#6B7280]">meals planned</div>
              </button>
              <button
                type="button"
                onClick={() => navigateAndScroll('nutrition')}
                className="text-center border-x border-[#E5E7EB] py-1 hover:bg-black/5 transition-colors"
              >
                <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#111827]">
                  {activeWeekSummary.avgDailyCalories.toLocaleString()}
                </div>
                <div className="text-xs text-[#6B7280]">avg kcal / day</div>
              </button>
              <button
                type="button"
                onClick={() => navigateAndScroll('grocery')}
                className="text-center rounded-xl py-1 hover:bg-black/5 transition-colors"
              >
                <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#15803D]">
                  ${activeWeekSummary.estCost.toFixed(0)} / ${targets.weeklyBudget}
                </div>
                <div className="text-xs text-[#6B7280]">weekly budget</div>
              </button>
            </div>
          </AnimatedContent>
        </div>
      </section>

      {/* Main Meal Planner Workspace */}
      <div
        ref={workspaceRef}
        className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 pb-12 space-y-5"
      >
        {/* Workspace Navigation Tabs & Contextual Summary */}
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1 bg-[#F3F4F6] rounded-full overflow-x-auto">
            {WORKSPACE_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <BubbleButton
                  key={tab.id}
                  variant={isActive ? 'dark' : 'default'}
                  size="sm"
                  onClick={() => setActiveTab(tab.id)}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive ? 'text-[#86EFAC]' : 'text-[#6B7280]'
                    }`}
                  />
                  <span>{tab.label}</span>
                  {tab.id === 'grocery' && activeWeekSummary.uncheckedCount > 0 && (
                    <span className="font-mono text-[11px] tabular-nums opacity-75">
                      ({activeWeekSummary.uncheckedCount})
                    </span>
                  )}
                </BubbleButton>
              );
            })}
          </div>

          <div className="flex items-center justify-between lg:justify-end gap-3 px-1">
            <span className="text-xs text-[#6B7280] font-mono tabular-nums">
              Week {activeWeekIndex + 1} of {planningHorizonWeeks} ·{' '}
              {formatWeekRangeLabel(activeWeekDates)}
            </span>
            {activeTab === 'calendar' && (
              <BubbleButton
                variant="sage"
                size="sm"
                onClick={() => setTemplatesModalOpen(true)}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Templates</span>
              </BubbleButton>
            )}
          </div>
        </div>

        {/* Active View */}
        <main>
          {activeTab === 'calendar' && (
            <CalendarView
              weeksDates={weeksDates}
              activeWeekIndex={activeWeekIndex}
              onSelectWeek={setActiveWeekIndex}
              planningHorizonWeeks={planningHorizonWeeks}
              onChangeHorizon={setPlanningHorizonWeeks}
              daysMap={daysMap}
              recipes={recipes}
              recipesMap={recipesMap}
              favoriteIds={favoriteIds}
              targets={targets}
              onOpenAssignModal={(date, slot) => setAssignModalTarget({ date, slot })}
              onAssignMeal={handleAssignMeal}
              onMoveMeal={handleMoveMeal}
              onRemoveMeal={handleRemoveMeal}
              onUpdateServings={handleUpdateServings}
              onToggleLeftover={handleToggleLeftover}
              onUpdateNote={handleUpdateNote}
              onOpenRecipeDetail={(recipe) => setDetailRecipe(recipe)}
              onOpenTemplates={() => setTemplatesModalOpen(true)}
              onClearWeek={handleClearWeek}
            />
          )}

          {activeTab === 'recipes' && (
            <RecipeLibraryView
              recipes={recipes}
              favoriteIds={favoriteIds}
              onToggleFavorite={handleToggleFavorite}
              onSelectRecipe={(recipe) => setDetailRecipe(recipe)}
              onOpenCustomModal={() => setCustomMealOpen(true)}
            />
          )}

          {activeTab === 'grocery' && (
            <GroceryListView
              weeksDates={weeksDates}
              activeWeekIndex={activeWeekIndex}
              daysMap={daysMap}
              recipesMap={recipesMap}
              householdMultiplier={householdMultiplier}
              onChangeMultiplier={setHouseholdMultiplier}
              checkedKeys={checkedKeys}
              alreadyHaveKeys={alreadyHaveKeys}
              clearedKeys={clearedKeys}
              manualItems={manualItems}
              weeklyBudget={targets.weeklyBudget}
              onUpdateBudget={(weeklyBudget) =>
                setTargets((prev) => ({ ...prev, weeklyBudget }))
              }
              onToggleChecked={handleToggleGroceryChecked}
              onToggleAlreadyHave={handleToggleAlreadyHave}
              onClearCompleted={handleClearCompletedGroceries}
              onRestoreAllCleared={handleRestoreAllCleared}
              onAddManualItem={(item) => setManualItems((prev) => [item, ...prev])}
              onRemoveManualItem={(id) =>
                setManualItems((prev) => prev.filter((i) => i.id !== id))
              }
            />
          )}

          {activeTab === 'nutrition' && (
            <NutritionView
              weeksDates={weeksDates}
              activeWeekIndex={activeWeekIndex}
              onSelectWeek={setActiveWeekIndex}
              daysMap={daysMap}
              recipesMap={recipesMap}
              targets={targets}
              onUpdateTargets={setTargets}
            />
          )}

          {activeTab === 'prep' && (
            <PrepGuideView
              weeksDates={weeksDates}
              activeWeekIndex={activeWeekIndex}
              onSelectWeek={setActiveWeekIndex}
              daysMap={daysMap}
              recipes={recipes}
              recipesMap={recipesMap}
              householdMultiplier={householdMultiplier}
              weeklyBudget={targets.weeklyBudget}
              completedPrepTaskIds={completedPrepTaskIds}
              onTogglePrepTask={handleTogglePrepTask}
              onAssignBatchWithLeftover={handleAssignBatchWithLeftover}
            />
          )}
        </main>
      </div>

      {/* Modals */}
      <AssignMealModal
        open={Boolean(assignModalTarget)}
        date={assignModalTarget?.date || activeWeekDates[0] || ''}
        slot={assignModalTarget?.slot || 'dinner'}
        recipes={recipes}
        favoriteIds={favoriteIds}
        onClose={() => setAssignModalTarget(null)}
        onAssign={(recipeId, servings, isLeftover) => {
          if (!assignModalTarget) return;
          handleAssignMeal(
            assignModalTarget.date,
            assignModalTarget.slot,
            recipeId,
            servings,
            isLeftover
          );
        }}
      />

      <RecipeDetailModal
        recipe={detailRecipe}
        isFavorite={detailRecipe ? favoriteIds.has(detailRecipe.id) : false}
        onToggleFavorite={handleToggleFavorite}
        onClose={() => setDetailRecipe(null)}
        onAssignToDate={(recipeId, date, slot, servings) => {
          handleAssignMeal(date, slot, recipeId, servings, false);
          showToast('Meal added to calendar');
        }}
        availableDates={allPlannedDatesFlat}
      />

      <CustomRecipeModal
        open={customMealOpen}
        onClose={() => setCustomMealOpen(false)}
        onSaveRecipe={handleSaveCustomRecipe}
      />

      <ApplyTemplateModal
        open={templatesModalOpen}
        templates={allTemplates}
        activeWeekIndex={activeWeekIndex}
        planningHorizonWeeks={planningHorizonWeeks}
        onClose={() => setTemplatesModalOpen(false)}
        onApplyTemplate={handleApplyTemplate}
        onSaveCurrentAsTemplate={handleSaveCurrentAsTemplate}
      />

      {/* Action Feedback Toast */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 px-4 py-2.5 bg-[#111827] text-white text-xs font-medium rounded-lg shadow-lg flex items-center gap-2"
        >
          <Check className="w-3.5 h-3.5 text-[#4ADE80]" />
          <span>{toastMessage}</span>
        </div>
      )}
      </SoapBubbleMaterial>
    </div>
  );
}
