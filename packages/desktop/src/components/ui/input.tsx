import { cn } from '@/lib/utils';
import * as React from 'react';

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
    ({ className, type, ...props }, ref) => (
        <input
            ref={ref}
            type={type}
            className={cn(
                'flex h-10 w-full border-3 border-border bg-bg px-3 py-2 text-sm font-medium shadow-neo placeholder:text-fg/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        />
    ),
);
Input.displayName = 'Input';

export { Input };
