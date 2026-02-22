"use client";

import React, { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, []);

  const selected = options.find((o) => String(o.value) === String(value));

  return (
    <div
      ref={ref}
      className={`cool-dropdown ${className}`}
      style={{ position: "relative", width: "100%" }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((s) => !s)}
        className="cool-dropdown-button"
      >
        <span style={{ flex: 1, textAlign: "left" }}>
          {selected ? selected.label : placeholder}
        </span>
        <span className="cool-dropdown-chevron">▾</span>
      </button>

      {open && (
        <ul
          role="listbox"
          tabIndex={-1}
          className={`cool-dropdown-list ${openDirection === "up" ? "cool-dropdown-list-up" : ""}`}
        >
          {options.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                className={`cool-dropdown-item ${isSelected ? "selected" : ""}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    onChange(opt.value);
                    setOpen(false);
                  }
                }}
                tabIndex={0}
              >
                {opt.label}
                {isSelected && <span className="cool-dropdown-check">✓</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
