"use client";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  rectSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { RecipePhoto } from "@/lib/image-utils";

interface ImagePreviewGridProps {
  photos: RecipePhoto[];
  onReorder: (photos: RecipePhoto[]) => void;
  onRemove: (id: string) => void;
}

function PhotoTile({
  photo,
  index,
  onRemove,
}: {
  photo: RecipePhoto;
  index: number;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
  };

  const src = photo.kind === "existing" ? photo.url : photo.preview;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative rounded-lg overflow-hidden border border-gold-light select-none ${
        isDragging ? "opacity-80 shadow-lg" : ""
      }`}
    >
      {/* The image area is the drag handle. */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="block w-full cursor-grab active:cursor-grabbing touch-none"
        aria-label={`Drag to reorder photo ${index + 1}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`Recipe photo ${index + 1}`} className="w-full h-32 object-cover pointer-events-none" />
      </button>

      {index === 0 && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-terracotta text-white text-[10px] font-semibold tracking-wide shadow-sm">
          Cover
        </span>
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove photo ${index + 1}`}
        className="absolute top-1.5 right-1.5 w-6 h-6 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white transition-colors cursor-pointer"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ImagePreviewGrid({ photos, onReorder, onRemove }: ImagePreviewGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = photos.findIndex((p) => p.id === active.id);
    const newIndex = photos.findIndex((p) => p.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    onReorder(arrayMove(photos, oldIndex, newIndex));
  }

  if (photos.length === 0) return null;

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {photos.map((photo, index) => (
            <PhotoTile key={photo.id} photo={photo} index={index} onRemove={() => onRemove(photo.id)} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
