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
}

function SortableItem({ id, index, value, onChange, onRemove, canRemove, placeholder, multiline, inputClasses }: SortableItemProps) {
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
        className="mt-3 flex-shrink-0 cursor-grab active:cursor-grabbing touch-none p-1 text-slate/30 hover:text-slate/60 transition-colors"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
          <path fillRule="evenodd" d="M2 4.75A.75.75 0 0 1 2.75 4h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 4.75Zm0 5A.75.75 0 0 1 2.75 9h14.5a.75.75 0 0 1 0 1.5H2.75A.75.75 0 0 1 2 9.75Zm0 5a.75.75 0 0 1 .75-.75h14.5a.75.75 0 0 1 0 1.5H2.75a.75.75 0 0 1-.75-.75Z" clipRule="evenodd" />
        </svg>
      </button>

      {/* Step number for instructions */}
      {multiline && (
        <span className="flex-shrink-0 w-6 mt-3 text-center text-sm font-medium text-slate/50">
          {index + 1}.
        </span>
      )}

      {/* Input */}
      {multiline ? (
        <textarea
          rows={2}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClasses} flex-1 resize-none`}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClasses} flex-1`}
        />
      )}

      {/* Remove */}
      {canRemove && (
        <button
          type="button"
          onClick={onRemove}
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
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 text-sm font-medium text-terracotta hover:text-terracotta-dark transition-colors cursor-pointer mt-3"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        {addLabel}
      </button>
    </>
  );
}
