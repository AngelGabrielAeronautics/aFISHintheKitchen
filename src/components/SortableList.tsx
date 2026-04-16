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
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface SortableItemProps {
  id: string;
  index: number;
  value: string;
  onChange: (value: string) => void;
  onRemove: () => void;
  canRemove: boolean;
  placeholder: string;
  multiline?: boolean;
  inputClasses: string;
  imageUrl?: string;
  onImageSelect?: (file: File) => void;
  onImageRemove?: () => void;
}

function SortableItem({ id, index, value, onChange, onRemove, canRemove, placeholder, multiline, inputClasses, imageUrl, onImageSelect, onImageRemove }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : undefined,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className={`flex items-start gap-1.5 ${isDragging ? "shadow-lg rounded-lg" : ""}`}>
      {/* Drag handle */}
      <button
        type="button"
        aria-label="Drag to reorder"
        className="mt-2.5 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-2 text-slate/30 hover:text-slate/60 transition-colors"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Step number for instructions (skip for section headers) */}
      {multiline && !value.startsWith("## ") && (
        <span className="flex-shrink-0 w-6 mt-3 text-center text-sm font-medium text-slate/50">
          {index + 1}.
        </span>
      )}

      {/* Input + optional image */}
      <div className="flex-1">
        {value.startsWith("## ") ? (
          <input
            type="text"
            value={value.slice(3)}
            onChange={(e) => onChange(`## ${e.target.value}`)}
            placeholder="Section name (e.g. For the Crust)"
            className={`${inputClasses} w-full !font-semibold !text-charcoal !bg-cream-dark/20 !border-terracotta/30`}
          />
        ) : multiline ? (
          <textarea
            rows={2}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${inputClasses} w-full resize-none`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${inputClasses} w-full`}
          />
        )}

        {/* Step image */}
        {multiline && onImageSelect && (
          <div className="mt-1.5">
            {imageUrl ? (
              <div className="relative inline-block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imageUrl} alt={`Step ${index + 1}`} className="h-16 w-24 rounded-lg object-cover ring-1 ring-cream-dark/30" />
                {onImageRemove && (
                  <button
                    type="button"
                    onClick={onImageRemove}
                    aria-label="Remove image"
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-charcoal/70 hover:bg-charcoal rounded-full flex items-center justify-center text-white cursor-pointer"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            ) : (
              <label className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-slate/40 hover:text-slate/70 hover:bg-cream-dark/20 transition-colors cursor-pointer">
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 0 1 3.25 3h13.5A2.25 2.25 0 0 1 19 5.25v9.5A2.25 2.25 0 0 1 16.75 17H3.25A2.25 2.25 0 0 1 1 14.75v-9.5Zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 0 0 .75-.75v-2.69l-2.22-2.219a.75.75 0 0 0-1.06 0l-1.91 1.909-4.97-4.969a.75.75 0 0 0-1.06 0L2.5 11.06ZM12 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z" clipRule="evenodd" />
                </svg>
                Add photo
                <input type="file" accept="image/*" onChange={(e) => { if (e.target.files?.[0]) onImageSelect(e.target.files[0]); }} className="hidden" />
              </label>
            )}
          </div>
        )}
      </div>

      {/* Remove */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove item"
          className="flex-shrink-0 mt-2 w-8 h-8 flex items-center justify-center rounded-lg text-slate/30 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

interface SortableListProps {
  items: string[];
  onReorder: (items: string[]) => void;
  onUpdate: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  placeholderPrefix: string;
  addLabel: string;
  multiline?: boolean;
  inputClasses: string;
  images?: Record<string, string>;
  onImageSelect?: (index: number, file: File) => void;
  onImageRemove?: (index: number) => void;
  onAddSection?: () => void;
}

export default function SortableList({
  items,
  onReorder,
  onUpdate,
  onAdd,
  onRemove,
  placeholderPrefix,
  addLabel,
  multiline = false,
  inputClasses,
  images,
  onImageSelect,
  onImageRemove,
  onAddSection,
}: SortableListProps) {
  const itemIds = items.map((_, i) => `item-${i}`);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = itemIds.indexOf(active.id as string);
    const newIndex = itemIds.indexOf(over.id as string);

    const newItems = arrayMove(items, oldIndex, newIndex);
    onReorder(newItems);
  }

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((item, index) => (
              <SortableItem
                key={itemIds[index]}
                id={itemIds[index]}
                index={index}
                value={item}
                onChange={(val) => onUpdate(index, val)}
                onRemove={() => onRemove(index)}
                canRemove={items.length > 1}
                placeholder={`${placeholderPrefix} ${index + 1}`}
                multiline={multiline}
                inputClasses={inputClasses}
                imageUrl={images?.[String(index)]}
                onImageSelect={onImageSelect ? (file) => onImageSelect(index, file) : undefined}
                onImageRemove={onImageRemove ? () => onImageRemove(index) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="flex gap-4 mt-3">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex items-center gap-2 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {addLabel}
        </button>
        {onAddSection && (
          <button
            type="button"
            onClick={onAddSection}
            className="inline-flex items-center gap-2 text-sm font-medium text-slate hover:text-charcoal transition-colors cursor-pointer"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
            </svg>
            Add Section
          </button>
        )}
      </div>
    </>
  );
}
