import { cn } from '@/lib/utils';
import { type VariantProps, cva } from 'class-variance-authority';
import type * as React from 'react';

const badgeVariants = cva(
    'inline-flex items-center border-3 border-border px-2.5 py-0.5 text-xs font-bold uppercase tracking-widest shadow-neo',
    {
        variants: {
            variant: {
                default: 'bg-main text-main-foreground',
                outline: 'bg-bg text-fg',
                muted: 'bg-bg text-fg/70 shadow-none',
            },
        },
        defaultVariants: { variant: 'default' },
    },
);

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
        VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
    return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
