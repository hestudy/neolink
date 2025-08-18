import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { Main } from './Main';
import { Home, Settings, Bookmark } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title?: string;
}

const navigationItems = [
  { href: '/', label: '首页', icon: Home },
  { href: '/bookmarks', label: '书签', icon: Bookmark },
  { href: '/settings', label: '设置', icon: Settings },
];

export function Layout({ children, title = 'NeoLink' }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <Sidebar items={navigationItems} />
        <div className="flex-1 flex flex-col">
          <Header title={title} />
          <Main>
            <div className="p-6">{children}</div>
          </Main>
        </div>
      </div>
    </div>
  );
}
