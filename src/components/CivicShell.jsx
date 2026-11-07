import React, { useEffect, useState } from 'react';

import {
  AnimatePresence,
  motion,
} from 'framer-motion';

import {
  Bell,
  Building2,
  LogOut,
  Menu,
  Search,
  User,
  X,
} from 'lucide-react';

import { motionTiming } from '../ui/motion';

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
    menuItems.find(
      (item) => item.id === activeTab
    ) || menuItems[0];

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    if (menuOpen) {
      document.addEventListener(
        'keydown',
        handleEscape
      );
    }

    return () => {
      document.removeEventListener(
        'keydown',
        handleEscape
      );
    };
  }, [menuOpen]);

  useEffect(() => {
    if (
      menuOpen &&
      window.innerWidth <= 900
    ) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const handleTabChange = (tabId) => {
    onTabChange(tabId);
    setMenuOpen(false);
  };

  return (
    <div className="civic-shell">
      {/* MOBILE BACKDROP */}
      <AnimatePresence>
        {menuOpen && (
          <motion.button
            type="button"
            className="civic-backdrop"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={motionTiming.fast}
          />
        )}
      </AnimatePresence>

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
            type="button"
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
        <nav
          className="civic-nav"
          aria-label="Primary navigation"
        >
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              activeTab === item.id;

            return (
              <motion.button
                type="button"
                key={item.id}
                className={
                  isActive
                    ? 'is-active'
                    : ''
                }
                onClick={() =>
                  handleTabChange(item.id)
                }
                whileTap={{ scale: 0.98 }}
              >
                {isActive && (
                  <motion.span
                    layoutId="civic-active-nav"
                    className="civic-nav-indicator"
                    transition={motionTiming.fast}
                  />
                )}

                <Icon size={18} />

                <span>{item.label}</span>
              </motion.button>
            );
          })}
        </nav>

        {/* LOGOUT */}
        <motion.button
          type="button"
          className="civic-logout"
          onClick={onLogout}
          whileTap={{ scale: 0.98 }}
        >
          <LogOut size={18} />
          <span>Sign out</span>
        </motion.button>
      </aside>

      {/* WORKSPACE */}
      <section className="civic-workspace">
        {/* TOPBAR */}
        <header className="civic-topbar">
          <motion.button
            type="button"
            className="civic-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            whileTap={{ scale: 0.96 }}
          >
            <Menu size={21} />
          </motion.button>

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
                aria-label={searchPlaceholder}
              />
            </label>

            <motion.button
              type="button"
              className="civic-bell"
              aria-label="Notifications"
              whileTap={{ scale: 0.96 }}
            >
              <Bell size={19} />
              <i />
            </motion.button>
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
