import React, { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { APP_NAME } from "../config";
import { getStoredTheme, applyTheme, type Theme } from "../lib/theme";

const NAV_ITEMS = [
  {
    path: "/",
    label: "Home",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        {active
          ? <path d="M3 12.5l9-9 9 9V21a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1v-8.5z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        }
      </svg>
    ),
  },
  {
    path: "/plans",
    label: "Plans",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        {active
          ? <path d="M9 2a2 2 0 00-2 2H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V6a2 2 0 00-2-2h-2a2 2 0 00-2-2H9zm0 2h6v1H9V4zM7 9h10v2H7V9zm0 4h7v2H7v-2z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        }
      </svg>
    ),
  },
  {
    path: "/history",
    label: "History",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        {active
          ? <path d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5l4 2.5-.9 1.5L12 13.5V7h1z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        }
      </svg>
    ),
  },
  {
    path: "/profile",
    label: "Profile",
    icon: (active: boolean) => (
      <svg className="w-6 h-6" fill={active ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={active ? 0 : 1.5}>
        {active
          ? <path d="M12 2a5 5 0 110 10 5 5 0 010-10zM4 20c0-4 4-6 8-6s8 2 8 6H4z" />
          : <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        }
      </svg>
    ),
  },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-[100dvh] bg-[var(--color-bg)] flex flex-col">
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 bg-[var(--color-nav-bg)] backdrop-blur-xl z-50" style={{ borderTop: "1px solid var(--color-border)" }}>
        <div className="flex items-center justify-around max-w-lg mx-auto h-16">
          {NAV_ITEMS.map(item => {
            const active = location === item.path || (item.path !== "/" && location.startsWith(item.path));
            return (
              <Link key={item.path} href={item.path}>
                <button className={`flex flex-col items-center gap-0.5 px-5 py-2 transition-colors ${active ? "text-[var(--color-accent)]" : "text-[var(--color-text-muted)]"}`}>
                  {item.icon(active)}
                  <span className="text-[10px] font-semibold">{item.label}</span>
                </button>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
