import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import { BellIcon, CalendarIcon, ChartIcon, ChevronDown, ChevronRight, FileIcon, HomeIcon, MenuIcon, MoneyIcon, SearchIcon, SettingsIcon, UsersIcon } from './icons.jsx';
import { navItems } from '../data/appConfig.js';
import { loadLiveDashboardData } from '../data/liveData.js';
import { useBranch } from '../context/BranchContext.jsx';
import { ADMIN_EMAIL, clearAuthSession } from '../data/auth.js';

const iconByPath = {
  '/': HomeIcon,
  '/crm': UsersIcon,
  '/clients': UsersIcon,
  '/journey': ChartIcon,
  '/users': UsersIcon,
  '/forms': FileIcon,
  '/appointments': CalendarIcon,
  '/services': FileIcon,
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
  '/branches': SettingsIcon,
  '/medicines': FileIcon,
};

const sectionOrder = ['Overview', 'Clients & CRM', 'Care Programs', 'Operations', 'Finance & Reports', 'Administration'];

function getCurrentDateRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - 6);
  const format = (date) => date.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${format(start)} - ${format(today)}`;
}

export function Layout() {
  const { currentBranch } = useBranch();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(() => getCurrentDateRange());
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState({ followUps: 0, pendingPayments: 0 });
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const navSections = useMemo(() => sectionOrder.map((label) => ({
    label,
    items: navItems.filter((item) => item.section === label),
  })), []);
  const activeSection = navItems.find((item) => item.path === location.pathname)?.section ?? 'Overview';
  const [openSections, setOpenSections] = useState(() => new Set([activeSection]));

  useEffect(() => {
    setOpenSections(new Set([activeSection]));
    setMobileNavOpen(false);
  }, [activeSection]);

  const toggleSection = (section) => {
    setOpenSections((current) => (current.has(section) ? new Set() : new Set([section])));
  };

  const toggleNotifications = () => {
    setProfileOpen(false);
    if (!notificationsOpen) {
      const liveData = loadLiveDashboardData(currentBranch);
      setNotificationSummary({
        followUps: liveData.leads.filter((lead) => String(lead.status ?? '').toLowerCase().includes('follow')).length,
        pendingPayments: liveData.payments.filter((payment) => String(payment.status ?? '').toLowerCase() !== 'paid').length,
      });
    }
    setNotificationsOpen((current) => !current);
  };

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
    else if (term.includes('setting') || term.includes('workspace') || term.includes('tax')) navigate('/settings');
    else if (term.includes('report') || term.includes('analytics')) navigate('/reports');
    else if (term.includes('pay') || term.includes('invoice') || term.includes('receipt')) navigate('/finance?tab=payments');
    else if (term.includes('client')) navigate('/clients');
    else if (term.includes('appoint') || term.includes('schedule')) navigate('/appointments');
    else if (term.includes('form')) navigate('/operations?tab=forms');
    else navigate('/crm');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <path d="M20 6c5.8 0 10.8 4.6 10.8 10.6 0 7.6-7.3 13.4-10.8 17-3.5-3.6-10.8-9.4-10.8-17C9.2 10.6 14.2 6 20 6Z" fill="#E6B94C" />
                <path d="M20 13.2c2.9 0 5.2 2.2 5.2 5s-2.3 5-5.2 5-5.2-2.2-5.2-5 2.3-5 5.2-5Z" fill="#F9F1CF" />
                <path d="M20 9v22" stroke="#F9F1CF" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <h1>Mom's Pathshala</h1>
              <p>Learning, care, and growth.</p>
              <p className="subtle">Shared cloud workspace</p>
            </div>
          </div>
          <button
            className="sidebar-menu-toggle"
            type="button"
            aria-label={mobileNavOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileNavOpen}
            aria-controls="primary-navigation"
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            <MenuIcon />
          </button>
        </div>
        <nav id="primary-navigation" className={`nav ${mobileNavOpen ? 'mobile-open' : ''}`} aria-label="Primary">
          {navSections.map((section) => {
            if (section.label === 'Overview') {
              return section.items.map((item) => {
                const Icon = iconByPath[item.path] ?? HomeIcon;
                return (
                  <NavLink key={item.path} to={item.path} end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                    <Icon />
                    <span>{item.label}</span>
                  </NavLink>
                );
              });
            }

            const expanded = openSections.has(section.label);
            const sectionId = `nav-section-${section.label.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`;
            return (
              <div className={`nav-group ${section.label === activeSection ? 'has-active' : ''}`} key={section.label}>
                <button
                  className="nav-group-toggle"
                  type="button"
                  aria-expanded={expanded}
                  aria-controls={sectionId}
                  onClick={() => toggleSection(section.label)}
                >
                  <span>{section.label}</span>
                  <span className={`nav-group-chevron ${expanded ? 'expanded' : ''}`} aria-hidden="true"><ChevronDown /></span>
                </button>
                {expanded && (
                  <div className="nav-group-items" id={sectionId}>
                    {section.items.map((item) => {
                      const Icon = iconByPath[item.path] ?? HomeIcon;
                      return (
                        <NavLink key={item.path} to={item.path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-art" aria-hidden="true" />
        <div className="clinic-card" role="button" tabIndex={0} style={{ cursor: 'pointer' }} onClick={() => navigate('/settings')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/settings'); }}>
          <div>
            <strong>Mom's Pathshala</strong>
            <span>{currentBranch}</span>
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
          <button className="date-pill" type="button" onClick={() => setDateRange((current) => (current === getCurrentDateRange() ? new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : getCurrentDateRange()))}>
            <CalendarIcon />
            <strong>{dateRange}</strong>
            <ChevronRight />
          </button>
          <button className="icon-btn" aria-label="Notifications" type="button" onClick={toggleNotifications} aria-expanded={notificationsOpen}>
            <BellIcon />
          </button>
          {notificationsOpen && (
            <div className="popover-panel">
              <strong>Notifications</strong>
              {notificationSummary.followUps || notificationSummary.pendingPayments ? (
                <>
                  <p>{notificationSummary.followUps} lead follow-up(s) need attention.</p>
                  <p>{notificationSummary.pendingPayments} payment(s) need collection review.</p>
                </>
              ) : (
                <p>No pending alerts in the shared workspace.</p>
              )}
              <button className="row-link" type="button" onClick={() => { setNotificationsOpen(false); navigate('/crm'); }}>Open CRM</button>
            </div>
          )}
          <button
            className="profile"
            type="button"
            onClick={() => { setNotificationsOpen(false); setProfileOpen((current) => !current); }}
            aria-label="Open user profile"
            aria-expanded={profileOpen}
          >
            <div className="avatar" aria-hidden="true" />
            <div className="meta">
              <strong>Mom's Pathshala</strong>
              <span>{location.pathname === '/' ? 'Administrator' : 'Team Operator'}</span>
            </div>
            <ChevronRight />
          </button>
          {profileOpen && (
            <div className="profile-popover">
              <strong>Administrator</strong>
              <span>{ADMIN_EMAIL || 'Administrator account'}</span>
              <div className="profile-popover-actions">
                <button type="button" onClick={() => { setProfileOpen(false); navigate('/users'); }}>Open users</button>
                <button
                  type="button"
                  onClick={() => {
                    clearAuthSession();
                    navigate('/login', { replace: true });
                  }}
                >
                  Sign out
                </button>
              </div>
            </div>
          )}
        </header>
        <Outlet key={currentBranch} />
      </main>
    </div>
  );
}
