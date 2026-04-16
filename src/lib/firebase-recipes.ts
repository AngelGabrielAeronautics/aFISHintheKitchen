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
import type { Recipe, Member, RecipeNote, EditLogEntry, RecipeCollection, KitchenTip, TipCategory } from "./types";

function recipesCollection() {
  return collection(getDb(), "recipes");
}

export async function getAllRecipes(): Promise<Recipe[]> {
  const q = query(recipesCollection(), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Recipe));
}

export async function getRecipeBySlug(
  slug: string
): Promise<Recipe | null> {
  const q = query(recipesCollection(), where("slug", "==", slug));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const d = snapshot.docs[0];
  return { ...d.data(), id: d.id } as Recipe;
}

export async function getRecipesByCategory(
  category: string
): Promise<Recipe[]> {
  const q = query(
    recipesCollection(),
    where("category", "==", category),
    orderBy("createdAt", "desc")
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Recipe));
}

export async function getFeaturedRecipes(): Promise<Recipe[]> {
  const q = query(recipesCollection(), where("featured", "==", true));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as Recipe));
}

export async function searchRecipes(queryStr: string): Promise<Recipe[]> {
  const all = await getAllRecipes();
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

export async function getAllMembers(): Promise<Member[]> {
  const q = query(membersCollection(), orderBy("order", "asc"));
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

export async function getAllCollections(): Promise<RecipeCollection[]> {
  const q = query(collectionsCollection(), orderBy("createdAt", "desc"));
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

// --- User Management ---

export interface InvitedUser {
  email: string;
  name: string;
  invitedBy: string;
  status: "pending" | "registered";
  createdAt: string;
  registeredAt?: string;
}

export async function getInvitedUsers(): Promise<InvitedUser[]> {
  const q = query(
    collection(getDb(), "invitedUsers"),
    orderBy("createdAt", "desc")
  );
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

export async function getAllTips(): Promise<KitchenTip[]> {
  const q = query(tipsCollection(), orderBy("createdAt", "desc"));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ ...d.data(), id: d.id } as KitchenTip));
}

export async function addTip(data: { title: string; content: string; category: TipCategory; author: string }): Promise<KitchenTip> {
  const createdAt = new Date().toISOString();
  const payload = { ...data, createdAt };
  const docRef = await addDoc(tipsCollection(), payload);
  return { ...payload, id: docRef.id };
}

export async function deleteTip(id: string): Promise<void> {
  const docRef = doc(getDb(), "tips", id);
  await deleteDoc(docRef);
}
