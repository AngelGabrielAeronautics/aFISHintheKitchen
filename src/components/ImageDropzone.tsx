"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { IMAGE_ACCEPT_ATTR, partitionImageFiles } from "@/lib/image-utils";

interface ImageDropzoneProps {
  /** Current number of photos already added. */
  count: number;
  /** Maximum number of photos allowed. */
  max: number;
  /** Called with the accepted (valid, within-limit) image files. */
  onFiles: (files: File[]) => void;
  /** Called with a human-readable message when files are rejected, or null to clear. */
  onError: (message: string | null) => void;
}

export default function ImageDropzone({ count, max, onFiles, onError }: ImageDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  // Counter avoids the flicker where dragenter/dragleave fire as the cursor crosses child elements.
  const dragDepth = useRef(0);

  const remaining = max - count;
  if (remaining <= 0) return null;

  function process(fileList: FileList | null) {
    const files = fileList ? Array.from(fileList) : [];
    if (files.length === 0) return;
    const { accepted, error } = partitionImageFiles(files, remaining);
    onError(error);
    if (accepted.length > 0) {
      if (!error) onError(null);
      onFiles(accepted);
    }
  }

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setIsDragging(false);
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    process(e.dataTransfer.files);
  }

  function handleInput(e: ChangeEvent<HTMLInputElement>) {
    process(e.target.files);
    e.target.value = ""; // allow re-selecting the same file
  }

  return (
    <label
      onDragEnter={handleDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center w-full h-32 rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 ${
        isDragging
          ? "border-terracotta bg-terracotta-light/20 scale-[1.01] shadow-sm"
          : "border-gold-light bg-warm-white hover:border-terracotta/50"
      }`}
    >
      <svg
        className={`w-8 h-8 mb-2 transition-colors ${isDragging ? "text-terracotta" : "text-slate/40"}`}
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
      </svg>
      <p className="text-xs text-slate/60">
        {isDragging ? (
          <span className="text-terracotta font-medium">Drop to add</span>
        ) : (
          <>
            {count === 0 ? "Drag photos here or" : `Add another (${remaining} remaining) —`}{" "}
            <span className="text-terracotta font-medium">browse</span>
          </>
        )}
      </p>
      <input
        type="file"
        accept={IMAGE_ACCEPT_ATTR}
        multiple={remaining > 1}
        onChange={handleInput}
        className="hidden"
      />
    </label>
  );
}
