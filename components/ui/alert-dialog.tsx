"use client";
import * as React from "react";
import * as Primitive from "@radix-ui/react-alert-dialog";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export const AlertDialog = Primitive.Root;
export const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof Primitive.Content>,
  React.ComponentPropsWithoutRef<typeof Primitive.Content>
>(({ className, ...props }, ref) => (
  <Primitive.Portal>
    <Primitive.Overlay className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-[2px]" />
    <Primitive.Content ref={ref} className={cn(
      "fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-32px)] max-w-[460px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-sm border bg-white p-6 shadow-xl", className,
    )} {...props} />
  </Primitive.Portal>
));
AlertDialogContent.displayName = "AlertDialogContent";
export const AlertDialogTitle = React.forwardRef<React.ElementRef<typeof Primitive.Title>, React.ComponentPropsWithoutRef<typeof Primitive.Title>>(({ className, ...props }, ref) => (
  <Primitive.Title ref={ref} className={cn("text-xl font-semibold", className)} {...props} />
));
AlertDialogTitle.displayName = "AlertDialogTitle";
export const AlertDialogDescription = React.forwardRef<React.ElementRef<typeof Primitive.Description>, React.ComponentPropsWithoutRef<typeof Primitive.Description>>(({ className, ...props }, ref) => (
  <Primitive.Description ref={ref} className={cn("mt-2 text-sm leading-6", className)} {...props} />
));
AlertDialogDescription.displayName = "AlertDialogDescription";
export const AlertDialogCancel = React.forwardRef<React.ElementRef<typeof Primitive.Cancel>, React.ComponentPropsWithoutRef<typeof Primitive.Cancel>>(({ className, ...props }, ref) => (
  <Primitive.Cancel ref={ref} className={cn(buttonVariants({ variant: "outline" }), "h-11 rounded-sm bg-white", className)} {...props} />
));
AlertDialogCancel.displayName = "AlertDialogCancel";
export const AlertDialogAction = React.forwardRef<React.ElementRef<typeof Primitive.Action>, React.ComponentPropsWithoutRef<typeof Primitive.Action>>(({ className, ...props }, ref) => (
  <Primitive.Action ref={ref} className={cn(buttonVariants({ variant: "destructive" }), "h-11 rounded-sm", className)} {...props} />
));
AlertDialogAction.displayName = "AlertDialogAction";
