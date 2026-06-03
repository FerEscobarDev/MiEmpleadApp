import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Button del Design System (design_system.md §3 — Button).
// Variantes: primary | secondary | ghost | danger | link. Tamaños sm | md | lg.
// Estados: foco visible, disabled, loading (deshabilitado + aria-busy).
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-sm rounded-md font-bodyStrong " +
    "text-body font-semibold transition-colors focus-visible:outline-none " +
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-background disabled:pointer-events-none " +
    "disabled:opacity-50 motion-reduce:transition-none",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground hover:bg-primary-hover",
        secondary: "bg-surface-muted text-foreground border border-border hover:bg-border",
        ghost: "bg-transparent text-foreground hover:bg-surface-muted",
        danger: "bg-error text-white hover:opacity-90",
        link: "bg-transparent text-primary underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-9 px-md text-caption",
        md: "h-11 px-lg",
        lg: "h-12 px-xl text-body",
      },
      iconOnly: {
        true: "aspect-square p-0",
        false: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md", iconOnly: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, variant, size, iconOnly, asChild = false, loading = false, disabled, children, ...props },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, iconOnly }), className)}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
