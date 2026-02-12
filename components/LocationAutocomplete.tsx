"use client";

import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { locationsAPI } from "@/lib/api";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export default function LocationAutocomplete({
  value,
  onChange,
  placeholder,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<string[]>([]);
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

  const updateMenuRect = () => {
    const el = inputRef.current;
    if (!el) {
      setMenuRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    const top = r.bottom + 4;
    const viewportBottomGap = Math.max(120, window.innerHeight - top - 12);
    setMenuRect({
      top,
      left: r.left,
      width: r.width,
      maxHeight: Math.min(380, viewportBottomGap),
    });
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    const q = String(value || "").trim();
    if (q.length < 2) {
      setItems([]);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await locationsAPI.suggestions(q);
        const list = Array.isArray(resp?.data) ? resp.data : [];
        if (!cancelled) setItems(list.map((x: unknown) => String(x || "")));
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [value]);

  useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      const n = e.target as Node | null;
      if (!n) return;
      const inRoot = !!rootRef.current?.contains(n);
      const inMenu = !!menuRef.current?.contains(n);
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
  }, [open, value]);

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
              {loading ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  Loading...
                </div>
              ) : null}

              {!loading && items.length === 0 ? (
                <div className="px-3 py-2 text-xs text-slate-500">
                  No suggestions. You can enter a new location.
                </div>
              ) : null}

              {!loading
                ? items.map((item) => (
                    <button
                      type="button"
                      key={item}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        onChange(item);
                        setOpen(false);
                      }}
                      className="block w-full text-left px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {item}
                    </button>
                  ))
                : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
