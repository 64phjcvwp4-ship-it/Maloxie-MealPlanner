import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus,
  Sparkles,
  Check,
  CalendarDays,
  BookOpen,
  ShoppingBasket,
  Activity,
  ChefHat,
  Cloud,
  CloudOff,
  LogOut,
  RefreshCw,
} from 'lucide-react';
import { onAuthStateChanged, type User } from 'firebase/auth';
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
import { OpeningIntro } from './components/OpeningIntro';
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

import { MaloxieAiDrawer } from './components/MaloxieAiDrawer';
import type { MaloxieAction } from './utils/maloxieAiEngine';
import {
  auth,
  signInWithGoogle,
  signOutUser,
} from './firebase';
import {
  fetchCloudPlannerState,
  saveCloudPlannerState,
  subscribeToCloudPlannerState,
  upsertUserProfile,
  type PersistedState,
} from './utils/cloudSync';

const STORAGE_KEY = 'mise-meal-planner-v1';
const MALOXIE_LOGO = '/assets/aistudio/IMG_4277_e1118095.jpeg';

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
  const [introStage, setIntroStage] = useState<'visible' | 'scattering' | 'done'>('visible');

  // Cloud account sync state
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const cloudDocExistsRef = useRef(false);
  const cloudInitialSyncDoneRef = useRef(false);
  const suppressNextCloudPushRef = useRef(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
  };

  const applyPersistedState = useCallback((remote: PersistedState) => {
    setPlanningHorizonWeeks(remote.planningHorizonWeeks || 2);
    setDaysMap(remote.daysMap || {});
    setCustomRecipes(remote.customRecipes || []);
    setCustomTemplates(remote.customTemplates || []);
    setFavoriteIdsArr(remote.favoriteIds || []);
    setTargets(remote.targets);
    setHouseholdMultiplier(remote.householdMultiplier || 1);
    setCheckedKeysArr(remote.checkedKeys || []);
    setAlreadyHaveKeysArr(remote.alreadyHaveKeys || []);
    setClearedKeysArr(remote.clearedKeys || []);
    setManualItems(remote.manualItems || []);
    setCompletedPrepIdsArr(remote.completedPrepTaskIds || []);
  }, []);

  const currentPayload: PersistedState = useMemo(
    () => ({
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
    }),
    [
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
    ]
  );

  const latestPayloadRef = useRef<PersistedState>(currentPayload);
  latestPayloadRef.current = currentPayload;

  const handleIntroScatterStart = useCallback(() => {
    setIntroStage((s) => (s === 'visible' ? 'scattering' : s));
  }, []);

  const handleIntroComplete = useCallback(() => {
    setIntroStage('done');
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 2600);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;
    let cancelled = false;

    const unsubscribeAuth = onAuthStateChanged(auth, async (nextUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      setUser(nextUser);
      setAuthReady(true);

      if (!nextUser) {
        cloudDocExistsRef.current = false;
        cloudInitialSyncDoneRef.current = false;
        setSyncStatus('idle');
        return;
      }

      cloudInitialSyncDoneRef.current = false;
      setSyncStatus('syncing');

      try {
        await upsertUserProfile(nextUser);
        if (cancelled) return;

        const remoteState = await fetchCloudPlannerState(nextUser.uid);
        if (cancelled) return;

        if (remoteState) {
          cloudDocExistsRef.current = true;
          suppressNextCloudPushRef.current = true;
          applyPersistedState(remoteState);
        } else {
          await saveCloudPlannerState(nextUser.uid, latestPayloadRef.current, false);
          if (cancelled) return;
          cloudDocExistsRef.current = true;
        }

        cloudInitialSyncDoneRef.current = true;
        setSyncStatus('synced');

        unsubscribeSnapshot = subscribeToCloudPlannerState(
          nextUser.uid,
          (incomingState) => {
            suppressNextCloudPushRef.current = true;
            applyPersistedState(incomingState);
            setSyncStatus('synced');
          },
          () => {
            setSyncStatus('error');
          }
        );
      } catch {
        if (!cancelled) {
          setSyncStatus('error');
          showToast('Cloud sync failed. Changes saved locally.');
        }
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [applyPersistedState]);

  const handleGoogleSignIn = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      const cred = await signInWithGoogle();
      const firstName = cred.user.displayName?.split(' ')[0] || 'account';
      showToast(`Signed in to ${firstName}'s cloud sync`);
    } catch (error) {
      const code = (error as { code?: string })?.code || '';
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        showToast('Sign-in cancelled');
      } else {
        showToast('Could not complete Google sign-in');
      }
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (authBusy) return;
    setAuthBusy(true);
    try {
      await signOutUser();
      showToast('Signed out of cloud sync');
    } catch {
      showToast('Could not sign out');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleManualRetrySync = async () => {
    if (!user) return;
    setSyncStatus('syncing');
    try {
      await saveCloudPlannerState(user.uid, latestPayloadRef.current, cloudDocExistsRef.current);
      cloudDocExistsRef.current = true;
      cloudInitialSyncDoneRef.current = true;
      setSyncStatus('synced');
      showToast('Synced to cloud');
    } catch {
      setSyncStatus('error');
      showToast('Cloud sync failed. Check connection.');
    }
  };

  useEffect(() => {
    const persistLocal = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPayload));
      } catch {
        // Ignore storage quota errors
      }
    };

    const localTimer = window.setTimeout(persistLocal, 350);
    window.addEventListener('beforeunload', persistLocal);

    let cloudTimer: number | undefined;
    if (user && authReady && cloudInitialSyncDoneRef.current) {
      if (suppressNextCloudPushRef.current) {
        suppressNextCloudPushRef.current = false;
      } else {
        setSyncStatus('syncing');
        cloudTimer = window.setTimeout(async () => {
          try {
            await saveCloudPlannerState(
              user.uid,
              currentPayload,
              cloudDocExistsRef.current
            );
            cloudDocExistsRef.current = true;
            setSyncStatus('synced');
          } catch {
            setSyncStatus('error');
          }
        }, 650);
      }
    }

    return () => {
      window.clearTimeout(localTimer);
      if (cloudTimer !== undefined) window.clearTimeout(cloudTimer);
      window.removeEventListener('beforeunload', persistLocal);
    };
  }, [currentPayload, user, authReady]);

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

  const handleApplyAiAction = useCallback(
    (action: MaloxieAction) => {
      if (action.type === 'apply_week_plan') {
        setDaysMap((prev) => {
          const next = { ...prev };
          if (action.scope === 'current') {
            Object.assign(next, action.weekDaysMap);
          } else {
            const sourceEntries = Object.values(action.weekDaysMap);
            weeksDates.forEach((week) => {
              week.forEach((date, idx) => {
                const templateDay = sourceEntries[idx % sourceEntries.length];
                if (!templateDay) return;
                const prevDate = idx > 0 ? week[idx - 1] : undefined;
                next[date] = {
                  date,
                  note: templateDay.note,
                  slots: {
                    breakfast: templateDay.slots.breakfast.map((e) => ({
                      ...e,
                      instanceId: `${date}-breakfast-${Math.random().toString(36).slice(2, 9)}`,
                      leftoverFromDate: e.isLeftover && prevDate ? prevDate : undefined,
                    })),
                    lunch: templateDay.slots.lunch.map((e) => ({
                      ...e,
                      instanceId: `${date}-lunch-${Math.random().toString(36).slice(2, 9)}`,
                      leftoverFromDate: e.isLeftover && prevDate ? prevDate : undefined,
                    })),
                    dinner: templateDay.slots.dinner.map((e) => ({
                      ...e,
                      instanceId: `${date}-dinner-${Math.random().toString(36).slice(2, 9)}`,
                      leftoverFromDate: e.isLeftover && prevDate ? prevDate : undefined,
                    })),
                    snacks: templateDay.slots.snacks.map((e) => ({
                      ...e,
                      instanceId: `${date}-snacks-${Math.random().toString(36).slice(2, 9)}`,
                      leftoverFromDate: e.isLeftover && prevDate ? prevDate : undefined,
                    })),
                  },
                };
              });
            });
          }
          return next;
        });
        if (action.recommendedTargets) {
          setTargets((prev) => ({
            ...prev,
            ...action.recommendedTargets,
          }));
        }
        showToast(
          action.scope === 'all'
            ? `Applied Maloxie AI plan to all ${weeksDates.length} weeks`
            : `Applied Maloxie AI plan to Week ${activeWeekIndex + 1}`
        );
      } else if (action.type === 'fill_empty_slots') {
        setDaysMap((prev) => ({
          ...prev,
          ...action.patchDaysMap,
        }));
        showToast(
          `Added ${action.addedCount} meal${action.addedCount === 1 ? '' : 's'} to Week ${activeWeekIndex + 1}`
        );
      } else if (action.type === 'apply_targets') {
        setTargets(action.targets);
        showToast('Updated nutrition & budget targets');
      }
    },
    [activeWeekIndex, weeksDates]
  );

  const navigateAndScroll = (tab: ActiveTab) => {
    setActiveTab(tab);
    workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const allPlannedDatesFlat = useMemo(() => weeksDates.flat(), [weeksDates]);

  return (
    <div ref={pageRef} data-theme="light" className="relative min-h-screen flex flex-col text-[#2E2D24]">
      {/* Global Full-Viewport MoltenMetal Background Visible Across Entire Site */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#6A6754] transform-gpu">
        <MoltenMetal
          colors={['#D9D0CB', '#908B6F', '#6A6754', '#B86B4B']}
          coreColor="#F4F0ED"
          speed={0.35}
          scale={7.6}
          detail={3}
          glow={2.0}
          thickness={1.31}
          haze={0.75}
          mouseInteraction
          flareOnClick
          lightMode
          swirl={1.25}
          turbulence={0.2}
          brightness={0.85}
          colorMode="molten"
          rotation={0}
          offsetX={0}
          offsetY={0}
          grain={0.015}
          opacity={1}
          drift={0.3}
          intro
          mouseStrength={0.5}
          paused={false}
          dpr={2}
          style={{ width: '100%', height: '100%' }}
        />
        <div
          aria-hidden="true"
          className={`absolute inset-0 bg-gradient-to-b from-[#2E2D24]/52 via-[#4A483A]/40 to-[#2E2D24]/55 transition-opacity duration-700 ease-out ${
            introStage === 'visible' ? 'opacity-0' : 'opacity-100'
          }`}
        />
      </div>

      <SoapBubbleMaterial
        paused
        seeThrough={0}
        maxDpr={1.5}
        iridescence={0.42}
        soapPalette="custom"
        soapPaletteRed="#B86B4B"
        soapPaletteGold="#D69E85"
        soapPaletteGreen="#908B6F"
        soapPaletteCyan="#A8A186"
        soapPaletteBlue="#7C7861"
        soapPaletteViolet="#6A6754"
        soapColor="#908B6F"
        soapShadeColor="#6A6754"
        soapHighlightColor="#FAF8F6"
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
        bottomShadeColor="#D9D0CB"
      >
      <div
        className={`relative z-10 flex flex-col flex-1 transition-opacity duration-700 ease-out ${
          introStage === 'visible' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
      >
      {/* Top Navigation Bar: Transparent Flat Logo (Without Glass Slab) + Maloxie + Nav + Action */}
      <header data-theme="dark" className="h-16 bg-[#3B392D]/90 border-b border-[#D9D0CB]/25 px-4 sm:px-8 flex items-center justify-between gap-8 sticky top-0 z-40">
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          className="inline-flex items-center gap-3 font-display text-xl font-bold tracking-tight text-[#FAF8F6] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D9D0CB]/70 rounded"
        >
          <MaloxieMark className="h-9 w-auto" />
          <span>Maloxie</span>
        </a>

        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[#E5DFDA]">
          {WORKSPACE_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigateAndScroll(t.id)}
              className={`hover:text-[#FAF8F6] transition-colors whitespace-nowrap shrink-0 ${
                activeTab === t.id ? 'text-[#FAF8F6] underline underline-offset-8 decoration-[#B86B4B]' : ''
              }`}
            >
              {t.navLabel}
            </button>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 shrink-0">
          {user ? (
            <div className="flex items-center gap-2 pl-1.5 pr-2 py-1 rounded-full bg-[#2E2D24]/80 border border-[#D9D0CB]/25 text-xs text-[#FAF8F6]">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Account avatar'}
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full object-cover border border-[#D9D0CB]/40"
                />
              ) : (
                <span className="w-6 h-6 rounded-full bg-[#908B6F] text-[#FAF8F6] text-[11px] font-semibold flex items-center justify-center">
                  {(user.displayName || user.email || 'M').slice(0, 1).toUpperCase()}
                </span>
              )}

              <div className="hidden sm:flex flex-col leading-none pr-0.5">
                <span className="font-medium text-[#FAF8F6] max-w-[100px] truncate">
                  {user.displayName?.split(' ')[0] || 'Account'}
                </span>
                {syncStatus === 'error' ? (
                  <button
                    type="button"
                    onClick={handleManualRetrySync}
                    className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[#E4A88E] hover:underline text-left"
                  >
                    <CloudOff className="w-2.5 h-2.5" />
                    <span>Retry sync</span>
                  </button>
                ) : (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[10px] text-[#D9D0CB]">
                    {syncStatus === 'syncing' ? (
                      <>
                        <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <Cloud className="w-2.5 h-2.5 text-[#908B6F]" />
                        <span>Synced</span>
                      </>
                    )}
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleSignOut}
                disabled={authBusy}
                aria-label="Sign out"
                title="Sign out"
                className="p-1 rounded-full text-[#D9D0CB] hover:text-[#FAF8F6] hover:bg-[#FAF8F6]/10 transition-colors disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <BubbleButton
              variant="dark"
              size="md"
              onClick={handleGoogleSignIn}
              disabled={authBusy || !authReady}
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {authBusy ? 'Signing in...' : 'Cloud Sync'}
              </span>
              <span className="sm:hidden">{authBusy ? '...' : 'Sync'}</span>
            </BubbleButton>
          )}

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

      {/* Hero Section: Crosshair + Centered GlassSlabLogo over Global MoltenMetal Background */}
      <section
        id="top"
        ref={heroRef}
        className="relative overflow-hidden pt-10 pb-12 px-4 sm:px-8"
      >
        <Crosshair
          containerRef={heroRef}
          color="#D9D0CB"
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

        <div className="relative z-10 max-w-3xl mx-auto text-center flex flex-col items-center">
          <div className="relative w-full max-w-[340px] sm:max-w-[400px] drop-shadow-[0_18px_36px_rgba(46,45,36,0.48)]">
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-4 inset-y-2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(46,45,36,0.52)_0%,transparent_72%)]"
            />
            {introStage !== 'visible' ? (
              <GlassSlabLogo
                logo={MALOXIE_LOGO}
                colorPreset="oil"
                colors={['#FFFFFF', '#F5EFEA', '#D9D0CB', '#B86B4B', '#908B6F']}
                lightColor="#FFFFFF"
                exposure={1.7}
                ambient={0.42}
                reflectivity={1.9}
                ior={1.68}
                thickness={0.013}
                depth={0.85}
                density={0.85}
                logoScale={0.86}
                backgroundColor="transparent"
                maxDpr={2}
                samples={48}
                style={{ height: 248 }}
                aria-label="Maloxie glass slab logo"
              />
            ) : (
              <div style={{ height: 248 }} aria-hidden="true" />
            )}
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
            <h1 className="mt-4 font-display text-3xl sm:text-5xl font-bold tracking-tight text-[#FAF8F6] leading-[1.12]">
              Plan meals that{' '}
              <span className="text-[#E4A88E]">actually stick</span>
            </h1>

            <p className="mt-3.5 text-sm sm:text-base text-[#F0EAE6] max-w-xl leading-relaxed">
              Maloxie turns weekly meal planning into a calm daily ritual. Schedule
              multi-week menus, auto-build smart grocery lists, and track macros in
              one place.
            </p>

            {/* Compact Weekly Snapshot Strip */}
            <div className="mt-8 w-full max-w-2xl grid grid-cols-3 gap-4 px-5 py-4 rounded-2xl bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 shadow-sm">
              <button
                type="button"
                onClick={() => navigateAndScroll('calendar')}
                className="text-center rounded-xl py-1 hover:bg-[#D9D0CB]/30 transition-colors"
              >
                <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#2E2D24]">
                  {activeWeekSummary.plannedMeals}
                </div>
                <div className="text-xs text-[#6A6754]">meals planned</div>
              </button>
              <button
                type="button"
                onClick={() => navigateAndScroll('nutrition')}
                className="text-center border-x border-[#D9D0CB] py-1 hover:bg-[#D9D0CB]/30 transition-colors"
              >
                <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#2E2D24]">
                  {activeWeekSummary.avgDailyCalories.toLocaleString()}
                </div>
                <div className="text-xs text-[#6A6754]">avg kcal / day</div>
              </button>
              <button
                type="button"
                onClick={() => navigateAndScroll('grocery')}
                className="text-center rounded-xl py-1 hover:bg-[#D9D0CB]/30 transition-colors"
              >
                <div className="font-mono text-lg sm:text-xl font-semibold tabular-nums text-[#14532D]">
                  ${activeWeekSummary.estCost.toFixed(0)} / ${targets.weeklyBudget}
                </div>
                <div className="text-xs text-[#6A6754]">weekly budget</div>
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
        <div className="bg-[#FAF8F6]/88 border border-[#D9D0CB]/80 rounded-2xl p-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-1.5 p-1 bg-[#EAE4E0]/75 rounded-full overflow-x-auto">
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
                      isActive ? 'text-[#D9D0CB]' : 'text-[#6A6754]'
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
            <span className="text-xs text-[#6A6754] font-mono tabular-nums">
              Week {activeWeekIndex + 1} of {planningHorizonWeeks} ·{' '}
              {formatWeekRangeLabel(activeWeekDates)}
            </span>
            {activeTab === 'calendar' && (
              <BubbleButton
                variant="terracotta"
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
          className="fixed bottom-5 left-5 z-50 px-4 py-2.5 bg-[#3B392D] text-[#FAF8F6] border border-[#908B6F]/40 text-xs font-medium rounded-lg shadow-lg flex items-center gap-2"
        >
          <Check className="w-3.5 h-3.5 text-[#D9D0CB]" />
          <span>{toastMessage}</span>
        </div>
      )}

      <MaloxieAiDrawer
        visible={introStage === 'done'}
        context={{
          activeWeekIndex,
          activeWeekDates,
          weeksDates,
          daysMap,
          recipes,
          recipesMap,
          targets,
          householdMultiplier,
          manualItems,
          favoriteIds,
        }}
        onApplyAction={handleApplyAiAction}
      />

      </div>

      {introStage !== 'done' && (
        <OpeningIntro
          logoSrc={MALOXIE_LOGO}
          onScatterStart={handleIntroScatterStart}
          onComplete={handleIntroComplete}
        />
      )}
      </SoapBubbleMaterial>
    </div>
  );
}
