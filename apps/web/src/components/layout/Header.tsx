import React from 'react';
import { Button } from '@/components/ui/button';
import { UserMenu } from './UserMenu';

interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

export function Header({ title, actions }: HeaderProps) {
  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4">
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="flex items-center space-x-2">
          {actions}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
