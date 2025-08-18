import React from 'react';

interface MainProps {
  children: React.ReactNode;
  className?: string;
}

export function Main({ children, className }: MainProps) {
  return (
    <main className={`flex-1 overflow-y-auto ${className || ''}`}>
      {children}
    </main>
  );
}
