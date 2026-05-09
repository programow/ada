import { cn } from '@/lib/utils';
import { Slot } from '@radix-ui/react-slot';
import { type VariantProps, cva } from 'class-variance-authority';
import * as React from 'react';

const buttonVariants = cva(
    'inline-flex items-center justify-center whitespace-nowrap border-3 border-border font-bold uppercase tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:pointer-events-none disabled:opacity-50',
    {
        variants: {
            variant: {
                default:
                    'bg-main text-main-foreground shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
                outline:
                    'bg-bg text-fg shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
                ghost: 'border-transparent shadow-none hover:bg-main/30',
                destructive:
                    'bg-red-400 text-fg shadow-neo hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none',
            },
            size: {
                default: 'h-10 px-4 py-2 text-sm',
                sm: 'h-8 px-3 text-xs',
                lg: 'h-12 px-6 text-base',
                icon: 'h-10 w-10 p-0',
            },
        },
        defaultVariants: { variant: 'default', size: 'default' },
    },
);

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
        VariantProps<typeof buttonVariants> {
    asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : 'button';
        return (
            <Comp
                ref={ref}
                className={cn(buttonVariants({ variant, size, className }))}
                {...props}
            />
        );
    },
);
Button.displayName = 'Button';

export { Button, buttonVariants };
