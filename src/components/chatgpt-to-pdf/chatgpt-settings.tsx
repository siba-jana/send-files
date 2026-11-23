"use client";

import React from "react";
import {
  Palette,
  Layout,
  Type,
  Check,
  RotateCcw,
} from "lucide-react";
import {
  DocumentSettings,
  DocumentTheme,
  PageSize,
  Orientation,
  MarginSize,
  BaseFontSize,
  DocumentFont,
  LineHeight,
  THEME_CONFIGS,
} from "./types";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

interface ChatGptSettingsProps {
  settings: DocumentSettings;
  onChange: (updated: DocumentSettings) => void;
  onResetDefaults?: () => void;
}

export function ChatGptSettings({
  settings,
  onChange,
  onResetDefaults,
}: ChatGptSettingsProps) {
  const updateSetting = <K extends keyof DocumentSettings>(
    key: K,
    val: DocumentSettings[K]
  ) => {
    onChange({ ...settings, [key]: val });
  };

  const themes: DocumentTheme[] = [
    "clean",
    "chatgpt",
    "modern",
    "academic",
    "minimal",
    "warm",
  ];

  return (
    <div className="space-y-6 text-sm">
      {/* 1. Theme Selection */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
            <Palette className="size-4 text-violet-600 dark:text-violet-400" />
            <span>Document Theme</span>
          </div>
          <span className="text-[11px] font-mono text-muted-foreground uppercase">
            {settings.theme}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {themes.map((t) => {
            const conf = THEME_CONFIGS[t];
            const isSelected = settings.theme === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => updateSetting("theme", t)}
                className={`relative flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${
                  isSelected
                    ? "border-violet-600 bg-violet-50/70 dark:border-violet-500 dark:bg-violet-950/30 ring-1 ring-violet-500/40 shadow-xs"
                    : "border-slate-200/90 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700 bg-card hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                }`}
              >
                <div
                  className="mt-0.5 size-4 rounded-full shrink-0 shadow-xs border border-black/10"
                  style={{ backgroundColor: conf.primaryColor }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground">
                      {conf.name}
                    </span>
                    {isSelected && (
                      <Check className="size-3.5 text-violet-600 dark:text-violet-400 stroke-[3]" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
                    {conf.description}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Paper & Page Size */}
      <div>
        <div className="mb-3 flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
          <Layout className="size-4 text-violet-600 dark:text-violet-400" />
          <span>Paper Size & Orientation</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <button
            type="button"
            onClick={() => updateSetting("pageSize", "a4")}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              settings.pageSize === "a4"
                ? "border-violet-600 bg-violet-50/70 dark:border-violet-500 dark:bg-violet-950/30 font-semibold text-violet-800 dark:text-violet-300 ring-1 ring-violet-500/40"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-800 bg-card text-muted-foreground"
            }`}
          >
            <div className="w-6 h-8 rounded border-2 border-current mb-1 opacity-70" />
            <span className="text-xs font-bold text-foreground">A4 Standard</span>
            <span className="text-[10px] text-muted-foreground">210 × 297 mm</span>
          </button>

          <button
            type="button"
            onClick={() => updateSetting("pageSize", "letter")}
            className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-all ${
              settings.pageSize === "letter"
                ? "border-violet-600 bg-violet-50/70 dark:border-violet-500 dark:bg-violet-950/30 font-semibold text-violet-800 dark:text-violet-300 ring-1 ring-violet-500/40"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-800 bg-card text-muted-foreground"
            }`}
          >
            <div className="w-7 h-8 rounded border-2 border-current mb-1 opacity-70" />
            <span className="text-xs font-bold text-foreground">US Letter</span>
            <span className="text-[10px] text-muted-foreground">8.5 × 11 inches</span>
          </button>
        </div>

        {/* Orientation Selector */}
        <div className="mt-3.5">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Orientation
          </span>
          <div className="grid grid-cols-2 gap-2">
            {(["portrait", "landscape"] as Orientation[]).map((ori) => (
              <Button
                key={ori}
                type="button"
                variant={settings.orientation === ori ? "default" : "outline"}
                size="sm"
                className={`h-8 text-xs font-medium capitalize ${
                  settings.orientation === ori
                    ? "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-500"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
                onClick={() => updateSetting("orientation", ori)}
              >
                {ori}
              </Button>
            ))}
          </div>
        </div>

        {/* Margins */}
        <div className="mt-3.5">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Print Margins
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: "compact", label: "Compact (12mm)" },
                { id: "normal", label: "Normal (20mm)" },
                { id: "wide", label: "Wide (28mm)" },
              ] as { id: MarginSize; label: string }[]
            ).map((m) => (
              <Button
                key={m.id}
                type="button"
                variant={settings.margin === m.id ? "default" : "outline"}
                size="sm"
                className={`h-8 text-xs font-medium ${
                  settings.margin === m.id
                    ? "bg-violet-600 hover:bg-violet-700 text-white dark:bg-violet-500"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
                onClick={() => updateSetting("margin", m.id)}
              >
                {m.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Typography & Sizing */}
      <div>
        <div className="mb-3 flex items-center gap-1.5 font-bold text-slate-900 dark:text-slate-100">
          <Type className="size-4 text-violet-600 dark:text-violet-400" />
          <span>Typography & Readability</span>
        </div>

        {/* Font Family */}
        <div className="mb-3.5">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Font Family
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "sans", label: "Modern Sans", sample: "Sans" },
              { id: "serif", label: "Formal Serif", sample: "Serif" },
              { id: "mono", label: "Code Mono", sample: "Mono" },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => updateSetting("fontFamily", f.id as DocumentFont)}
                className={`flex flex-col items-center justify-center rounded-xl border p-2 text-center transition-all ${
                  settings.fontFamily === f.id
                    ? "border-violet-600 bg-violet-50/70 dark:border-violet-500 dark:bg-violet-950/30 text-violet-800 dark:text-violet-300 ring-1 ring-violet-500/40"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-800 bg-card text-muted-foreground"
                }`}
              >
                <span
                  className={`text-sm font-bold ${
                    f.id === "serif"
                      ? "font-serif"
                      : f.id === "mono"
                      ? "font-mono"
                      : "font-sans"
                  }`}
                >
                  Aa
                </span>
                <span className="text-[11px] font-medium text-foreground">
                  {f.label}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Font Size */}
        <div className="mb-3.5">
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Base Font Size
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "sm", label: "Compact (13.5px)" },
              { id: "base", label: "Standard (15px)" },
              { id: "lg", label: "Large (16.5px)" },
            ].map((s) => (
              <Button
                key={s.id}
                type="button"
                variant={settings.fontSize === s.id ? "default" : "outline"}
                size="sm"
                className={`h-8 text-xs font-medium ${
                  settings.fontSize === s.id
                    ? "bg-violet-600 hover:bg-violet-700 text-white"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
                onClick={() => updateSetting("fontSize", s.id as BaseFontSize)}
              >
                {s.label}
              </Button>
            ))}
          </div>
        </div>

        {/* Line Height */}
        <div>
          <span className="text-xs font-medium text-muted-foreground mb-1.5 block">
            Line Spacing
          </span>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: "compact", label: "Tight" },
              { id: "normal", label: "Standard" },
              { id: "relaxed", label: "Spacious" },
            ].map((l) => (
              <Button
                key={l.id}
                type="button"
                variant={settings.lineHeight === l.id ? "default" : "outline"}
                size="sm"
                className={`h-8 text-xs font-medium ${
                  settings.lineHeight === l.id
                    ? "bg-violet-600 hover:bg-violet-700 text-white"
                    : "border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
                onClick={() => updateSetting("lineHeight", l.id as LineHeight)}
              >
                {l.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Page Numbering */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200/90 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50">
        <div>
          <Label
            htmlFor="chatgpt-page-numbers-switch"
            className="font-semibold text-xs text-foreground cursor-pointer"
          >
            Footer Page Numbering
          </Label>
          <p className="text-[11px] text-muted-foreground">
            Print &apos;Page 1 of X&apos; and site credit at document footer
          </p>
        </div>
        <Switch
          id="chatgpt-page-numbers-switch"
          checked={settings.showPageNumbers}
          onCheckedChange={(val) => updateSetting("showPageNumbers", val)}
        />
      </div>

      {/* Reset Defaults */}
      {onResetDefaults && (
        <div className="pt-2 text-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onResetDefaults}
            className="text-xs text-muted-foreground hover:text-foreground gap-1.5"
          >
            <RotateCcw className="size-3" />
            <span>Reset All Settings to Defaults</span>
          </Button>
        </div>
      )}
    </div>
  );
}
