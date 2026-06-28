'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Home, Calendar, BarChart3, PenSquare } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: '首页', icon: Home },
    { href: '/record', label: '记录', icon: PenSquare },
    { href: '/history', label: '历史', icon: Calendar },
    { href: '/stats', label: '统计', icon: BarChart3 },
  ];

  return (
    <nav className="sticky top-0 z-50 backdrop-blur-lg bg-warm-white/80 border-b border-blush/20">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Heart className="w-6 h-6 text-blush fill-blush text-blush-dark group-hover:scale-110 transition-transform" />
          <span className="text-xl font-bold text-text-primary">暖暖</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blush/15 text-blush-dark'
                    : 'text-text-secondary hover:text-blush-dark hover:bg-blush/10'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Mobile icon */}
        <div className="md:hidden">
          <Link href="/record" className="p-2 text-text-secondary hover:text-blush-dark transition-colors">
            <PenSquare className="w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-lg bg-warm-white/90 border-t border-blush/20 px-2 py-1">
        <div className="flex items-center justify-around">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  isActive
                    ? 'text-blush-dark'
                    : 'text-text-secondary'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'fill-current' : ''}`} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
