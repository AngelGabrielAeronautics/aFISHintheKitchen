"use client";

import { useState, useEffect, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CATEGORIES, FAMILY_MEMBERS, SEASONS, type Season } from "@/lib/types";
import type { Category, Protein, HeatLevel } from "@/lib/types";
import { HEAT_LABELS } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import SortableList from "@/components/SortableList";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import { addRecipe, uploadRecipeImage, createNotification } from "@/lib/firebase-recipes";
import { useHousehold } from "@/context/HouseholdContext";
import ImageDropzone from "@/components/ImageDropzone";
import ImagePreviewGrid from "@/components/ImagePreviewGrid";
import { readFileAsDataURL, type RecipePhoto } from "@/lib/image-utils";

const MAX_PHOTOS = 6;

interface FormErrors {
  title?: string;
  description?: string;
  category?: string;
  difficulty?: string;
  protein?: string;
  prepTime?: string;
  cookTime?: string;
  servings?: string;
  contributedBy?: string;
  ingredients?: string;
  instructions?: string;
  photo?: string;
  submit?: string;
}

const INITIAL_INGREDIENTS = ["", "", ""];
const INITIAL_INSTRUCTIONS = ["", "", ""];

export default function SubmitRecipePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { householdId } = useHousehold();

  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [difficulty, setDifficulty] = useState<
    "Easy" | "Medium" | "Hard" | ""
  >("");
  const [protein, setProtein] = useState<Protein | "">("");
  const [heat, setHeat] = useState<HeatLevel | "">("");
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [prepTime, setPrepTime] = useState("");
  const [cookTime, setCookTime] = useState("");
  const [servings, setServings] = useState("");
  const [contributedBy, setContributedBy] = useState("");
  const [story, setStory] = useState("");
  const [originalSource, setOriginalSource] = useState("");
  const [ingredients, setIngredients] = useState<string[]>([
    ...INITIAL_INGREDIENTS,
  ]);
  const [instructions, setInstructions] = useState<string[]>([
    ...INITIAL_INSTRUCTIONS,
  ]);
  const [tags, setTags] = useState("");
  const [stepImages, setStepImages] = useState<Record<string, { file: File; preview: string }>>({});
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<"link" | "upload">("link");
  const [photos, setPhotos] = useState<RecipePhoto[]>([]);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  // Warn on unsaved changes
  const isDirty = !submitted && (
    title.trim() !== "" ||
    description.trim() !== "" ||
    ingredients.some((i) => i.trim()) ||
    instructions.some((i) => i.trim()) ||
    photos.length > 0
  );
  const { showPrompt, confirmLeave, cancelLeave } = useUnsavedChanges(isDirty);

  // Auto-fill contributedBy from user displayName
  useEffect(() => {
    if (user?.displayName && !contributedBy) {
      setContributedBy(user.displayName);
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Ingredient helpers ---
  function updateIngredient(index: number, value: string) {
    setIngredients((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function addIngredient() {
    setIngredients((prev) => [...prev, ""]);
  }

  function removeIngredient(index: number) {
    if (ingredients.length <= 1) return;
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }

  // --- Instruction helpers ---
  function updateInstruction(index: number, value: string) {
    setInstructions((prev) => prev.map((v, i) => (i === index ? value : v)));
  }

  function addInstruction() {
    setInstructions((prev) => [...prev, ""]);
  }

  function removeInstruction(index: number) {
    if (instructions.length <= 1) return;
    setInstructions((prev) => prev.filter((_, i) => i !== index));
  }

  // --- Step image helpers ---
  function handleStepImageSelect(index: number, file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      setStepImages((prev) => ({ ...prev, [String(index)]: { file, preview: e.target?.result as string } }));
    };
    reader.readAsDataURL(file);
  }

  function handleStepImageRemove(index: number) {
    setStepImages((prev) => {
      const next = { ...prev };
      delete next[String(index)];
      return next;
    });
  }

  // --- Photo helpers ---
  async function handleAddPhotos(files: File[]) {
    const newPhotos: RecipePhoto[] = await Promise.all(
      files.map(async (file) => ({
        id: crypto.randomUUID(),
        kind: "new" as const,
        file,
        preview: await readFileAsDataURL(file),
      }))
    );
    setPhotos((prev) => [...prev, ...newPhotos].slice(0, MAX_PHOTOS));
  }

  function setPhotoError(message: string | null) {
    setErrors((prev) => {
      const next = { ...prev };
      if (message) next.photo = message;
      else delete next.photo;
      return next;
    });
  }

  function removePhoto(id: string) {
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  // --- Validation ---
  async function handleImportFromPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    setImportError("");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/import-recipe", { method: "POST", body: formData });
      const data = await res.json();

      if (data.error) {
        setImportError(data.error);
        return;
      }

      // Pre-fill form fields
      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
      if (data.difficulty) setDifficulty(data.difficulty);
      if (data.protein) setProtein(data.protein);
      if (data.prepTime) setPrepTime(String(data.prepTime));
      if (data.cookTime) setCookTime(String(data.cookTime));
      if (data.servings) setServings(String(data.servings));
      if (data.tags && Array.isArray(data.tags)) setTags(data.tags.join(", "));
      if (data.seasons && Array.isArray(data.seasons)) setSeasons(data.seasons);
      if (data.ingredients && Array.isArray(data.ingredients) && data.ingredients.length > 0) {
        setIngredients(data.ingredients);
      }
      if (data.instructions && Array.isArray(data.instructions) && data.instructions.length > 0) {
        setInstructions(data.instructions);
      }
    } catch {
      setImportError("Failed to process image. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  function validate(): boolean {
    const newErrors: FormErrors = {};

    if (!title.trim()) newErrors.title = "Recipe title is required.";
    if (!description.trim())
      newErrors.description = "A short description is required.";
    if (!category) newErrors.category = "Please choose a category.";
    if (!difficulty) newErrors.difficulty = "Please select a difficulty.";
    if (!protein) newErrors.protein = "Please select a protein.";
    if (!prepTime || Number(prepTime) <= 0)
      newErrors.prepTime = "Prep time is required.";
    if (!cookTime || Number(cookTime) < 0)
      newErrors.cookTime = "Cook time is required.";
    if (!servings || Number(servings) <= 0)
      newErrors.servings = "Servings is required.";
    if (!contributedBy.trim())
      newErrors.contributedBy = "Let us know who you are!";

    const filledIngredients = ingredients.filter((i) => i.trim());
    if (filledIngredients.length === 0)
      newErrors.ingredients = "Add at least one ingredient.";

    const filledInstructions = instructions.filter((i) => i.trim());
    if (filledInstructions.length === 0)
      newErrors.instructions = "Add at least one instruction step.";

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      const firstErrorKey = Object.keys(newErrors)[0];
      const el = document.getElementById(firstErrorKey);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.focus();
      }
    }
    return Object.keys(newErrors).length === 0;
  }

  // --- Submit ---
  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.submit;
      return next;
    });

    try {
      // Generate a slug for the image upload path
      const slugFromTitle = title
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .trim();

      // Upload images if provided, preserving the displayed order (first = cover).
      const imageUrls: string[] = [];
      for (const photo of photos) {
        if (photo.kind !== "new") continue;
        const url = await uploadRecipeImage(photo.file, slugFromTitle);
        imageUrls.push(url);
      }

      // Upload step images
      const uploadedStepImages: Record<string, string> = {};
      for (const [idx, { file }] of Object.entries(stepImages)) {
        const url = await uploadRecipeImage(file, `${slugFromTitle}/steps`);
        uploadedStepImages[idx] = url;
      }

      // Upload video if provided
      let finalVideoUrl = videoUrl.trim();
      if (videoFile) {
        finalVideoUrl = await uploadRecipeImage(videoFile, `${slugFromTitle}/video`);
      }

      // Build recipe data
      const recipeData: Parameters<typeof addRecipe>[0] = {
        title,
        description,
        category: category as Category,
        difficulty: difficulty as "Easy" | "Medium" | "Hard",
        protein: protein as Protein,
        ...(heat ? { heat } : {}),
        ...(seasons.length > 0 ? { seasons } : {}),
        prepTime: Number(prepTime),
        cookTime: Number(cookTime),
        servings: Number(servings),
        image: imageUrls[0] || "",
        ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
        contributedBy,
        ...(story ? { story } : {}),
        ...(originalSource ? { originalSource } : {}),
        ingredients: ingredients.filter((i) => i.trim()),
        instructions: instructions.filter((i) => i.trim()),
        ...(Object.keys(uploadedStepImages).length > 0 ? { instructionImages: uploadedStepImages } : {}),
        ...(finalVideoUrl ? { video: finalVideoUrl } : {}),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        featured: false,
        ...(householdId ? { householdId } : {}),
      };

      const savedRecipe = await addRecipe(recipeData);

      // Notify the family
      createNotification({
        type: "new-recipe",
        message: `${contributedBy} added a new recipe: ${title}`,
        link: `/recipes/${savedRecipe.slug}`,
        authorName: contributedBy,
        ...(householdId ? { householdId } : {}),
      }).catch(() => {}); // fire and forget

      router.push(`/recipes/${savedRecipe.slug}?saved=1`);
    } catch {
      setErrors((prev) => ({
        ...prev,
        submit:
          "Something went wrong submitting your recipe. Please try again.",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  // --- Reset ---
  function resetForm() {
    setTitle("");
    setDescription("");
    setCategory("");
    setDifficulty("");
    setProtein("");
    setHeat("");
    setSeasons([]);
    setStepImages({});
    setVideoUrl("");
    setVideoFile(null);
    setVideoPreview(null);
    setVideoType("link");
    setPrepTime("");
    setCookTime("");
    setServings("");
    setContributedBy(user?.displayName || "");
    setStory("");
    setOriginalSource("");
    setIngredients([...INITIAL_INGREDIENTS]);
    setInstructions([...INITIAL_INSTRUCTIONS]);
    setTags("");
    setPhotos([]);
    setErrors({});
    setSubmitted(false);
    setSavedSlug(null);
  }

  // --- Shared input classes ---
  const inputClasses =
    "w-full bg-warm-white rounded-lg border border-gold-light px-4 py-3 text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-terracotta transition-colors";
  const labelClasses = "block text-sm font-medium text-charcoal mb-1.5";
  const errorClasses = "text-red-600 text-sm mt-1";

  // --- Auth loading state ---
  if (authLoading) {
    return (
      <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cream-dark border-t-terracotta" />
        </div>
      </main>
    );
  }

  // --- Not signed in ---
  if (!user) {
    return (
      <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <div className="w-16 h-16 bg-gold-light/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-charcoal/60"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                />
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-charcoal mb-2">
              Sign in to submit a recipe
            </h2>
            <p className="text-slate mb-8">
              You need to be signed in to submit a recipe.
            </p>
            <Link
              href="/auth"
              className="inline-block w-full bg-terracotta text-white font-medium py-3 rounded-lg hover:bg-terracotta-dark transition-colors text-center"
            >
              Sign in or create an account
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // --- Success state ---
  if (submitted) {
    return (
      <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <div className="w-16 h-16 bg-sage-light rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-8 h-8 text-sage-dark"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2.5}
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 12.75l6 6 9-13.5"
                />
              </svg>
            </div>
            <h2 className="font-serif text-2xl text-charcoal mb-2">
              Recipe submitted!
            </h2>
            <p className="text-slate mb-8">
              It&apos;ll appear once reviewed. Thanks for sharing with the
              family.
            </p>
            {savedSlug && (
              <Link
                href={`/recipes/${savedSlug}`}
                className="inline-block w-full bg-sage text-white font-medium py-3 rounded-lg hover:bg-sage-dark transition-colors mb-3 text-center"
              >
                View your recipe
              </Link>
            )}
            <button
              onClick={resetForm}
              className="w-full bg-terracotta text-white font-medium py-3 rounded-lg hover:bg-terracotta-dark transition-colors cursor-pointer"
            >
              Submit another recipe
            </button>
          </div>
        </div>
      </main>
    );
  }

  // --- Form ---
  return (
    <main className="min-h-screen bg-cream py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <h1 className="font-serif text-4xl text-charcoal mb-3">
            Submit a Recipe
          </h1>
          <p className="text-slate text-lg">
            Got a family favourite? Add it to the collection.
          </p>
        </div>

        {/* AI Import */}
        <div className="mb-8 rounded-2xl bg-gradient-to-r from-terracotta/5 to-sage/5 p-6 ring-1 ring-terracotta/20">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <h3 className="font-serif text-lg font-bold text-charcoal">Import from Photo</h3>
              <p className="mt-1 font-sans text-sm text-slate">
                Take a photo of a recipe from a book, magazine, or handwritten card and let AI fill in the form for you.
              </p>
            </div>
            <label className={`shrink-0 inline-flex items-center gap-2 rounded-lg px-5 py-2.5 font-sans text-sm font-medium transition-colors cursor-pointer ${importing ? "bg-slate/20 text-slate" : "bg-terracotta text-white hover:bg-terracotta-dark"}`}>
              {importing ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Reading recipe...
                </>
              ) : (
                <>
                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
                    <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
                  </svg>
                  Upload Photo
                </>
              )}
              <input type="file" accept="image/*" onChange={handleImportFromPhoto} disabled={importing} className="hidden" />
            </label>
          </div>
          {importError && (
            <p className="mt-3 font-sans text-sm text-red-500">{importError}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-10">
          {/* ---- Section: The Basics ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              The Basics
            </h2>

            {/* Title */}
            <div>
              <label htmlFor="title" className={labelClasses}>
                Recipe Title <span className="text-terracotta">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Nan's Fish Pie"
                className={inputClasses}
              />
              {errors.title && (
                <p className={errorClasses}>{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className={labelClasses}>
                Description <span className="text-terracotta">*</span>
              </label>
              <textarea
                id="description"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A short description — what makes this dish special?"
                className={`${inputClasses} resize-none`}
              />
              {errors.description && (
                <p className={errorClasses}>{errors.description}</p>
              )}
            </div>

            {/* Difficulty, Category, Protein & Heat */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label htmlFor="difficulty" className={labelClasses}>
                  Difficulty <span className="text-terracotta">*</span>
                </label>
                <select
                  id="difficulty"
                  value={difficulty}
                  onChange={(e) =>
                    setDifficulty(
                      e.target.value as "Easy" | "Medium" | "Hard"
                    )
                  }
                  className={`${inputClasses} appearance-none`}
                >
                  <option value="">Select difficulty</option>
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
                {errors.difficulty && (
                  <p className={errorClasses}>{errors.difficulty}</p>
                )}
              </div>

              <div>
                <label htmlFor="category" className={labelClasses}>
                  Category <span className="text-terracotta">*</span>
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className={`${inputClasses} appearance-none`}
                >
                  <option value="">Select a category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat.slug} value={cat.slug}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {errors.category && (
                  <p className={errorClasses}>{errors.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="protein" className={labelClasses}>
                  Protein <span className="text-terracotta">*</span>
                </label>
                <select
                  id="protein"
                  value={protein}
                  onChange={(e) => setProtein(e.target.value as Protein)}
                  className={`${inputClasses} appearance-none`}
                >
                  <option value="">Select protein</option>
                  <option value="beef">Beef</option>
                  <option value="eggs">Eggs</option>
                  <option value="lamb">Lamb</option>
                  <option value="mixed">Mixed</option>
                  <option value="pork">Pork</option>
                  <option value="poultry">Poultry</option>
                  <option value="seafood">Seafood</option>
                  <option value="vegan">Vegan</option>
                  <option value="vegetarian">Vegetarian</option>
                </select>
                {errors.protein && (
                  <p className={errorClasses}>{errors.protein}</p>
                )}
              </div>

              <div>
                <label htmlFor="heat" className={labelClasses}>
                  Heat Level <span className="text-slate/50 font-normal">(optional)</span>
                </label>
                <select
                  id="heat"
                  value={heat}
                  onChange={(e) => setHeat(e.target.value ? Number(e.target.value) as HeatLevel : "")}
                  className={`${inputClasses} appearance-none`}
                >
                  <option value="">No heat</option>
                  {([1, 2, 3, 4, 5] as HeatLevel[]).map((level) => (
                    <option key={level} value={level}>
                      {HEAT_LABELS[level]} ({level})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Seasons */}
            <div>
              <label className={labelClasses}>
                Season <span className="text-slate/50 font-normal">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-3 mt-1">
                {SEASONS.map((s) => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={seasons.includes(s.value)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSeasons((prev) => [...prev, s.value]);
                        } else {
                          setSeasons((prev) => prev.filter((v) => v !== s.value));
                        }
                      }}
                      className="h-4 w-4 rounded border-gold-light text-terracotta focus:ring-terracotta/20 accent-terracotta"
                    />
                    <span className="font-sans text-sm text-charcoal">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          {/* ---- Section: Time & Servings ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              Time &amp; Servings
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div>
                <label htmlFor="prepTime" className={labelClasses}>
                  Prep Time (min) <span className="text-terracotta">*</span>
                </label>
                <input
                  id="prepTime"
                  type="number"
                  min={0}
                  value={prepTime}
                  onChange={(e) => setPrepTime(e.target.value)}
                  placeholder="15"
                  className={inputClasses}
                />
                {errors.prepTime && (
                  <p className={errorClasses}>{errors.prepTime}</p>
                )}
              </div>

              <div>
                <label htmlFor="cookTime" className={labelClasses}>
                  Cook Time (min) <span className="text-terracotta">*</span>
                </label>
                <input
                  id="cookTime"
                  type="number"
                  min={0}
                  value={cookTime}
                  onChange={(e) => setCookTime(e.target.value)}
                  placeholder="30"
                  className={inputClasses}
                />
                {errors.cookTime && (
                  <p className={errorClasses}>{errors.cookTime}</p>
                )}
              </div>

              <div>
                <label htmlFor="servings" className={labelClasses}>
                  Servings <span className="text-terracotta">*</span>
                </label>
                <input
                  id="servings"
                  type="number"
                  min={1}
                  value={servings}
                  onChange={(e) => setServings(e.target.value)}
                  placeholder="4"
                  className={inputClasses}
                />
                {errors.servings && (
                  <p className={errorClasses}>{errors.servings}</p>
                )}
              </div>
            </div>
          </section>

          {/* ---- Section: About You ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              About You
            </h2>

            <div>
              <label htmlFor="contributedBy" className={labelClasses}>
                Contributed by <span className="text-terracotta">*</span>
              </label>
              <select
                id="contributedBy"
                value={contributedBy}
                onChange={(e) => setContributedBy(e.target.value)}
                className={`${inputClasses} appearance-none`}
              >
                <option value="">Select family member</option>
                {FAMILY_MEMBERS.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              {errors.contributedBy && (
                <p className={errorClasses}>{errors.contributedBy}</p>
              )}
            </div>

            <div>
              <label htmlFor="originalSource" className={labelClasses}>
                Original Source{" "}
                <span className="text-slate/50 font-normal">(optional)</span>
              </label>
              <input
                id="originalSource"
                type="text"
                value={originalSource}
                onChange={(e) => setOriginalSource(e.target.value)}
                placeholder="e.g. Marcella Hazan, Jamie Oliver, Grandma's recipe"
                className={inputClasses}
              />
            </div>

            <div>
              <label htmlFor="story" className={labelClasses}>
                The Story{" "}
                <span className="text-slate/50 font-normal">(optional)</span>
              </label>
              <textarea
                id="story"
                rows={4}
                value={story}
                onChange={(e) => setStory(e.target.value)}
                placeholder="Any family story or memory behind this dish?"
                className={`${inputClasses} resize-none`}
              />
            </div>
          </section>

          {/* ---- Section: Ingredients ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              Ingredients <span className="text-terracotta text-sm">*</span>
            </h2>

            <SortableList
              items={ingredients}
              onReorder={setIngredients}
              onUpdate={updateIngredient}
              onAdd={addIngredient}
              onRemove={removeIngredient}
              placeholderPrefix="Ingredient"
              addLabel="Add Ingredient"
              inputClasses={inputClasses}
              onAddSection={() => setIngredients((prev) => [...prev, "## "])}
            />

            {errors.ingredients && (
              <p className={errorClasses}>{errors.ingredients}</p>
            )}
          </section>

          {/* ---- Section: Instructions ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              Instructions <span className="text-terracotta text-sm">*</span>
            </h2>

            <SortableList
              items={instructions}
              onReorder={setInstructions}
              onUpdate={updateInstruction}
              onAdd={addInstruction}
              onRemove={removeInstruction}
              placeholderPrefix="Step"
              addLabel="Add Step"
              multiline
              onAddSection={() => setInstructions((prev) => [...prev, "## "])}
              inputClasses={inputClasses}
              images={Object.fromEntries(Object.entries(stepImages).map(([k, v]) => [k, v.preview]))}
              onImageSelect={handleStepImageSelect}
              onImageRemove={handleStepImageRemove}
            />

            {errors.instructions && (
              <p className={errorClasses}>{errors.instructions}</p>
            )}
          </section>

          {/* ---- Section: Extras ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              Extras
            </h2>

            {/* Tags */}
            <div>
              <label htmlFor="tags" className={labelClasses}>
                Tags{" "}
                <span className="text-slate/50 font-normal">(optional)</span>
              </label>
              <input
                id="tags"
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g., comfort food, weeknight, summer"
                className={inputClasses}
              />
              <p className="text-xs text-slate/50 mt-1">
                Separate tags with commas.
              </p>
            </div>

            {/* Video */}
            <div>
              <label className={labelClasses}>
                Recipe Video{" "}
                <span className="text-slate/50 font-normal">(optional)</span>
              </label>

              {/* Toggle: link or upload */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setVideoType("link")}
                  className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors cursor-pointer ${
                    videoType === "link" ? "bg-terracotta text-white" : "bg-warm-white text-slate ring-1 ring-gold-light hover:bg-cream-dark/20"
                  }`}
                >
                  YouTube / URL
                </button>
                <button
                  type="button"
                  onClick={() => setVideoType("upload")}
                  className={`rounded-full px-4 py-1.5 font-sans text-xs font-medium transition-colors cursor-pointer ${
                    videoType === "upload" ? "bg-terracotta text-white" : "bg-warm-white text-slate ring-1 ring-gold-light hover:bg-cream-dark/20"
                  }`}
                >
                  Upload Video
                </button>
              </div>

              {videoType === "link" ? (
                <input
                  type="url"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  placeholder="Paste a YouTube or video URL"
                  className={inputClasses}
                />
              ) : (
                <>
                  {videoPreview ? (
                    <div className="relative rounded-lg overflow-hidden border border-gold-light">
                      <video src={videoPreview} controls className="w-full max-h-48" />
                      <button
                        type="button"
                        onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                        className="absolute top-2 right-2 w-6 h-6 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed border-gold-light bg-warm-white hover:border-terracotta/50 cursor-pointer transition-colors">
                      <svg className="w-8 h-8 text-slate/40 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                      </svg>
                      <p className="text-xs text-slate/60">
                        Select a video — <span className="text-terracotta font-medium">browse</span>
                      </p>
                      <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setVideoFile(file);
                            setVideoPreview(URL.createObjectURL(file));
                          }
                        }}
                        className="hidden"
                      />
                    </label>
                  )}
                </>
              )}
            </div>

            {/* Photo Upload — up to 6 */}
            <div>
              <label className={labelClasses}>
                Recipe Photos{" "}
                <span className="text-slate/50 font-normal">(up to 6)</span>
              </label>

              <ImagePreviewGrid photos={photos} onReorder={setPhotos} onRemove={removePhoto} />

              <ImageDropzone
                count={photos.length}
                max={MAX_PHOTOS}
                onFiles={handleAddPhotos}
                onError={setPhotoError}
              />

              {photos.length > 1 && (
                <p className="mt-2 text-xs text-slate/50">Drag to reorder — the first photo is the cover.</p>
              )}
              {errors.photo && (
                <p className={errorClasses}>{errors.photo}</p>
              )}
            </div>
          </section>

          {/* ---- Submit Error ---- */}
          {errors.submit && (
            <p className="text-red-600 text-sm text-center">{errors.submit}</p>
          )}

          {/* ---- Submit Button ---- */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-terracotta text-white font-medium py-4 rounded-lg hover:bg-terracotta-dark transition-colors text-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Submitting..." : "Submit Recipe"}
          </button>
        </form>
      </div>
      {showPrompt && <UnsavedChangesModal onLeave={confirmLeave} onStay={cancelLeave} />}
    </main>
  );
}
