"use client";
import { X } from "lucide-react";
import { Dialog as D, DropdownMenu as M, Switch as S, Tabs as T } from "radix-ui";
import * as React from "react";
import { cn } from "../cn";
import { Button } from "./button";

export const Dialog = D.Root;
export const DialogTrigger = D.Trigger;
export const DialogClose = D.Close;

/** Accessible dialog; on small screens it becomes a bottom sheet. */
export function DialogContent({ title, description, children, className, wide }: { title: string; description?: string; children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <D.Portal>
      <D.Overlay className="fixed inset-0 z-50 bg-navy/30 backdrop-blur-[2px] motion-safe:data-[state=open]:animate-[fade-in_150ms_ease-out]" />
      <D.Content
        className={cn(
          "fixed z-50 flex max-h-[88dvh] flex-col overflow-hidden bg-surface shadow-2xl focus:outline-none",
          "inset-x-0 bottom-0 rounded-t-3xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-[calc(100%-2rem)] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl",
          wide ? "sm:max-w-2xl" : "sm:max-w-lg",
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-soft px-5 pb-3 pt-5">
          <div className="min-w-0">
            <D.Title className="text-lg font-semibold text-ink">{title}</D.Title>
            {description ? <D.Description className="mt-0.5 text-sm text-ink-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
          </div>
          <D.Close aria-label="Close" className="-mr-2 -mt-1 inline-flex size-11 items-center justify-center rounded-full text-ink-muted hover:bg-black/5">
            <X className="size-5" aria-hidden />
          </D.Close>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </D.Content>
    </D.Portal>
  );
}

/** Confirmation for destructive or consequential actions. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  destructive,
  busy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title={title}>
        <p className="text-[15px] leading-relaxed text-ink-muted">{body}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant={destructive ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function Tabs({ value, onValueChange, defaultValue, children, className }: { value?: string; onValueChange?: (v: string) => void; defaultValue?: string; children: React.ReactNode; className?: string }) {
  return (
    <T.Root value={value} onValueChange={onValueChange} defaultValue={defaultValue} className={className}>
      {children}
    </T.Root>
  );
}

export function TabList({ children, label, className }: { children: React.ReactNode; label: string; className?: string }) {
  return (
    <T.List aria-label={label} className={cn("-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]", className)}>
      {children}
    </T.List>
  );
}

export function Tab({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) {
  return (
    <T.Trigger
      value={value}
      className={cn(
        "inline-flex min-h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm text-ink-muted transition-colors hover:bg-black/[0.04]",
        "data-[state=active]:bg-accent data-[state=active]:font-medium data-[state=active]:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
        className,
      )}
    >
      {children}
    </T.Trigger>
  );
}

export const TabPanel = ({ value, children, className }: { value: string; children: React.ReactNode; className?: string }) => (
  <T.Content value={value} className={cn("mt-4 focus-visible:outline-none", className)}>
    {children}
  </T.Content>
);

export function Switch({ checked, onCheckedChange, label, disabled, id }: { checked: boolean; onCheckedChange: (v: boolean) => void; label: string; disabled?: boolean; id?: string }) {
  return (
    <S.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={label}
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full bg-[#d8d3cc] transition-colors data-[state=checked]:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
    >
      <S.Thumb className="block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-6" />
    </S.Root>
  );
}

export const Menu = M.Root;
export const MenuTrigger = M.Trigger;
export function MenuContent({ children, align = "end" }: { children: React.ReactNode; align?: "start" | "end" }) {
  return (
    <M.Portal>
      <M.Content align={align} sideOffset={6} className="z-50 min-w-48 rounded-2xl border border-border-soft bg-surface p-1.5 shadow-xl">
        {children}
      </M.Content>
    </M.Portal>
  );
}
export function MenuItem({ children, onSelect, destructive }: { children: React.ReactNode; onSelect?: () => void; destructive?: boolean }) {
  return (
    <M.Item
      onSelect={onSelect}
      className={cn("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl px-3 text-sm outline-none data-[highlighted]:bg-surface-muted", destructive ? "text-danger" : "text-ink")}
    >
      {children}
    </M.Item>
  );
}
