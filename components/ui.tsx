import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

// 짧은 글자 옆에 붙이는 영어: "한국어 / English". 바탕색과 상관없이 보이게 색 대신 흐리기로 낮춘다
export function En({ children }: { children: ReactNode }) {
  return <span className="font-normal opacity-70"> / {children}</span>;
}

// 긴 글 아래에 붙이는 영어 한 줄
export function EnLine({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('mt-0.5 block text-[0.88em] leading-snug opacity-70', className)}>{children}</span>;
}

// 칸 이름처럼 작게 대문자로 깔리는 글씨
export const labelText = 'font-mono text-[10px] uppercase tracking-[.16em] text-ink-3';

const focusRing = 'focus-visible:outline-2 focus-visible:outline-brass';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary';
}

export function Button({ variant = 'default', className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'cursor-pointer rounded-[3px] border px-4 py-2 text-sm/[1.6] transition-colors focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-40',
        focusRing,
        variant === 'primary'
          ? 'border-brass bg-brass font-semibold text-panel enabled:hover:border-brass-hi enabled:hover:bg-brass-hi'
          : 'border-line bg-panel text-ink enabled:hover:border-ink-3 enabled:hover:bg-panel-2',
        className,
      )}
      {...props}
    />
  );
}

// 붙어 있는 버튼 묶음. 고른 칸만 놋쇠색으로 칠한다
export function Seg({ label, role = 'group', children }: { label: string; role?: string; children: ReactNode }) {
  return (
    <div role={role} aria-label={label} className="flex overflow-hidden rounded-[3px] border border-line bg-panel">
      {children}
    </div>
  );
}

interface SegButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected: boolean;
}

export function SegButton({ selected, className, ...props }: SegButtonProps) {
  return (
    <button
      className={cn(
        'cursor-pointer border-l border-line px-3 py-[7px] font-mono text-[13px] transition-colors first:border-l-0 focus-visible:-outline-offset-2',
        focusRing,
        selected ? 'bg-brass font-medium text-panel' : 'text-ink-2 hover:bg-panel-2 hover:text-ink',
        className,
      )}
      {...props}
    />
  );
}
