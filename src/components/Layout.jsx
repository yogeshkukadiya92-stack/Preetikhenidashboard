import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { BellIcon, CalendarIcon, ChartIcon, ChevronRight, FileIcon, HomeIcon, MoneyIcon, SearchIcon, SettingsIcon, UsersIcon } from './icons.jsx';
import { navItems } from '../data/mockData.js';

const iconByPath = {
  '/': HomeIcon,
  '/crm': UsersIcon,
  '/clients': UsersIcon,
  '/forms': FileIcon,
  '/appointments': CalendarIcon,
  '/payments': MoneyIcon,
  '/reports': ChartIcon,
};

export function Layout() {
  const location = useLocation();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <path d="M20 6c5.8 0 10.8 4.6 10.8 10.6 0 7.6-7.3 13.4-10.8 17-3.5-3.6-10.8-9.4-10.8-17C9.2 10.6 14.2 6 20 6Z" fill="#E6B94C" />
              <path d="M20 13.2c2.9 0 5.2 2.2 5.2 5s-2.3 5-5.2 5-5.2-2.2-5.2-5 2.3-5 5.2-5Z" fill="#F9F1CF" />
              <path d="M20 9v22" stroke="#F9F1CF" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <h1>AyurFlow <span>CRM</span></h1>
            <p>Flowing care. Naturally.</p>
          </div>
        </div>
        <nav className="nav" aria-label="Primary">
          {navItems.map((item) => {
            const Icon = iconByPath[item.path] ?? HomeIcon;
            return (
              <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
          <button className="nav-item">
            <SettingsIcon />
            <span>Settings</span>
          </button>
        </nav>
        <div className="sidebar-art" aria-hidden="true" />
        <div className="clinic-card">
          <div>
            <strong>Vaidhya Wellness Clinic</strong>
            <span>Thrissur, Kerala</span>
          </div>
          <ChevronRight />
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="search">
            <SearchIcon />
            <input placeholder="Search clients, leads, appointments..." aria-label="Search" />
            <span className="kbd">⌘ K</span>
          </div>
          <div className="date-pill">
            <CalendarIcon />
            <strong>May 18 - May 24, 2025</strong>
            <ChevronRight />
          </div>
          <button className="icon-btn" aria-label="Notifications">
            <BellIcon />
          </button>
          <div className="profile">
            <div className="avatar" aria-hidden="true" />
            <div className="meta">
              <strong>Dr. Arjun Nair</strong>
              <span>{location.pathname === '/' ? 'Administrator' : 'Clinic Operator'}</span>
            </div>
            <ChevronRight />
          </div>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
