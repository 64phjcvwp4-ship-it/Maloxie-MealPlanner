import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import type {
  DayPlan,
  ManualGroceryItem,
  MealTemplate,
  NutritionTargets,
  Recipe,
} from '../types/mealPlanner';

export interface PersistedState {
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
  currencyCode: string;
  regionalPriceFactor: number;
  priceOverrides: Record<string, number>;
}

export const CLIENT_INSTANCE_ID = `maloxie-${Math.random().toString(36).slice(2, 10)}`;

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, value));
}

function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

function pruneDaysMap(daysMap: Record<string, DayPlan>): Record<string, DayPlan> {
  const entries = Object.entries(daysMap || {});
  if (entries.length <= 90) {
    return stripUndefined(daysMap || {});
  }
  const hasMealsOrNotes = (day: DayPlan) =>
    Boolean(day.note?.trim()) ||
    (day.slots?.breakfast?.length || 0) +
      (day.slots?.lunch?.length || 0) +
      (day.slots?.dinner?.length || 0) +
      (day.slots?.snacks?.length || 0) >
      0;

  const sorted = [...entries].sort(([dateA, dayA], [dateB, dayB]) => {
    const activeA = hasMealsOrNotes(dayA) ? 1 : 0;
    const activeB = hasMealsOrNotes(dayB) ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;
    return dateB.localeCompare(dateA);
  });

  const kept: Record<string, DayPlan> = {};
  for (const [date, day] of sorted.slice(0, 90)) {
    kept[date] = stripUndefined(day);
  }
  return kept;
}

export function sanitizePlannerStateForCloud(state: PersistedState): PersistedState {
  const horizon = Math.round(clampNumber(state.planningHorizonWeeks, 1, 8, 2));
  const multiplier = clampNumber(state.householdMultiplier, 0.5, 12, 1);

  return {
    planningHorizonWeeks: horizon,
    daysMap: pruneDaysMap(state.daysMap),
    customRecipes: stripUndefined((state.customRecipes || []).slice(0, 100)),
    customTemplates: stripUndefined((state.customTemplates || []).slice(0, 30)),
    favoriteIds: (state.favoriteIds || [])
      .filter((id): id is string => typeof id === 'string' && id.length > 0)
      .slice(0, 200)
      .map((id) => id.slice(0, 128)),
    targets: {
      calories: clampNumber(state.targets?.calories, 500, 10000, 2000),
      protein: clampNumber(state.targets?.protein, 0, 1000, 150),
      carbs: clampNumber(state.targets?.carbs, 0, 1500, 200),
      fat: clampNumber(state.targets?.fat, 0, 500, 65),
      weeklyBudget: clampNumber(state.targets?.weeklyBudget, 0, 10000000, 120),
    },
    householdMultiplier: multiplier,
    checkedKeys: (state.checkedKeys || [])
      .filter((k): k is string => typeof k === 'string')
      .slice(0, 500)
      .map((k) => k.slice(0, 160)),
    alreadyHaveKeys: (state.alreadyHaveKeys || [])
      .filter((k): k is string => typeof k === 'string')
      .slice(0, 500)
      .map((k) => k.slice(0, 160)),
    clearedKeys: (state.clearedKeys || [])
      .filter((k): k is string => typeof k === 'string')
      .slice(0, 500)
      .map((k) => k.slice(0, 160)),
    manualItems: stripUndefined((state.manualItems || []).slice(0, 150)),
    completedPrepTaskIds: (state.completedPrepTaskIds || [])
      .filter((id): id is string => typeof id === 'string')
      .slice(0, 200)
      .map((id) => id.slice(0, 160)),
    currencyCode:
      typeof state.currencyCode === 'string' && state.currencyCode.trim().length >= 3
        ? state.currencyCode.trim().toUpperCase().slice(0, 8)
        : 'USD',
    regionalPriceFactor: clampNumber(state.regionalPriceFactor, 0.1, 5, 1),
    priceOverrides: sanitizePriceOverrides(state.priceOverrides),
  };
}

function sanitizePriceOverrides(raw: Record<string, number> | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object') return out;
  let count = 0;
  for (const [k, v] of Object.entries(raw)) {
    if (count >= 400) break;
    if (typeof k === 'string' && k.length > 0 && typeof v === 'number' && Number.isFinite(v) && v >= 0) {
      out[k.slice(0, 180)] = v;
      count += 1;
    }
  }
  return out;
}

export async function upsertUserProfile(user: User): Promise<void> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  const email = (user.email || `${user.uid}@users.local`).slice(0, 254);
  const displayName = (user.displayName || '').slice(0, 120);
  const photoURL = (user.photoURL || '').slice(0, 500);

  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      await updateDoc(ref, {
        email,
        displayName,
        photoURL,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        uid: user.uid,
        email,
        displayName,
        photoURL,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchCloudPlannerState(
  uid: string
): Promise<PersistedState | null> {
  const path = `users/${uid}/planner/default`;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'planner', 'default'));
    if (!snap.exists()) return null;
    return extractPersistedState(snap.data());
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function saveCloudPlannerState(
  uid: string,
  state: PersistedState,
  knownExists?: boolean
): Promise<void> {
  const path = `users/${uid}/planner/default`;
  const ref = doc(db, 'users', uid, 'planner', 'default');
  const clean = sanitizePlannerStateForCloud(state);

  try {
    let exists = knownExists;
    if (exists === undefined) {
      const snap = await getDoc(ref);
      exists = snap.exists();
    }

    if (exists) {
      await updateDoc(ref, {
        ...clean,
        lastClientId: CLIENT_INSTANCE_ID,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        ownerId: uid,
        ...clean,
        lastClientId: CLIENT_INSTANCE_ID,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

function extractPersistedState(raw: Record<string, unknown>): PersistedState | null {
  if (!raw || typeof raw !== 'object' || !raw.daysMap || !raw.targets) {
    return null;
  }
  return {
    planningHorizonWeeks:
      typeof raw.planningHorizonWeeks === 'number' ? raw.planningHorizonWeeks : 2,
    daysMap: raw.daysMap as Record<string, DayPlan>,
    customRecipes: Array.isArray(raw.customRecipes) ? (raw.customRecipes as Recipe[]) : [],
    customTemplates: Array.isArray(raw.customTemplates)
      ? (raw.customTemplates as MealTemplate[])
      : [],
    favoriteIds: Array.isArray(raw.favoriteIds) ? (raw.favoriteIds as string[]) : [],
    targets: raw.targets as NutritionTargets,
    householdMultiplier:
      typeof raw.householdMultiplier === 'number' ? raw.householdMultiplier : 1,
    checkedKeys: Array.isArray(raw.checkedKeys) ? (raw.checkedKeys as string[]) : [],
    alreadyHaveKeys: Array.isArray(raw.alreadyHaveKeys)
      ? (raw.alreadyHaveKeys as string[])
      : [],
    clearedKeys: Array.isArray(raw.clearedKeys) ? (raw.clearedKeys as string[]) : [],
    manualItems: Array.isArray(raw.manualItems)
      ? (raw.manualItems as ManualGroceryItem[])
      : [],
    completedPrepTaskIds: Array.isArray(raw.completedPrepTaskIds)
      ? (raw.completedPrepTaskIds as string[])
      : [],
    currencyCode:
      typeof raw.currencyCode === 'string' && raw.currencyCode.length >= 3
        ? raw.currencyCode
        : 'USD',
    regionalPriceFactor:
      typeof raw.regionalPriceFactor === 'number' ? raw.regionalPriceFactor : 1,
    priceOverrides:
      raw.priceOverrides && typeof raw.priceOverrides === 'object'
        ? (raw.priceOverrides as Record<string, number>)
        : {},
  };
}

export function subscribeToCloudPlannerState(
  uid: string,
  onRemoteState: (state: PersistedState) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const path = `users/${uid}/planner/default`;
  const ref = doc(db, 'users', uid, 'planner', 'default');

  return onSnapshot(
    ref,
    (snapshot) => {
      if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) {
        return;
      }
      const raw = snapshot.data();
      if (raw?.lastClientId === CLIENT_INSTANCE_ID) {
        return;
      }
      const extracted = extractPersistedState(raw);
      if (extracted) {
        onRemoteState(extracted);
      }
    },
    (error) => {
      onError(error);
      try {
        handleFirestoreError(error, OperationType.GET, path);
      } catch {
        // Logged by handleFirestoreError; caller handles UI notification
      }
    }
  );
}
