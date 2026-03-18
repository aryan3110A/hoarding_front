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

  return (
    <div className="relative" ref={rootRef}>
      <input
        ref={inputRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
      />

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
                filteredOptions.map((item) => (
                  <button
                    type="button"
                    key={item}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onChange(item);
                      setOpen(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
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
