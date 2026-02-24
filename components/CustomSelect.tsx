"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  openDirection?: "down" | "up";
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  openDirection = "down",
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  useEffect(() => {
    function onDocDown(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      if (buttonRef.current?.contains(target)) return;
      if (ref.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  const computePosition = () => {
    const el = buttonRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const desiredWidth = rect.width;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, window.innerWidth - desiredWidth - margin),
    );

    const maxMenuHeight = 240;
    const minMenuHeight = 120;
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    const opensUp = openDirection === "up";
    const available = opensUp ? spaceAbove : spaceBelow;
    const maxHeight = Math.max(
      minMenuHeight,
      Math.min(maxMenuHeight, available - 16),
    );

    const top = opensUp
      ? Math.max(8, rect.top - maxHeight - 8)
      : Math.min(window.innerHeight - 8 - maxHeight, rect.bottom + 8);

    setPos({ top, left, width: desiredWidth, maxHeight });
  };

  useEffect(() => {
    if (!open) return;
    computePosition();

    const onScroll = () => computePosition();
    const onResize = () => computePosition();

    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, openDirection]);

  return (
    <div ref={ref} className={`relative w-full ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className={`h-10 w-full rounded-md border bg-white px-3 text-left text-sm shadow-sm transition ${open ? "border-sky-500 ring-2 ring-sky-500/30" : "border-slate-300"} hover:bg-slate-50`}
      >
        <span className="flex items-center justify-between gap-2">
          <span className="truncate text-slate-900">
            {selected ? selected.label : placeholder}
          </span>
          <span className="text-slate-500">▾</span>
        </span>
      </button>

      {open && typeof document !== "undefined" && pos
        ? createPortal(
            <div
              ref={menuRef}
              role="listbox"
              className="fixed z-[9999] overflow-auto rounded-md border border-slate-200 bg-white shadow-lg"
              style={{
                top: pos.top,
                left: pos.left,
                width: pos.width,
                maxHeight: pos.maxHeight,
              }}
            >
              {options.map((opt) => {
                const isSelected = String(opt.value) === String(value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setOpen(false);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${isSelected ? "bg-sky-50 text-sky-700" : "text-slate-700"} hover:bg-slate-50`}
                  >
                    <span className="truncate">{opt.label}</span>
                    {isSelected && <span className="text-sky-700">✓</span>}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
