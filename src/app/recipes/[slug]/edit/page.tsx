"use client";

import { useState, useEffect, type FormEvent, type ChangeEvent } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CATEGORIES, FAMILY_MEMBERS, SEASONS, type Season } from "@/lib/types";
import type { Category, Recipe, Protein, HeatLevel } from "@/lib/types";
import { HEAT_LABELS } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import DeleteModal from "@/components/DeleteModal";
import SortableList from "@/components/SortableList";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";
import UnsavedChangesModal from "@/components/UnsavedChangesModal";
import { useRouter } from "next/navigation";
import {
  getRecipeBySlug,
  updateRecipe,
  uploadRecipeImage,
  addEditLogEntry,
  addRecipe,
} from "@/lib/firebase-recipes";

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

export default function EditRecipePage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loadingRecipe, setLoadingRecipe] = useState(true);
  const [notFound, setNotFound] = useState(false);

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
  const [ingredients, setIngredients] = useState<string[]>([""]);
  const [instructions, setInstructions] = useState<string[]>([""]);
  const [tags, setTags] = useState("");
  const [stepImages, setStepImages] = useState<Record<string, string>>({});
  const [stepImageFiles, setStepImageFiles] = useState<Record<string, File>>({});
  const [videoUrl, setVideoUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [videoType, setVideoType] = useState<"link" | "upload">("link");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Warn on unsaved changes
  const isDirty = recipe !== null && (
    title !== recipe.title ||
    description !== recipe.description ||
    category !== recipe.category ||
    difficulty !== recipe.difficulty ||
    ingredients.filter(i => i.trim()).join() !== recipe.ingredients.join() ||
    instructions.filter(i => i.trim()).join() !== recipe.instructions.join() ||
    story !== (recipe.story || "") ||
    photoFiles.length > 0
  );
  const { showPrompt, confirmLeave, cancelLeave } = useUnsavedChanges(isDirty);

  // Fetch recipe on mount
  useEffect(() => {
    if (!slug) return;

    async function fetchRecipe() {
      setLoadingRecipe(true);
      try {
        const fetched = await getRecipeBySlug(slug);
        if (!fetched) {
          setNotFound(true);
          return;
        }
        setRecipe(fetched);

        // Pre-fill all fields
        setTitle(fetched.title);
        setDescription(fetched.description);
        setCategory(fetched.category);
        setDifficulty(fetched.difficulty);
        setProtein(fetched.protein || "");
        setHeat(fetched.heat || "");
        setSeasons(fetched.seasons || []);
        setStepImages(fetched.instructionImages || {});
        if (fetched.video) {
          setVideoUrl(fetched.video);
          // Detect if it's a YouTube link or an uploaded file URL
          if (fetched.video.includes("youtube") || fetched.video.includes("youtu.be") || fetched.video.includes("vimeo")) {
            setVideoType("link");
          } else {
            setVideoType("upload");
            setVideoPreview(fetched.video);
          }
        }
        setPrepTime(String(fetched.prepTime));
        setCookTime(String(fetched.cookTime));
        setServings(String(fetched.servings));
        setContributedBy(fetched.contributedBy);
        setStory(fetched.story || "");
        setOriginalSource(fetched.originalSource || "");
        setIngredients(
          fetched.ingredients.length > 0 ? [...fetched.ingredients] : [""]
        );
        setInstructions(
          fetched.instructions.length > 0 ? [...fetched.instructions] : [""]
        );
        setTags(fetched.tags.join(", "));
        if (fetched.images && fetched.images.length > 0) {
          setExistingImages(fetched.images);
        } else if (fetched.image) {
          setExistingImages([fetched.image]);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoadingRecipe(false);
      }
    }

    fetchRecipe();
  }, [slug]);

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
      setStepImages((prev) => ({ ...prev, [String(index)]: e.target?.result as string }));
      setStepImageFiles((prev) => ({ ...prev, [String(index)]: file }));
    };
    reader.readAsDataURL(file);
  }

  function handleStepImageRemove(index: number) {
    setStepImages((prev) => { const n = { ...prev }; delete n[String(index)]; return n; });
    setStepImageFiles((prev) => { const n = { ...prev }; delete n[String(index)]; return n; });
  }

  // --- Photo helpers ---
  const totalPhotos = existingImages.length + photoFiles.length;

  function handlePhotoSelect(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setErrors((prev) => ({ ...prev, photo: "Please select an image file." }));
      return;
    }
    if (totalPhotos >= 5) {
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

  function removeExistingImage(index: number) {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
  }

  function removeNewPhoto(index: number) {
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
      // Scroll to first error field
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
    if (!recipe || !validate()) return;

    setSubmitting(true);
    setErrors((prev) => {
      const next = { ...prev };
      delete next.submit;
      return next;
    });

    try {
      // Upload new images
      const newImageUrls: string[] = [];
      for (const file of photoFiles) {
        const url = await uploadRecipeImage(file, recipe.slug);
        newImageUrls.push(url);
      }
      const allImages = [...existingImages, ...newImageUrls];

      const recipeData: Record<string, unknown> = {
        title,
        description,
        category,
        difficulty,
        protein: protein || null,
        heat: heat || null,
        seasons: seasons.length > 0 ? seasons : [],
        prepTime: Number(prepTime),
        cookTime: Number(cookTime),
        servings: Number(servings),
        image: allImages[0] || "",
        images: allImages.length > 0 ? allImages : [],
        contributedBy,
        story: story || "",
        originalSource: originalSource || "",
        ingredients: ingredients.filter((i) => i.trim()),
        instructions: instructions.filter((i) => i.trim()),
        tags: tags
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
      };

      // Upload new step images
      const finalStepImages: Record<string, string> = {};
      for (const [idx, url] of Object.entries(stepImages)) {
        if (stepImageFiles[idx]) {
          // New file to upload
          finalStepImages[idx] = await uploadRecipeImage(stepImageFiles[idx], `${recipe.slug}/steps`);
        } else {
          // Existing URL
          finalStepImages[idx] = url;
        }
      }
      if (Object.keys(finalStepImages).length > 0) {
        recipeData.instructionImages = finalStepImages;
      } else {
        recipeData.instructionImages = {};
      }

      // Upload video if provided
      let finalVideoUrl = videoUrl.trim();
      if (videoFile) {
        finalVideoUrl = await uploadRecipeImage(videoFile, `${recipe.slug}/video`);
      }
      recipeData.video = finalVideoUrl || "";

      const editor = user?.displayName || user?.email || "Unknown";
      const isOriginalAuthor = editor === recipe.contributedBy;

      // Check if core recipe content changed
      const ingredientsChanged = ingredients.filter(i => i.trim()).join() !== recipe.ingredients.join();
      const instructionsChanged = instructions.filter(i => i.trim()).join() !== recipe.instructions.join();
      const coreChanged = ingredientsChanged || instructionsChanged;

      if (!isOriginalAuthor && coreChanged) {
        // Fork: create a new version of the recipe
        const versionTitle = `${recipe.title} — ${editor}'s Version`;
        const forkedData: Record<string, unknown> = {
          title: versionTitle,
          description,
          category,
          difficulty,
          prepTime: Number(prepTime),
          cookTime: Number(cookTime),
          servings: Number(servings),
          image: allImages[0] || "",
          images: allImages.length > 0 ? allImages : [],
          contributedBy: recipe.contributedBy,
          story: story || "",
          originalSource: originalSource || "",
          ingredients: ingredients.filter((i) => i.trim()),
          instructions: instructions.filter((i) => i.trim()),
          tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
          featured: false,
          forkedFrom: recipe.id,
          versionOf: recipe.title,
          versionAuthor: editor,
        };
        if (protein) forkedData.protein = protein;
        if (heat) forkedData.heat = heat;
        if (seasons.length > 0) forkedData.seasons = seasons;

        const forkedRecipe = await addRecipe(forkedData as Parameters<typeof addRecipe>[0]);

        // Log on the original recipe that a version was created
        await addEditLogEntry(recipe.id, {
          editor,
          date: new Date().toISOString(),
          summary: `Created "${versionTitle}" with updated ${ingredientsChanged && instructionsChanged ? "ingredients and instructions" : ingredientsChanged ? "ingredients" : "instructions"}`,
        });

        // Redirect to the new version
        router.push(`/recipes/${forkedRecipe.slug}`);
        return;
      }

      // Normal update — same author or minor changes
      await updateRecipe(recipe.id, recipeData as Partial<Omit<Recipe, "id" | "slug" | "createdAt">>);

      // Log the edit
      const changedFields: string[] = [];
      if (title !== recipe.title) changedFields.push("title");
      if (description !== recipe.description) changedFields.push("description");
      if (category !== recipe.category) changedFields.push("category");
      if (difficulty !== recipe.difficulty) changedFields.push("difficulty");
      if (ingredientsChanged) changedFields.push("ingredients");
      if (instructionsChanged) changedFields.push("instructions");
      if (allImages.join() !== (recipe.images || []).join()) changedFields.push("photos");
      if (story !== (recipe.story || "")) changedFields.push("story");

      if (changedFields.length > 0) {
        await addEditLogEntry(recipe.id, {
          editor,
          date: new Date().toISOString(),
          summary: `Updated ${changedFields.join(", ")}`,
        });
      }

      router.push(`/recipes/${recipe.slug}?saved=1`);
    } catch {
      setErrors((prev) => ({
        ...prev,
        submit:
          "Something went wrong updating your recipe. Please try again.",
      }));
    } finally {
      setSubmitting(false);
    }
  }

  // --- Shared input classes ---
  const inputClasses =
    "w-full bg-warm-white rounded-lg border border-gold-light px-4 py-3 text-charcoal placeholder:text-slate/50 focus:outline-none focus:ring-2 focus:ring-terracotta focus:border-terracotta transition-colors";
  const labelClasses = "block text-sm font-medium text-charcoal mb-1.5";
  const errorClasses = "text-red-600 text-sm mt-1";

  // --- Auth loading or recipe loading state ---
  if (authLoading || loadingRecipe) {
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
              Sign in to edit recipes
            </h2>
            <p className="text-slate mb-8">
              You need to be signed in to edit a recipe.
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

  // --- Recipe not found ---
  if (notFound || !recipe) {
    return (
      <main className="min-h-screen bg-cream py-8 sm:py-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-10 text-center">
            <h2 className="font-serif text-2xl text-charcoal mb-2">
              Recipe not found
            </h2>
            <p className="text-slate mb-8">
              We couldn&apos;t find the recipe you&apos;re looking for.
            </p>
            <Link
              href="/recipes"
              className="inline-block w-full bg-terracotta text-white font-medium py-3 rounded-lg hover:bg-terracotta-dark transition-colors text-center"
            >
              Back to recipes
            </Link>
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
          <Link
            href={`/recipes/${recipe.slug}`}
            className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-terracotta-dark transition-colors mb-4"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 19.5L8.25 12l7.5-7.5"
              />
            </svg>
            Back to recipe
          </Link>
          <h1 className="font-serif text-4xl text-charcoal mb-3">
            Edit Recipe
          </h1>
          <p className="text-slate text-lg">
            Update the details for {recipe.title}.
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
                  onChange={(e) => {
                    setDifficulty(e.target.value as "Easy" | "Medium" | "Hard");
                    setErrors((prev) => { const next = { ...prev }; delete next.difficulty; return next; });
                  }}
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
                  onChange={(e) => { setCategory(e.target.value as Category); setErrors((prev) => { const next = { ...prev }; delete next.category; return next; }); }}
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
                  onChange={(e) => { setProtein(e.target.value as Protein); setErrors((prev) => { const next = { ...prev }; delete next.protein; return next; }); }}
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
                onChange={(e) => { setContributedBy(e.target.value); setErrors((prev) => { const next = { ...prev }; delete next.contributedBy; return next; }); }}
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
              onAddSection={() => setIngredients((prev) => [...prev, "## "])}
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
              onAddSection={() => setInstructions((prev) => [...prev, "## "])}
              inputClasses={inputClasses}
              images={stepImages}
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

            {/* Photo Upload — up to 3 */}
            {/* Video */}
            <div>
              <label className={labelClasses}>
                Recipe Video{" "}
                <span className="text-slate/50 font-normal">(optional)</span>
              </label>

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
                        onClick={() => { setVideoFile(null); setVideoPreview(null); setVideoUrl(""); }}
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

            <div>
              <label className={labelClasses}>
                Recipe Photos{" "}
                <span className="text-slate/50 font-normal">(up to 5)</span>
              </label>

              {/* Existing + new previews */}
              {(existingImages.length > 0 || photoPreviews.length > 0) && (
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {existingImages.map((url, index) => (
                    <div key={`existing-${index}`} className="relative rounded-lg overflow-hidden border border-gold-light">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={`Recipe photo ${index + 1}`} className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeExistingImage(index)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {photoPreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative rounded-lg overflow-hidden border border-gold-light">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt={`New photo ${index + 1}`} className="w-full h-32 object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewPhoto(index)}
                        className="absolute top-1.5 right-1.5 w-6 h-6 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {totalPhotos < 5 && (
                <label
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
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
                    {totalPhotos === 0 ? "Add photos" : `Add another (${5 - totalPhotos} remaining)`}{" "}
                    — <span className="text-terracotta font-medium">browse</span>
                  </p>
                  <input type="file" accept="image/*" onChange={handleFileInput} className="hidden" />
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
          {/* Validation summary */}
          {Object.keys(errors).filter(k => k !== "submit" && k !== "photo").length > 0 && (
            <div className="mb-4 rounded-lg border border-red-300/30 bg-red-50 px-4 py-3 font-sans text-sm text-red-600">
              Please fix the highlighted fields above before saving.
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-terracotta text-white font-medium py-4 rounded-lg hover:bg-terracotta-dark transition-colors text-lg cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? "Saving..." : "Save Changes"}
          </button>
        </form>

        {/* Delete recipe */}
        <div className="mt-8 border-t border-cream-dark/30 pt-6">
          <button
            onClick={() => setShowDeleteModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-4 py-2 font-sans text-sm font-medium text-red-600 transition-colors hover:bg-red-500/20 cursor-pointer"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 0 0 6 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 1 0 .23 1.482l.149-.022.841 10.518A2.75 2.75 0 0 0 7.596 19h4.807a2.75 2.75 0 0 0 2.742-2.53l.841-10.52.149.023a.75.75 0 0 0 .23-1.482A41.03 41.03 0 0 0 14 4.193V3.75A2.75 2.75 0 0 0 11.25 1h-2.5ZM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4ZM8.58 7.72a.75.75 0 0 0-1.5.06l.3 7.5a.75.75 0 1 0 1.5-.06l-.3-7.5Zm4.34.06a.75.75 0 1 0-1.5-.06l-.3 7.5a.75.75 0 1 0 1.5.06l.3-7.5Z" clipRule="evenodd" />
            </svg>
            Delete Recipe
          </button>
        </div>

        {showDeleteModal && recipe && (
          <DeleteModal
            title={recipe.title}
            onConfirm={async () => {
              const { deleteRecipe } = await import("@/lib/firebase-recipes");
              await deleteRecipe(recipe.id);
              router.push("/recipes");
            }}
            onCancel={() => setShowDeleteModal(false)}
          />
        )}
        {showPrompt && <UnsavedChangesModal onLeave={confirmLeave} onStay={cancelLeave} />}
      </div>
    </main>
  );
}
