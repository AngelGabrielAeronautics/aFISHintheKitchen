"use client";

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import Link from "next/link";
import { CATEGORIES, FAMILY_MEMBERS } from "@/lib/types";
import type { Category, Protein, HeatLevel } from "@/lib/types";
import { HEAT_LABELS } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import SortableList from "@/components/SortableList";
import { addRecipe, uploadRecipeImage } from "@/lib/firebase-recipes";

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

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category | "">("");
  const [difficulty, setDifficulty] = useState<
    "Easy" | "Medium" | "Hard" | ""
  >("");
  const [protein, setProtein] = useState<Protein | "">("");
  const [heat, setHeat] = useState<HeatLevel | "">("");
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
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

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

  // --- Photo helpers ---
  function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, photo: "Please select an image file." }));
      return;
    }
    if (photoFiles.length >= 5) {
      setErrors((prev) => ({ ...prev, photo: "Maximum 5 images allowed." }));
      return;
    }
    setErrors((prev) => {
      const next = { ...prev };
      delete next.photo;
      return next;
    });
    setPhotoFiles((prev) => [...prev, file]);
    const reader = new FileReader();
    reader.onload = (e) => setPhotoPreviews((prev) => [...prev, e.target?.result as string]);
    reader.readAsDataURL(file);
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    handlePhotoSelect(e.target.files?.[0]);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    handlePhotoSelect(e.dataTransfer.files?.[0]);
  }

  function removePhoto(index: number) {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  // --- Validation ---
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

      // Upload images if provided
      const imageUrls: string[] = [];
      for (const file of photoFiles) {
        const url = await uploadRecipeImage(file, slugFromTitle);
        imageUrls.push(url);
      }

      // Build recipe data
      const recipeData: Parameters<typeof addRecipe>[0] = {
        title,
        description,
        category: category as Category,
        difficulty: difficulty as "Easy" | "Medium" | "Hard",
        protein: protein as Protein,
        heat: heat || undefined,
        prepTime: Number(prepTime),
        cookTime: Number(cookTime),
        servings: Number(servings),
        image: imageUrls[0] || "",
        images: imageUrls.length > 0 ? imageUrls : undefined,
        contributedBy,
        story: story || undefined,
        originalSource: originalSource || undefined,
        ingredients: ingredients.filter((i) => i.trim()),
        instructions: instructions.filter((i) => i.trim()),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        featured: false,
      };

      const savedRecipe = await addRecipe(recipeData);
      setSavedSlug(savedRecipe.slug);
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit recipe:", error);
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
    setPrepTime("");
    setCookTime("");
    setServings("");
    setContributedBy(user?.displayName || "");
    setStory("");
    setOriginalSource("");
    setIngredients([...INITIAL_INGREDIENTS]);
    setInstructions([...INITIAL_INSTRUCTIONS]);
    setTags("");
    setPhotoFiles([]);
    setPhotoPreviews([]);
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
      <main className="min-h-screen bg-cream py-16 px-4">
        <div className="max-w-md mx-auto flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-terracotta" />
        </div>
      </main>
    );
  }

  // --- Not signed in ---
  if (!user) {
    return (
      <main className="min-h-screen bg-cream py-16 px-4">
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
      <main className="min-h-screen bg-cream py-16 px-4">
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
                  <option value="poultry">Poultry</option>
                  <option value="lamb">Lamb</option>
                  <option value="pork">Pork</option>
                  <option value="seafood">Seafood</option>
                  <option value="eggs">Eggs</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="vegan">Vegan</option>
                  <option value="mixed">Mixed</option>
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
              Ingredients
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
            />

            {errors.ingredients && (
              <p className={errorClasses}>{errors.ingredients}</p>
            )}
          </section>

          {/* ---- Section: Instructions ---- */}
          <section className="space-y-5">
            <h2 className="font-serif text-xl text-charcoal border-b border-gold-light pb-2">
              Instructions
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
              inputClasses={inputClasses}
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

            {/* Photo Upload — up to 3 */}
            <div>
              <label className={labelClasses}>
                Recipe Photos{" "}
                <span className="text-slate/50 font-normal">(up to 5)</span>
              </label>

              {/* Existing previews */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {photoPreviews.map((preview, index) => (
                    <div key={index} className="relative rounded-lg overflow-hidden border border-gold-light">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={preview}
                        alt={`Recipe photo ${index + 1}`}
                        className="w-full h-32 object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload zone — show if under 3 photos */}
              {photoFiles.length < 5 && (
                <label
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    isDragging
                      ? "border-terracotta bg-terracotta-light/20"
                      : "border-gold-light bg-warm-white hover:border-terracotta/50"
                  }`}
                >
                  <svg className="w-8 h-8 text-slate/40 mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                  <p className="text-xs text-slate/60">
                    {photoFiles.length === 0 ? "Add photos" : `Add another (${5 - photoFiles.length} remaining)`}{" "}
                    — <span className="text-terracotta font-medium">browse</span>
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
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
    </main>
  );
}
