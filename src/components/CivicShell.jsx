import React, { useState } from 'react';

import {
  Bell,
  Building2,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from 'lucide-react';

const CivicShell = ({
  userData,
  onLogout,
  menuItems,
  activeTab,
  onTabChange,
  children,
  searchPlaceholder = 'Search',
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const activeItem =
    menuItems.find((item) => item.id === activeTab) ||
    menuItems[0];

  const handleTabChange = (tabId) => {
    onTabChange(tabId);
    setMenuOpen(false);
  };

  return (
    <div className="civic-shell">
      {/* MOBILE BACKDROP */}
      {menuOpen && (
        <button
          className="civic-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside
        className={`civic-sidebar ${
          menuOpen ? 'is-open' : ''
        }`}
      >
        {/* BRAND */}
        <div className="civic-brand">
          <span className="civic-brand-mark">
            <Building2 size={19} />
          </span>

          <span>
            Nagar<b>Setu</b>
          </span>

          <button
            className="civic-close"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* PROFILE */}
        <div className="civic-profile">
          <span className="civic-avatar">
            <User size={18} />
          </span>

          <span>
            <strong>
              {userData?.name || 'Citizen'}
            </strong>

            <small>
              {userData?.email ||
                'citizen@nagarsetu.in'}
            </small>
          </span>
        </div>

        {/* NAVIGATION */}
        <nav className="civic-nav">
          {menuItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                className={
                  activeTab === item.id
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  handleTabChange(item.id)
                }
              >
                <Icon size={18} />

                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <button
          className="civic-logout"
          onClick={onLogout}
        >
          <LogOut size={18} />

          Sign out
        </button>
      </aside>

      {/* WORKSPACE */}
      <section className="civic-workspace">
        {/* TOPBAR */}
        <header className="civic-topbar">
          <button
            className="civic-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={21} />
          </button>

          <div>
            <p className="civic-eyebrow">
              NagarSetu workspace
            </p>

            <h1>
              {activeItem?.label || 'Dashboard'}
            </h1>
          </div>

          <div className="civic-tools">
            <label>
              <Search size={17} />

              <input
                placeholder={searchPlaceholder}
              />
            </label>

            <button
              className="civic-bell" aria-label="Notifications">
              <Bell size={19} />

              <i />
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="civic-main">
          {children(activeTab, activeItem)}
        </main>
      </section>
    </div>
  );
};

export default CivicShell;