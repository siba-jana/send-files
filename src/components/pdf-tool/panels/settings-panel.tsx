"use client";

/**
 * PDF settings panel (Task 7).
 *
 * Card + accordion with five sections: page setup, typography, header & footer,
 * watermark, and file & metadata. Every control is wired straight into the
 * Zustand tool store — reads come from `config`, writes are partial patches
 * through `updateConfig`, and the header button restores the defaults via
 * `resetConfig`. A quick-preset row above the sections applies curated
 * configurations through `applyPreset`, and the header/footer text fields
 * offer one-click insertion of dynamic tokens that are expanded at render
 * time. There are no local mirrors of the config; the small `NumberField` /
 * `ColorField` components only buffer the text that is currently being typed
 * so editing stays smooth, and fall back to the store value as soon as the
 * field is left.
 */

import { useId, useState, type ReactNode } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  FileJson,
  FileText,
  PanelTop,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  Stamp,
  Type,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeHex } from "@/lib/pdf/colors";
import { sanitizeFilename } from "@/lib/pdf/filename";
import type {
  BaseFontId,
  MarginPresetId,
  Orientation,
  PageNumberFormat,
  PageNumberPosition,
  PageSizeId,
  WatermarkConfig,
} from "@/lib/pdf/types";
import { useToolStore, type PresetId } from "@/store/tool-store";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
 * Option catalogues — values must match the PdfConfig unions in lib/pdf/types.
 * ------------------------------------------------------------------------- */

const PAGE_SIZE_OPTIONS: ReadonlyArray<{ value: PageSizeId; label: string }> = [
  { value: "A4", label: "A4 (210 × 297 mm)" },
  { value: "A3", label: "A3 (297 × 420 mm)" },
  { value: "A5", label: "A5 (148 × 210 mm)" },
  { value: "LETTER", label: "Letter (216 × 279 mm)" },
  { value: "LEGAL", label: "Legal (216 × 356 mm)" },
  { value: "TABLOID", label: "Tabloid (279 × 432 mm)" },
  { value: "CUSTOM", label: "Custom size" },
];

const MARGIN_PRESET_OPTIONS: ReadonlyArray<{ value: MarginPresetId; label: string }> = [
  { value: "normal", label: "Normal" },
  { value: "narrow", label: "Narrow" },
  { value: "moderate", label: "Moderate" },
  { value: "wide", label: "Wide" },
  { value: "custom", label: "Custom" },
];

const BORDER_STYLE_OPTIONS: ReadonlyArray<{ value: "solid" | "dashed" | "dotted"; label: string }> = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
];

const FONT_FAMILY_OPTIONS: ReadonlyArray<{ value: BaseFontId; label: string }> = [
  { value: "Roboto", label: "Sans" },
  { value: "NotoSerif", label: "Serif" },
  { value: "NotoSansMono", label: "Monospace" },
];

const ALIGN_OPTIONS: ReadonlyArray<{ value: "left" | "center" | "right"; label: string }> = [
  { value: "left", label: "Left" },
  { value: "center", label: "Center" },
  { value: "right", label: "Right" },
];

const PAGE_NUMBER_POSITION_OPTIONS: ReadonlyArray<{ value: PageNumberPosition; label: string }> = [
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-center", label: "Bottom center" },
  { value: "bottom-right", label: "Bottom right" },
  { value: "top-left", label: "Top left" },
  { value: "top-center", label: "Top center" },
  { value: "top-right", label: "Top right" },
];

const PAGE_NUMBER_FORMAT_OPTIONS: ReadonlyArray<{ value: PageNumberFormat; label: string }> = [
  { value: "page", label: "Page 1" },
  { value: "pageOf", label: "Page 1 of 10" },
  { value: "slash", label: "1 / 10" },
  { value: "plain", label: "1" },
];

const WATERMARK_PLACEMENT_OPTIONS: ReadonlyArray<{
  value: WatermarkConfig["placement"];
  label: string;
}> = [
  { value: "diagonal", label: "Diagonal" },
  { value: "horizontal", label: "Horizontal" },
  { value: "custom", label: "Custom" },
];

const WATERMARK_POSITION_OPTIONS: ReadonlyArray<{ value: WatermarkConfig["position"]; label: string }> = [
  { value: "center", label: "Center" },
  { value: "top", label: "Top" },
  { value: "bottom", label: "Bottom" },
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const WATERMARK_PRESETS = ["DRAFT", "CONFIDENTIAL", "SAMPLE"] as const;

/** Dynamic tokens supported in header/footer text, in display order. */
const HEADER_FOOTER_TOKENS = ["{date}", "{time}", "{title}", "{page}", "{pages}"] as const;

/** One-click document presets rendered above the accordion sections. */
const DOCUMENT_PRESETS: ReadonlyArray<{ id: PresetId; label: string; description: string }> = [
  {
    id: "classic",
    label: "Classic",
    description: "Classic report — A4, serif body text, page numbers bottom center.",
  },
  {
    id: "compact",
    label: "Compact",
    description: "Compact — A4, narrow margins, tighter spacing, no page numbers.",
  },
  {
    id: "modern",
    label: "Modern",
    description: "Modern — A4, relaxed spacing, page numbers bottom right.",
  },
  {
    id: "letter",
    label: "US Letter",
    description: "US Letter — Letter paper, page numbers bottom center.",
  },
];

const ACCORDION_DEFAULT_OPEN = ["page", "typography", "headerfooter", "watermark", "metadata"];

/** Hex colours accepted by the color fields (#rgb or #rrggbb). */
const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/* ---------------------------------------------------------------------------
 * Small layout + field primitives, local to this panel.
 * ------------------------------------------------------------------------- */

/** Two-column section body; stacks to a single column below the sm breakpoint. */
function SectionGrid({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** Full-width nested group for conditional option blocks (custom size, border, …). */
function SubPanel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid gap-4 rounded-lg border bg-muted/30 p-4 sm:col-span-2 sm:grid-cols-2",
        className
      )}
    >
      {children}
    </div>
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  helperText?: string;
  className?: string;
  children: ReactNode;
}

/** Label above a control, with optional helper text below. */
function Field({ label, htmlFor, helperText, className, children }: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

interface TextFieldProps {
  label: string;
  value: string;
  placeholder?: string;
  helperText?: string;
  className?: string;
  onChange: (value: string) => void;
}

function TextField({
  label,
  value,
  placeholder,
  helperText,
  className,
  onChange,
}: TextFieldProps) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} helperText={helperText} className={className}>
      <Input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => onChange(event.target.value)}
      />
    </Field>
  );
}

interface SelectFieldProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onValueChange: (value: T) => void;
  className?: string;
  helperText?: string;
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onValueChange,
  className,
  helperText,
}: SelectFieldProps<T>) {
  const id = useId();
  return (
    <Field label={label} htmlFor={id} helperText={helperText} className={className}>
      <Select value={value} onValueChange={(next) => onValueChange(next as T)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  className?: string;
  helperText?: string;
}

/**
 * Number input that commits immediately but stays freely editable while
 * typing: the raw text is buffered in a local draft while the field is focused,
 * values are clamped to [min, max] before they are pushed, and once the field
 * is left (or the store changes externally, e.g. "Reset to defaults") the
 * display falls back to the store value again.
 */
function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  className,
  helperText,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Field label={label} htmlFor={id} helperText={helperText} className={className}>
      <Input
        id={id}
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        value={draft ?? String(value)}
        onChange={(event) => {
          const raw = event.target.value;
          setDraft(raw);
          if (raw.trim() === "") return;
          const parsed = Number.parseFloat(raw);
          if (Number.isNaN(parsed)) return;
          onChange(Math.min(max, Math.max(min, parsed)));
        }}
        onBlur={() => setDraft(null)}
      />
    </Field>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Unit rendered after the value, e.g. "pt". */
  unit?: string;
  /** Custom value formatter (overrides `unit`), e.g. for percentages. */
  format?: (value: number) => string;
  /** Accessible name for the slider; defaults to the visible label. */
  ariaLabel?: string;
  helperText?: string;
  className?: string;
  onChange: (value: number) => void;
}

function SliderField({
  label,
  value,
  min,
  max,
  step,
  unit,
  format,
  ariaLabel,
  helperText,
  className,
  onChange,
}: SliderFieldProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <Label>{label}</Label>
        <span className="tabular-nums text-sm text-muted-foreground">
          {format ? format(value) : `${value}${unit ? ` ${unit}` : ""}`}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(values) => onChange(values[0])}
        aria-label={ariaLabel ?? label}
      />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}

interface SwitchFieldProps {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  helperText?: string;
  className?: string;
}

function SwitchField({
  label,
  checked,
  onCheckedChange,
  helperText,
  className,
}: SwitchFieldProps) {
  const id = useId();
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <div className="flex flex-col gap-1">
        <Label htmlFor={id}>{label}</Label>
        {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
      </div>
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  helperText?: string;
}

/**
 * Color picker row: a native color swatch plus a hex text input, kept in sync.
 * Only valid hex values are written to the store, normalized to lowercase
 * 6-digit form; the text input buffers a local draft while it is focused so it
 * stays freely editable, and falls back to the store value once it is left.
 */
function ColorField({ label, value, onChange, className, helperText }: ColorFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <Field label={label} htmlFor={id} helperText={helperText} className={className}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} color picker`}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-input bg-transparent p-1"
          value={normalizeHex(value)}
          onChange={(event) => {
            const hex = event.target.value;
            setDraft(hex);
            onChange(hex);
          }}
        />
        <Input
          id={id}
          type="text"
          className="font-mono"
          value={draft ?? value}
          spellCheck={false}
          autoComplete="off"
          onChange={(event) => {
            const raw = event.target.value;
            setDraft(raw);
            const candidate = raw.trim();
            if (HEX_COLOR_PATTERN.test(candidate)) onChange(normalizeHex(candidate));
          }}
          onBlur={() => setDraft(null)}
        />
      </div>
    </Field>
  );
}

/**
 * Compact row of buttons that insert a dynamic token into the header or
 * footer text. The tokens are expanded at PDF render time (see lib/pdf/generate).
 */
function TokenChips({ onInsert, className }: { onInsert: (token: string) => void; className?: string }) {
  return (
    <div
      role="group"
      aria-label="Insert token"
      className={cn("flex flex-wrap items-center gap-1.5", className)}
    >
      <span className="text-xs text-muted-foreground">Insert token</span>
      {HEADER_FOOTER_TOKENS.map((token) => (
        <button
          key={token}
          type="button"
          title={`Insert ${token}`}
          className="rounded border bg-background px-1.5 py-0.5 font-mono text-xs text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-none"
          onClick={() => onInsert(token)}
        >
          {token}
        </button>
      ))}
    </div>
  );
}

/** Accordion section with an icon, heading and two-column body. */
function SettingsSection({
  value,
  icon: Icon,
  title,
  children,
}: {
  value: string;
  icon: LucideIcon;
  title: string;
  children: ReactNode;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>
        <span className="flex items-center gap-2">
          <Icon className="size-4 text-primary" aria-hidden="true" />
          {title}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <SectionGrid>{children}</SectionGrid>
      </AccordionContent>
    </AccordionItem>
  );
}

/* ---------------------------------------------------------------------------
 * The panel.
 * ------------------------------------------------------------------------- */

export function SettingsPanel() {
  const config = useToolStore((s) => s.config);
  const updateConfig = useToolStore((s) => s.updateConfig);
  const resetConfig = useToolStore((s) => s.resetConfig);
  const applyPreset = useToolStore((s) => s.applyPreset);

  return (
    <Card>
      <CardHeader>
        <CardTitle>PDF settings</CardTitle>
        <CardDescription>
          Adjust the document layout. The preview updates automatically.
        </CardDescription>
        <CardAction>
          <Button type="button" variant="ghost" size="sm" onClick={resetConfig}>
            <RotateCcw aria-hidden="true" />
            Reset to defaults
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-2 pb-4">
          <div className="flex flex-wrap items-center gap-2">
            <Label>Quick presets</Label>
            {DOCUMENT_PRESETS.map((preset) => (
              <Button
                key={preset.id}
                type="button"
                variant="outline"
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  applyPreset(preset.id);
                  toast.success("Preset applied", { description: preset.description });
                }}
              >
                {preset.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Presets reset page setup, typography, headers and page numbers — your text, file name, metadata and watermark are kept.
          </p>
        </div>
        <Accordion type="multiple" defaultValue={ACCORDION_DEFAULT_OPEN}>
          {/* ------------------------------------------------- Page setup */}
          <SettingsSection value="page" icon={FileText} title="Page setup">
            <SelectField
              label="Page size"
              options={PAGE_SIZE_OPTIONS}
              value={config.pageSize}
              onValueChange={(value) => updateConfig({ pageSize: value })}
            />

            <Field label="Orientation">
              <ToggleGroup
                type="single"
                variant="outline"
                className="w-full"
                aria-label="Page orientation"
                value={config.orientation}
                onValueChange={(value) => {
                  if (value) updateConfig({ orientation: value as Orientation });
                }}
              >
                <ToggleGroupItem value="portrait">
                  <RectangleVertical className="size-4" aria-hidden="true" />
                  Portrait
                </ToggleGroupItem>
                <ToggleGroupItem value="landscape">
                  <RectangleHorizontal className="size-4" aria-hidden="true" />
                  Landscape
                </ToggleGroupItem>
              </ToggleGroup>
            </Field>

            <SelectField
              label="Margins"
              options={MARGIN_PRESET_OPTIONS}
              value={config.marginPreset}
              onValueChange={(value) => updateConfig({ marginPreset: value })}
            />

            <ColorField
              label="Page background"
              value={config.backgroundColor}
              onChange={(value) => updateConfig({ backgroundColor: value })}
            />

            <SwitchField
              label="Page border"
              checked={config.pageBorder.enabled}
              onCheckedChange={(checked) => updateConfig({ pageBorder: { enabled: checked } })}
            />

            <SwitchField
              label="Keep headings with content"
              helperText="Prevents a heading from being separated from the paragraph below it"
              checked={config.keepHeadingsWithContent}
              onCheckedChange={(checked) => updateConfig({ keepHeadingsWithContent: checked })}
            />

            {config.pageSize === "CUSTOM" && (
              <SubPanel>
                <NumberField
                  label="Width (mm)"
                  value={config.customPageWidth}
                  min={30}
                  max={2000}
                  step={1}
                  onChange={(value) => updateConfig({ customPageWidth: value })}
                />
                <NumberField
                  label="Height (mm)"
                  value={config.customPageHeight}
                  min={30}
                  max={2000}
                  step={1}
                  onChange={(value) => updateConfig({ customPageHeight: value })}
                />
              </SubPanel>
            )}

            {config.marginPreset === "custom" && (
              <SubPanel>
                <NumberField
                  label="Top (mm)"
                  value={config.customMargins.top}
                  min={0}
                  max={80}
                  step={0.5}
                  onChange={(value) => updateConfig({ customMargins: { top: value } })}
                />
                <NumberField
                  label="Right (mm)"
                  value={config.customMargins.right}
                  min={0}
                  max={80}
                  step={0.5}
                  onChange={(value) => updateConfig({ customMargins: { right: value } })}
                />
                <NumberField
                  label="Bottom (mm)"
                  value={config.customMargins.bottom}
                  min={0}
                  max={80}
                  step={0.5}
                  onChange={(value) => updateConfig({ customMargins: { bottom: value } })}
                />
                <NumberField
                  label="Left (mm)"
                  value={config.customMargins.left}
                  min={0}
                  max={80}
                  step={0.5}
                  onChange={(value) => updateConfig({ customMargins: { left: value } })}
                />
              </SubPanel>
            )}

            {config.pageBorder.enabled && (
              <SubPanel>
                <ColorField
                  label="Border color"
                  value={config.pageBorder.color}
                  onChange={(value) => updateConfig({ pageBorder: { color: value } })}
                />
                <SelectField
                  label="Border style"
                  options={BORDER_STYLE_OPTIONS}
                  value={config.pageBorder.style}
                  onValueChange={(value) => updateConfig({ pageBorder: { style: value } })}
                />
                <SliderField
                  label="Border width"
                  ariaLabel="Page border width"
                  min={0.5}
                  max={5}
                  step={0.5}
                  unit="pt"
                  value={config.pageBorder.width}
                  onChange={(value) => updateConfig({ pageBorder: { width: value } })}
                  className="sm:col-span-2"
                />
                <SliderField
                  label="Border inset"
                  ariaLabel="Page border inset"
                  helperText="Distance of the border from the page edge"
                  min={0}
                  max={60}
                  step={1}
                  unit="pt"
                  value={config.pageBorder.inset}
                  onChange={(value) => updateConfig({ pageBorder: { inset: value } })}
                  className="sm:col-span-2"
                />
              </SubPanel>
            )}
          </SettingsSection>

          {/* ------------------------------------------------- Typography */}
          <SettingsSection value="typography" icon={Type} title="Typography">
            <SelectField
              label="Font family"
              options={FONT_FAMILY_OPTIONS}
              value={config.typography.fontFamily}
              onValueChange={(value) => updateConfig({ typography: { fontFamily: value } })}
            />

            <ColorField
              label="Text color"
              value={config.typography.textColor}
              onChange={(value) => updateConfig({ typography: { textColor: value } })}
            />

            <SliderField
              label="Font size"
              min={6}
              max={36}
              step={0.5}
              unit="pt"
              value={config.typography.fontSize}
              onChange={(value) => updateConfig({ typography: { fontSize: value } })}
              className="sm:col-span-2"
            />

            <SliderField
              label="Line height"
              min={1}
              max={3}
              step={0.05}
              value={config.typography.lineHeight}
              onChange={(value) => updateConfig({ typography: { lineHeight: value } })}
              className="sm:col-span-2"
            />

            <SliderField
              label="Paragraph spacing"
              min={0}
              max={48}
              step={1}
              unit="pt"
              value={config.typography.paragraphSpacing}
              onChange={(value) => updateConfig({ typography: { paragraphSpacing: value } })}
              className="sm:col-span-2"
            />

            <SliderField
              label="Letter spacing"
              min={0}
              max={3}
              step={0.1}
              unit="pt"
              value={config.typography.letterSpacing}
              onChange={(value) => updateConfig({ typography: { letterSpacing: value } })}
              className="sm:col-span-2"
            />

            <SwitchField
              label="First-line indent"
              helperText="Indents the first line of each paragraph"
              checked={config.typography.firstLineIndent}
              onCheckedChange={(checked) =>
                updateConfig({ typography: { firstLineIndent: checked } })
              }
              className="sm:col-span-2"
            />

            <SwitchField
              label="Table of contents"
              helperText="Adds a contents page with page numbers built from your H1–H3 headings."
              checked={config.tableOfContents.enabled}
              onCheckedChange={(checked) => updateConfig({ tableOfContents: { enabled: checked } })}
              className="sm:col-span-2"
            />

            {config.tableOfContents.enabled && (
              <SubPanel>
                <TextField
                  label="Contents title"
                  value={config.tableOfContents.title}
                  onChange={(value) => updateConfig({ tableOfContents: { title: value } })}
                  className="sm:col-span-2"
                />
              </SubPanel>
            )}
          </SettingsSection>

          {/* ------------------------------------------- Header & footer */}
          <SettingsSection value="headerfooter" icon={PanelTop} title="Header & footer">
            <SwitchField
              label="Header"
              checked={config.header.enabled}
              onCheckedChange={(checked) => updateConfig({ header: { enabled: checked } })}
              className="sm:col-span-2"
            />

            {config.header.enabled && (
              <SubPanel>
                <TextField
                  label="Header text"
                  placeholder="e.g. Report title"
                  helperText="Tokens such as {date} and {page} are expanded at render time."
                  value={config.header.text}
                  onChange={(value) => updateConfig({ header: { text: value } })}
                  className="sm:col-span-2"
                />
                <TokenChips
                  className="sm:col-span-2"
                  onInsert={(token) => updateConfig({ header: { text: config.header.text + token } })}
                />
                <SelectField
                  label="Alignment"
                  options={ALIGN_OPTIONS}
                  value={config.header.align}
                  onValueChange={(value) => updateConfig({ header: { align: value } })}
                />
                <ColorField
                  label="Color"
                  value={config.header.color}
                  onChange={(value) => updateConfig({ header: { color: value } })}
                />
                <SliderField
                  label="Font size"
                  ariaLabel="Header font size"
                  min={6}
                  max={24}
                  step={1}
                  unit="pt"
                  value={config.header.fontSize}
                  onChange={(value) => updateConfig({ header: { fontSize: value } })}
                  className="sm:col-span-2"
                />
                <SwitchField
                  label="Separator line below header"
                  checked={config.header.showBorder}
                  onCheckedChange={(checked) => updateConfig({ header: { showBorder: checked } })}
                  className="sm:col-span-2"
                />
              </SubPanel>
            )}

            <Separator className="sm:col-span-2" />

            <SwitchField
              label="Footer"
              checked={config.footer.enabled}
              onCheckedChange={(checked) => updateConfig({ footer: { enabled: checked } })}
              className="sm:col-span-2"
            />

            {config.footer.enabled && (
              <SubPanel>
                <TextField
                  label="Footer text"
                  placeholder="e.g. Company name"
                  helperText="Tokens such as {date} and {page} are expanded at render time."
                  value={config.footer.text}
                  onChange={(value) => updateConfig({ footer: { text: value } })}
                  className="sm:col-span-2"
                />
                <TokenChips
                  className="sm:col-span-2"
                  onInsert={(token) => updateConfig({ footer: { text: config.footer.text + token } })}
                />
                <SelectField
                  label="Alignment"
                  options={ALIGN_OPTIONS}
                  value={config.footer.align}
                  onValueChange={(value) => updateConfig({ footer: { align: value } })}
                />
                <ColorField
                  label="Color"
                  value={config.footer.color}
                  onChange={(value) => updateConfig({ footer: { color: value } })}
                />
                <SliderField
                  label="Font size"
                  ariaLabel="Footer font size"
                  min={6}
                  max={24}
                  step={1}
                  unit="pt"
                  value={config.footer.fontSize}
                  onChange={(value) => updateConfig({ footer: { fontSize: value } })}
                  className="sm:col-span-2"
                />
                <SwitchField
                  label="Separator line above footer"
                  checked={config.footer.showBorder}
                  onCheckedChange={(checked) => updateConfig({ footer: { showBorder: checked } })}
                  className="sm:col-span-2"
                />
              </SubPanel>
            )}

            <Separator className="sm:col-span-2" />

            <SwitchField
              label="Page numbers"
              checked={config.pageNumber.enabled}
              onCheckedChange={(checked) => updateConfig({ pageNumber: { enabled: checked } })}
              className="sm:col-span-2"
            />

            {config.pageNumber.enabled && (
              <SubPanel>
                <SelectField
                  label="Position"
                  options={PAGE_NUMBER_POSITION_OPTIONS}
                  value={config.pageNumber.position}
                  onValueChange={(value) => updateConfig({ pageNumber: { position: value } })}
                />
                <SelectField
                  label="Format"
                  options={PAGE_NUMBER_FORMAT_OPTIONS}
                  value={config.pageNumber.format}
                  onValueChange={(value) => updateConfig({ pageNumber: { format: value } })}
                />
                <SliderField
                  label="Font size"
                  ariaLabel="Page number font size"
                  min={6}
                  max={24}
                  step={1}
                  unit="pt"
                  value={config.pageNumber.fontSize}
                  onChange={(value) => updateConfig({ pageNumber: { fontSize: value } })}
                  className="sm:col-span-2"
                />
                <ColorField
                  label="Color"
                  value={config.pageNumber.color}
                  onChange={(value) => updateConfig({ pageNumber: { color: value } })}
                />
                <NumberField
                  label="Start numbering at"
                  helperText="The first page shows this number instead of 1."
                  value={config.pageNumber.startAt}
                  min={0}
                  max={9999}
                  step={1}
                  onChange={(value) => updateConfig({ pageNumber: { startAt: value } })}
                />
                <SwitchField
                  label="Hide on first page"
                  helperText="Useful for cover pages and title pages."
                  checked={config.pageNumber.hideOnFirstPage}
                  onCheckedChange={(checked) => updateConfig({ pageNumber: { hideOnFirstPage: checked } })}
                  className="sm:col-span-2"
                />
              </SubPanel>
            )}
          </SettingsSection>

          {/* ------------------------------------------------- Watermark */}
          <SettingsSection value="watermark" icon={Stamp} title="Watermark">
            <SwitchField
              label="Watermark"
              checked={config.watermark.enabled}
              onCheckedChange={(checked) => updateConfig({ watermark: { enabled: checked } })}
              className="sm:col-span-2"
            />

            <Field label="Quick presets" className="sm:col-span-2">
              <div className="flex flex-wrap gap-2">
                {WATERMARK_PRESETS.map((preset) => (
                  <Button
                    key={preset}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => updateConfig({ watermark: { text: preset } })}
                  >
                    {preset}
                  </Button>
                ))}
              </div>
            </Field>

            <TextField
              label="Watermark text"
              value={config.watermark.text}
              onChange={(value) => updateConfig({ watermark: { text: value } })}
              className="sm:col-span-2"
            />

            <SliderField
              label="Font size"
              ariaLabel="Watermark font size"
              min={12}
              max={120}
              step={1}
              unit="pt"
              value={config.watermark.fontSize}
              onChange={(value) => updateConfig({ watermark: { fontSize: value } })}
              className="sm:col-span-2"
            />

            <SliderField
              label="Opacity"
              ariaLabel="Watermark opacity"
              min={0.05}
              max={1}
              step={0.05}
              value={config.watermark.opacity}
              format={(value) => `${Math.round(value * 100)}%`}
              onChange={(value) => updateConfig({ watermark: { opacity: value } })}
              className="sm:col-span-2"
            />

            <SelectField
              label="Placement"
              options={WATERMARK_PLACEMENT_OPTIONS}
              value={config.watermark.placement}
              onValueChange={(value) => updateConfig({ watermark: { placement: value } })}
            />

            <SelectField
              label="Position"
              options={WATERMARK_POSITION_OPTIONS}
              value={config.watermark.position}
              onValueChange={(value) => updateConfig({ watermark: { position: value } })}
            />

            {config.watermark.placement === "custom" && (
              <SliderField
                label="Rotation angle"
                ariaLabel="Watermark rotation angle"
                min={-90}
                max={90}
                step={5}
                value={config.watermark.angle}
                format={(value) => `${value}°`}
                onChange={(value) => updateConfig({ watermark: { angle: value } })}
                className="sm:col-span-2"
              />
            )}

            <ColorField
              label="Color"
              value={config.watermark.color}
              onChange={(value) => updateConfig({ watermark: { color: value } })}
            />
          </SettingsSection>

          {/* ------------------------------------------ File & metadata */}
          <SettingsSection value="metadata" icon={FileJson} title="File & metadata">
            <TextField
              label="File name"
              value={config.filename}
              helperText={`Saved as: ${sanitizeFilename(config.filename)}`}
              onChange={(value) => updateConfig({ filename: value })}
              className="sm:col-span-2"
            />

            <TextField
              label="Document title"
              value={config.metadata.title}
              onChange={(value) => updateConfig({ metadata: { title: value } })}
            />

            <TextField
              label="Author"
              value={config.metadata.author}
              onChange={(value) => updateConfig({ metadata: { author: value } })}
            />

            <TextField
              label="Subject"
              value={config.metadata.subject}
              onChange={(value) => updateConfig({ metadata: { subject: value } })}
            />

            <TextField
              label="Keywords"
              placeholder="comma, separated, keywords"
              value={config.metadata.keywords}
              onChange={(value) => updateConfig({ metadata: { keywords: value } })}
            />

            <p className="text-xs text-muted-foreground sm:col-span-2">
              All fonts used in the document are embedded automatically, and the generated
              PDF contains selectable text.
            </p>
          </SettingsSection>
        </Accordion>
      </CardContent>
    </Card>
  );
}
