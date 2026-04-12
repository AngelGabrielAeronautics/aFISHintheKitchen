import {
  collection,
  query,
  orderBy,
  where,
  getDocs,
  addDoc,
  writeBatch,
  doc,
  getCountFromServer,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getDb, getFirebaseStorage } from "./firebase";
import type { Recipe } from "./types";

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
  const batch = writeBatch(db);
  for (const recipe of recipes) {
    const docRef = doc(db, "recipes", recipe.id);
    batch.set(docRef, recipe);
  }
  await batch.commit();
}

export async function getRecipeCount(): Promise<number> {
  const snapshot = await getCountFromServer(recipesCollection());
  return snapshot.data().count;
}
