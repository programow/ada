import { cn } from '@/lib/utils';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import * as React from 'react';

const Switch = React.forwardRef<
    React.ElementRef<typeof SwitchPrimitive.Root>,
    React.ComponentPropsWithoutRef<typeof SwitchPrimitive.Root>
>(({ className, ...props }, ref) => (
    <SwitchPrimitive.Root
        ref={ref}
        className={cn(
            'peer inline-flex h-6 w-11 shrink-0 cursor-pointer items-center border-3 border-border bg-bg shadow-neo transition-colors',
            'data-[state=checked]:bg-main data-[state=unchecked]:bg-bg',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
        )}
        {...props}
    >
        <SwitchPrimitive.Thumb
            className={cn(
                'pointer-events-none block h-4 w-4 border-2 border-border bg-main-foreground transition-transform',
                'data-[state=checked]:translate-x-5 data-[state=unchecked]:translate-x-0.5',
            )}
        />
    </SwitchPrimitive.Root>
));
Switch.displayName = SwitchPrimitive.Root.displayName;

export { Switch };
