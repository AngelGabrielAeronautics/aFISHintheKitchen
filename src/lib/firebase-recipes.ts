import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  getDoc,
  setDoc,
  addDoc,
  writeBatch,
  doc,
  getCountFromServer,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDb, getFirebaseStorage } from "./firebase";
import type { Recipe, Member, RecipeNote, EditLogEntry, RecipeCollection, KitchenTip, TipCategory, AppNotification, UserPreferences, Household, HouseholdMember, HouseholdCustomisation } from "./types";

function recipesCollection() {
  return collection(getDb(), "recipes");
}

export async function getAllRecipes(householdId?: string): Promise<Recipe[]> {
  // Household-scoped only: without an id we return nothing rather than leaking
  // every household's recipes (callers pass undefined while the household loads).
  if (!householdId) return [];
  const q = query(
    recipesCollection(),
    where("householdId", "==", householdId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Recipe));
}

export async function getRecipeBySlug(
  slug: string,
  householdId?: string
): Promise<Recipe | null> {
  const constraints = householdId
    ? [where("slug", "==", slug), where("householdId", "==", householdId)]
    : [where("slug", "==", slug)];
  const q = query(recipesCollection(), ...constraints);
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { ...d.data(), id: d.id } as Recipe;
}

export async function getRecipesByCategory(
  category: string,
  householdId?: string
): Promise<Recipe[]> {
  if (!householdId) return [];
  const q = query(
    recipesCollection(),
    where("householdId", "==", householdId),
    where("category", "==", category),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Recipe));
}

export async function getFeaturedRecipes(householdId?: string): Promise<Recipe[]> {
  if (!householdId) return [];
  const q = query(
    recipesCollection(),
    where("householdId", "==", householdId),
    where("featured", "==", true)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Recipe));
}

export async function searchRecipes(queryStr: string, householdId?: string): Promise<Recipe[]> {
  const all = await getAllRecipes(householdId);
  const lower = queryStr.toLowerCase();
  return all.filter((recipe) => {
    return (
      recipe.title.toLowerCase().includes(lower) ||
      recipe.description.toLowerCase().includes(lower) ||
      recipe.tags.some((tag) => tag.toLowerCase().includes(lower)) ||
      recipe.ingredients.some((ingredient) =>
        ingredient.toLowerCase().includes(lower)
      )
    );
  });
}

export async function addRecipe(
  recipe: Omit<Recipe, "id" | "slug" | "createdAt">
): Promise<Recipe> {
  const slug = recipe.title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();

  const createdAt = new Date().toISOString();

  const data = { ...recipe, slug, createdAt };
  const docRef = await addDoc(recipesCollection(), data);

  return { ...data, id: docRef.id } as Recipe;
}

export async function uploadRecipeImage(
  file: File,
  slug: string
): Promise<string> {
  const storageRef = ref(getFirebaseStorage(), `recipe-images/${slug}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function seedRecipes(recipes: Recipe[]): Promise<void> {
  const db = getDb();
  // Delete all existing recipes first
  const existing = await getDocs(recipesCollection());
  if (!existing.empty) {
    const deleteBatch = writeBatch(db);
    existing.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
  }
  // Write new recipes
  const batch = writeBatch(db);
  for (const recipe of recipes) {
    const docRef = doc(db, "recipes", recipe.id);
    batch.set(docRef, recipe);
  }
  await batch.commit();
}

export async function updateRecipe(
  recipeId: string,
  data: Partial<Omit<Recipe, "id" | "slug" | "createdAt">>
): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  await updateDoc(docRef, data);
}

export async function toggleLoved(recipeId: string, name: string, add: boolean): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  if (add) {
    await updateDoc(docRef, {
      lovedBy: arrayUnion(name),
      dislikedBy: arrayRemove(name),
    });
  } else {
    await updateDoc(docRef, { lovedBy: arrayRemove(name) });
  }
}

export async function toggleDisliked(recipeId: string, name: string, add: boolean): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  if (add) {
    await updateDoc(docRef, {
      dislikedBy: arrayUnion(name),
      lovedBy: arrayRemove(name),
    });
  } else {
    await updateDoc(docRef, { dislikedBy: arrayRemove(name) });
  }
}

export async function toggleMustTry(recipeId: string, name: string, add: boolean): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  if (add) {
    await updateDoc(docRef, { mustTry: arrayUnion(name) });
  } else {
    await updateDoc(docRef, { mustTry: arrayRemove(name) });
  }
}

export async function toggleTried(recipeId: string, name: string, add: boolean): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  if (add) {
    await updateDoc(docRef, {
      triedBy: arrayUnion(name),
      mustTry: arrayRemove(name),
    });
  } else {
    await updateDoc(docRef, { triedBy: arrayRemove(name) });
  }
}

export async function getRecipeCount(): Promise<number> {
  const snapshot = await getCountFromServer(recipesCollection());
  return snapshot.data().count;
}

// --- Delete Recipe ---

export async function deleteRecipe(recipeId: string): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  await deleteDoc(docRef);
}

// --- Notes ---

export async function addRecipeNote(recipeId: string, note: RecipeNote): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  await updateDoc(docRef, { notes: arrayUnion(note) });
}

export async function removeRecipeNote(recipeId: string, note: RecipeNote): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  await updateDoc(docRef, { notes: arrayRemove(note) });
}

// --- Edit History ---

export async function addEditLogEntry(recipeId: string, entry: EditLogEntry): Promise<void> {
  const docRef = doc(getDb(), "recipes", recipeId);
  await updateDoc(docRef, { editHistory: arrayUnion(entry) });
}

// --- Members ---

function membersCollection() {
  return collection(getDb(), "members");
}

export async function getAllMembers(householdId?: string): Promise<Member[]> {
  const constraints = householdId
    ? [where("householdId", "==", householdId), orderBy("order", "asc")]
    : [orderBy("order", "asc")];
  const q = query(membersCollection(), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Member));
}

export async function seedMembers(members: Member[]): Promise<void> {
  const db = getDb();
  // Delete all existing members first
  const existing = await getDocs(membersCollection());
  if (!existing.empty) {
    const deleteBatch = writeBatch(db);
    existing.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
  }
  // Write new members
  const batch = writeBatch(db);
  for (const member of members) {
    const docRef = doc(db, "members", member.id);
    batch.set(docRef, member);
  }
  await batch.commit();
}

export async function updateMember(
  memberId: string,
  data: Partial<Omit<Member, "id">>
): Promise<void> {
  const docRef = doc(getDb(), "members", memberId);
  await updateDoc(docRef, data);
}

export async function getMemberCount(): Promise<number> {
  const snapshot = await getCountFromServer(membersCollection());
  return snapshot.data().count;
}

// --- Collections ---

function collectionsCollection() {
  return collection(getDb(), "collections");
}

export async function getAllCollections(householdId?: string): Promise<RecipeCollection[]> {
  if (!householdId) return [];
  const q = query(
    collectionsCollection(),
    where("householdId", "==", householdId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as RecipeCollection));
}

export async function addCollection(
  data: Omit<RecipeCollection, "id" | "createdAt">
): Promise<RecipeCollection> {
  const createdAt = new Date().toISOString();
  const payload = { ...data, createdAt };
  const docRef = await addDoc(collectionsCollection(), payload);
  return { ...payload, id: docRef.id } as RecipeCollection;
}

export async function updateCollection(
  id: string,
  data: Partial<Omit<RecipeCollection, "id" | "createdAt">>
): Promise<void> {
  const docRef = doc(getDb(), "collections", id);
  await updateDoc(docRef, data);
}

export async function deleteCollection(id: string): Promise<void> {
  const docRef = doc(getDb(), "collections", id);
  await deleteDoc(docRef);
}

export async function updateAssignmentStatus(
  collectionId: string,
  recipeId: string,
  memberName: string,
  status: "pending" | "accepted" | "declined"
): Promise<void> {
  const docRef = doc(getDb(), "collections", collectionId);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return;
  const data = snapshot.data() as RecipeCollection;
  const assignmentStatus = data.assignmentStatus ?? {};
  if (!assignmentStatus[recipeId]) assignmentStatus[recipeId] = {};
  assignmentStatus[recipeId][memberName] = status;
  await updateDoc(docRef, { assignmentStatus });
}

// --- User Management ---

export interface InvitedUser {
  email: string;
  name: string;
  invitedBy: string;
  householdId?: string;
  status: "pending" | "registered";
  createdAt: string;
  registeredAt?: string;
}

export async function getInvitedUsers(householdId?: string): Promise<InvitedUser[]> {
  const q = householdId
    ? query(collection(getDb(), "invitedUsers"), where("householdId", "==", householdId), orderBy("createdAt", "desc"))
    : query(collection(getDb(), "invitedUsers"), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), email: d.id } as InvitedUser));
}

export async function addInvitedUser(
  data: Omit<InvitedUser, "status" | "createdAt">
): Promise<void> {
  const email = data.email.toLowerCase().trim();
  const docRef = doc(getDb(), "invitedUsers", email);
  await setDoc(docRef, {
    name: data.name,
    invitedBy: data.invitedBy,
    ...(data.householdId ? { householdId: data.householdId } : {}),
    status: "pending",
    createdAt: new Date().toISOString(),
  });
}

export async function removeInvitedUser(email: string): Promise<void> {
  const docRef = doc(getDb(), "invitedUsers", email.toLowerCase().trim());
  await deleteDoc(docRef);
}

export async function isEmailAllowed(email: string): Promise<boolean> {
  const docRef = doc(getDb(), "invitedUsers", email.toLowerCase().trim());
  const snapshot = await getDoc(docRef);
  return snapshot.exists();
}

export async function markUserRegistered(email: string): Promise<void> {
  const docRef = doc(getDb(), "invitedUsers", email.toLowerCase().trim());
  await updateDoc(docRef, {
    status: "registered",
    registeredAt: new Date().toISOString(),
  });
}

export async function isAdmin(email: string): Promise<boolean> {
  const docRef = doc(getDb(), "config", "settings");
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return false;
  const data = snapshot.data();
  const adminEmails: string[] = data.adminEmails ?? [];
  return adminEmails.includes(email.toLowerCase().trim());
}

export async function getAdminEmails(): Promise<string[]> {
  const docRef = doc(getDb(), "config", "settings");
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return [];
  const data = snapshot.data();
  return data.adminEmails ?? [];
}

// ── Kitchen Tips ──

function tipsCollection() {
  return collection(getDb(), "tips");
}

export async function getAllTips(householdId?: string): Promise<KitchenTip[]> {
  if (!householdId) return [];
  const q = query(
    tipsCollection(),
    where("householdId", "==", householdId),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as KitchenTip));
}

export async function getTipsForRecipe(recipeId: string): Promise<KitchenTip[]> {
  const q = query(tipsCollection(), where("linkedRecipeIds", "array-contains", recipeId));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as KitchenTip));
}

export async function addTip(data: { title: string; content: string; category: TipCategory; author: string; images?: string[]; video?: string; linkedRecipes?: { id: string; title: string; slug: string }[] }): Promise<KitchenTip> {
  const createdAt = new Date().toISOString();
  const payload: Record<string, unknown> = {
    title: data.title,
    content: data.content,
    category: data.category,
    author: data.author,
    createdAt,
  };
  if (data.images && data.images.length > 0) payload.images = data.images;
  if (data.video) payload.video = data.video;
  if (data.linkedRecipes && data.linkedRecipes.length > 0) {
    payload.linkedRecipes = data.linkedRecipes;
    payload.linkedRecipeIds = data.linkedRecipes.map((r) => r.id);
  }
  const docRef = await addDoc(tipsCollection(), payload);
  return { ...data, createdAt, id: docRef.id };
}

export async function uploadTipFile(file: File, tipId: string): Promise<string> {
  const storageRef = ref(getFirebaseStorage(), `tip-images/${tipId}/${file.name}`);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function updateTip(id: string, data: Partial<Omit<KitchenTip, "id" | "createdAt">>): Promise<void> {
  const docRef = doc(getDb(), "tips", id);
  await updateDoc(docRef, data as Record<string, unknown>);
}

export async function deleteTip(id: string): Promise<void> {
  const docRef = doc(getDb(), "tips", id);
  await deleteDoc(docRef);
}

// ── Notifications ──

function notificationsCollection() {
  return collection(getDb(), "notifications");
}

export async function createNotification(data: { type: "new-recipe" | "event-assignment"; message: string; link: string; authorName: string; householdId?: string; collectionId?: string; recipeId?: string; assignedMember?: string }): Promise<void> {
  await addDoc(notificationsCollection(), {
    ...data,
    createdAt: new Date().toISOString(),
    readBy: [],
  });
}

export async function getNotifications(householdId?: string, limit = 20): Promise<AppNotification[]> {
  const constraints = householdId
    ? [where("householdId", "==", householdId), orderBy("createdAt", "desc")]
    : [orderBy("createdAt", "desc")];
  const q = query(notificationsCollection(), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.slice(0, limit).map((d) => ({ ...d.data(), id: d.id } as AppNotification));
}

export async function markNotificationRead(notificationId: string, uid: string): Promise<void> {
  const docRef = doc(getDb(), "notifications", notificationId);
  await updateDoc(docRef, { readBy: arrayUnion(uid) });
}

export async function markAllNotificationsRead(notifications: AppNotification[], uid: string): Promise<void> {
  const batch = writeBatch(getDb());
  for (const n of notifications) {
    if (!n.readBy.includes(uid)) {
      batch.update(doc(getDb(), "notifications", n.id), { readBy: arrayUnion(uid) });
    }
  }
  await batch.commit();
}

// ── User Preferences ──

export async function getUserPreferences(uid: string): Promise<UserPreferences> {
  const docRef = doc(getDb(), "userPreferences", uid);
  const snapshot = await getDoc(docRef);
  if (!snapshot.exists()) return { notifyNewRecipes: true };
  return snapshot.data() as UserPreferences;
}

export async function updateUserPreferences(uid: string, prefs: Partial<UserPreferences>): Promise<void> {
  const docRef = doc(getDb(), "userPreferences", uid);
  await setDoc(docRef, prefs, { merge: true });
}

// ── Households ──

function householdsCollection() {
  return collection(getDb(), "households");
}

function householdMembersCollection() {
  return collection(getDb(), "householdMembers");
}

export async function createHousehold(data: {
  name: string;
  slug: string;
  ownerId: string;
  ownerName: string;
  customisation?: Partial<HouseholdCustomisation>;
}): Promise<Household> {
  const createdAt = new Date().toISOString();
  const household: Omit<Household, "id"> = {
    name: data.name,
    slug: data.slug,
    ownerId: data.ownerId,
    customisation: {
      brandName: data.customisation?.brandName ?? data.name,
      tagline: data.customisation?.tagline ?? "Family Recipes Worth Catching",
      ...(data.customisation?.primaryColor ? { primaryColor: data.customisation.primaryColor } : {}),
      ...(data.customisation?.logoUrl ? { logoUrl: data.customisation.logoUrl } : {}),
    },
    plan: "free",
    createdAt,
  };
  const docRef = await addDoc(householdsCollection(), household);

  // Add owner as first member
  await addDoc(householdMembersCollection(), {
    userId: data.ownerId,
    householdId: docRef.id,
    displayName: data.ownerName,
    role: "owner",
    joinedAt: createdAt,
  });

  return { ...household, id: docRef.id };
}

export async function getHousehold(id: string): Promise<Household | null> {
  const snap = await getDoc(doc(getDb(), "households", id));
  return snap.exists() ? { ...snap.data(), id: snap.id } as Household : null;
}

export async function getHouseholdBySlug(slug: string): Promise<Household | null> {
  const q = query(householdsCollection(), where("slug", "==", slug));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { ...d.data(), id: d.id } as Household;
}

export async function updateHousehold(id: string, data: Partial<Omit<Household, "id" | "createdAt">>): Promise<void> {
  const docRef = doc(getDb(), "households", id);
  await updateDoc(docRef, data as Record<string, unknown>);
}

export async function getUserHouseholds(userId: string): Promise<HouseholdMember[]> {
  const q = query(householdMembersCollection(), where("userId", "==", userId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as HouseholdMember));
}

export async function getHouseholdMembers(householdId: string): Promise<HouseholdMember[]> {
  const q = query(householdMembersCollection(), where("householdId", "==", householdId));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ ...d.data(), id: d.id } as HouseholdMember));
}

export async function addHouseholdMember(data: { userId: string; householdId: string; displayName: string; role: "admin" | "member" }): Promise<HouseholdMember> {
  const joinedAt = new Date().toISOString();
  const payload = { ...data, joinedAt };
  const docRef = await addDoc(householdMembersCollection(), payload);
  return { ...payload, id: docRef.id };
}

export async function removeHouseholdMember(memberId: string): Promise<void> {
  await deleteDoc(doc(getDb(), "householdMembers", memberId));
}

export async function isSlugAvailable(slug: string): Promise<boolean> {
  const existing = await getHouseholdBySlug(slug);
  return !existing;
}
