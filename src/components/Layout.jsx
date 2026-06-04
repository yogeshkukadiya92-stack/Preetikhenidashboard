import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { BellIcon, CalendarIcon, ChartIcon, ChevronRight, FileIcon, HomeIcon, MoneyIcon, SearchIcon, SettingsIcon, UsersIcon } from './icons.jsx';
import { navItems } from '../data/mockData.js';

const iconByPath = {
  '/': HomeIcon,
  '/crm': UsersIcon,
  '/clients': UsersIcon,
  '/users': UsersIcon,
  '/forms': FileIcon,
  '/appointments': CalendarIcon,
  '/operations': ChartIcon,
  '/treatments': ChartIcon,
  '/packages': MoneyIcon,
  '/coaching': UsersIcon,
  '/staff': UsersIcon,
  '/finance': MoneyIcon,
  '/accounts': MoneyIcon,
  '/inventory': FileIcon,
  '/communication': BellIcon,
  '/payments': MoneyIcon,
  '/reports': ChartIcon,
  '/client-portal': UsersIcon,
  '/settings': SettingsIcon,
  '/integrations': SettingsIcon,
};

export function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState('May 18 - May 24, 2025');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const handleSearch = (event) => {
    event.preventDefault();
    const term = searchText.trim().toLowerCase();
    if (!term) return;
    if (term.includes('package') || term.includes('program')) navigate('/operations?tab=packages');
    else if (term.includes('treatment') || term.includes('plan') || term.includes('panchakarma') || term.includes('skin') || term.includes('hair') || term.includes('garbha') || term.includes('weight')) navigate('/operations?tab=treatments');
    else if (term.includes('coach') || term.includes('student') || term.includes('batch') || term.includes('certificate')) navigate('/operations?tab=coaching');
    else if (term.includes('staff') || term.includes('role') || term.includes('permission')) navigate('/settings?tab=users');
    else if (term.includes('account') || term.includes('expense') || term.includes('gst')) navigate('/finance?tab=accounts');
    else if (term.includes('inventory') || term.includes('stock') || term.includes('medicine') || term.includes('oil')) navigate('/operations?tab=inventory');
    else if (term.includes('whatsapp') || term.includes('message') || term.includes('email') || term.includes('sms') || term.includes('template')) navigate('/operations?tab=communication');
    else if (term.includes('portal') || term.includes('mobile') || term.includes('app')) navigate('/operations?tab=portal');
    else if (term.includes('setting') || term.includes('branch') || term.includes('tax')) navigate('/settings');
    else if (term.includes('report') || term.includes('analytics')) navigate('/reports');
    else if (term.includes('pay') || term.includes('invoice') || term.includes('receipt')) navigate('/finance?tab=payments');
    else if (term.includes('client')) navigate('/clients');
    else if (term.includes('appoint') || term.includes('schedule')) navigate('/appointments');
    else if (term.includes('form')) navigate('/forms');
    else navigate('/crm');
  };

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
          <form className="search" onSubmit={handleSearch}>
            <SearchIcon />
            <input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search leads, clients, stock, payments..." aria-label="Search" />
            <button className="kbd" type="submit">Go</button>
          </form>
          <button className="date-pill" type="button" onClick={() => setDateRange((current) => (current === 'May 18 - May 24, 2025' ? 'May 2025' : 'May 18 - May 24, 2025'))}>
            <CalendarIcon />
            <strong>{dateRange}</strong>
            <ChevronRight />
          </button>
          <button className="icon-btn" aria-label="Notifications" type="button" onClick={() => setNotificationsOpen((current) => !current)}>
            <BellIcon />
          </button>
          {notificationsOpen && (
            <div className="popover-panel">
              <strong>Notifications</strong>
              <p>8 lead follow-ups due today.</p>
              <p>5 payments need collection review.</p>
              <button className="row-link" type="button" onClick={() => { setNotificationsOpen(false); navigate('/crm'); }}>Open CRM</button>
            </div>
          )}
          <button className="profile" type="button" onClick={() => navigate('/users')}>
            <div className="avatar" aria-hidden="true" />
            <div className="meta">
              <strong>Dr. Arjun Nair</strong>
              <span>{location.pathname === '/' ? 'Administrator' : 'Clinic Operator'}</span>
            </div>
            <ChevronRight />
          </button>
        </header>
        <Outlet />
      </main>
    </div>
  );
}
