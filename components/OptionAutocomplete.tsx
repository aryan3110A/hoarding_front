"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  className?: string;
  noResultsText?: string;
};

export default function OptionAutocomplete({
  value,
  onChange,
  options,
  placeholder,
  className,
  noResultsText = "No matches found.",
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const [portalReady, setPortalReady] = useState(false);
  const [menuRect, setMenuRect] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const normalizedValue = String(value || "").trim().toLowerCase();

  const filteredOptions = useMemo(() => {
    const unique = Array.from(
      new Set(
        (options || [])
          .map((item) => String(item || "").trim())
          .filter(Boolean),
      ),
    );

    if (!normalizedValue) return unique;
    return unique.filter((item) =>
      item.toLowerCase().includes(normalizedValue),
    );
  }, [normalizedValue, options]);

  const suggestion = useMemo(() => {
    if (!value || value.trim().length === 0) return null;
    return (
      filteredOptions.find((opt) =>
        opt.toLowerCase().startsWith(value.toLowerCase())
      ) || null
    );
  }, [value, filteredOptions]);

  const showGhost =
    suggestion && value && suggestion.toLowerCase() !== value.toLowerCase();

  const updateMenuRect = () => {
    const el = inputRef.current;
    if (!el) {
      setMenuRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    const top = rect.bottom + 4;
    const viewportBottomGap = Math.max(120, window.innerHeight - top - 12);
    setMenuRect({
      top,
      left: rect.left,
      width: rect.width,
      maxHeight: Math.min(380, viewportBottomGap),
    });
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      const inRoot = !!rootRef.current?.contains(target);
      const inMenu = !!menuRef.current?.contains(target);
      if (!inRoot && !inMenu) setOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuRect();

    const onScroll = () => updateMenuRect();
    const onResize = () => updateMenuRect();
    document.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, value, options]);

  useEffect(() => {
    setActiveIndex(-1);
  }, [filteredOptions]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) {
      if (e.key === "ArrowDown") {
        setOpen(true);
      }
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filteredOptions.length) {
        onChange(filteredOptions[activeIndex]);
        setOpen(false);
      } else if (suggestion) {
        onChange(suggestion);
        setOpen(false);
      }
    } else if (e.key === "Tab" || e.key === "ArrowRight") {
      if (suggestion) {
        e.preventDefault();
        onChange(suggestion);
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={rootRef}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={className}
        style={{
          position: "relative",
          zIndex: 2,
          background: "transparent",
        }}
      />

      {showGhost && suggestion && (
        <div
          className="absolute left-0 top-0 w-full h-full pointer-events-none flex items-center text-sm text-slate-400"
          style={{
            paddingLeft: "14px",
            paddingRight: "14px",
            fontFamily: "inherit",
            fontSize: "inherit",
            zIndex: 1,
            background: "#ffffff",
            borderRadius: "8px",
            border: "1px solid transparent",
          }}
        >
          <span style={{ color: "transparent" }}>{value}</span>
          <span>{suggestion.slice(value.length)}</span>
        </div>
      )}

      {portalReady && open && menuRect
        ? createPortal(
            <div
              ref={menuRef}
              className="fixed z-[9999] rounded-xl border border-slate-200 bg-white shadow-lg"
              onWheel={(e) => e.stopPropagation()}
              style={{
                top: menuRect.top,
                left: menuRect.left,
                width: menuRect.width,
                maxHeight: menuRect.maxHeight,
                overflowY: "auto",
              }}
            >
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  {noResultsText}
                </div>
              ) : (
                filteredOptions.map((item, idx) => (
                  <button
                    type="button"
                    key={item}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(item);
                      setOpen(false);
                    }}
                    className={`block w-full px-3 py-2 text-left text-sm ${
                      idx === activeIndex
                        ? "bg-sky-50 text-sky-700 font-semibold"
                        : "hover:bg-slate-50 text-slate-700"
                    }`}
                  >
                    {item}
                  </button>
                ))
              )}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
