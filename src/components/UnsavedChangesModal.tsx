"use client";

interface UnsavedChangesModalProps {
  onLeave: () => void;
  onStay: () => void;
}

export default function UnsavedChangesModal({ onLeave, onStay }: UnsavedChangesModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-charcoal/60 backdrop-blur-sm" onClick={onStay} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-charcoal/10">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-gold-light/30">
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-7 w-7 text-gold">
            <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-center font-serif text-xl font-bold text-charcoal">
          Unsaved Changes
        </h3>
        <p className="mt-2 text-center font-sans text-sm text-slate">
          You have unsaved changes that will be lost if you leave this page.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onStay}
            className="flex-1 rounded-lg bg-terracotta px-4 py-3 font-sans text-sm font-medium text-white transition-colors hover:bg-terracotta-dark cursor-pointer"
          >
            Stay & Save
          </button>
          <button
            onClick={onLeave}
            className="flex-1 rounded-lg border border-cream-dark px-4 py-3 font-sans text-sm font-medium text-slate transition-colors hover:bg-cream-dark/20 cursor-pointer"
          >
            Leave
          </button>
        </div>
      </div>
    </div>
  );
}
