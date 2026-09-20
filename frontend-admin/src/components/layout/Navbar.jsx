import { Bell, Menu, Search, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../../context/AppContext';

export default function Navbar({ onMenuClick }) {
  const { user, logout, notifications, unreadCount, markNotificationRead } = useApp();
  const [showNotif, setShowNotif] = useState(false);

  const initials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'A';
  const displayName = user?.full_name || 'Admin';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-10 shadow-sm">
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg hover:bg-gray-100 text-gray-600"
        >
          <Menu size={20} />
        </button>
        <div className="hidden sm:flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 w-64">
          <Search size={16} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search issues, workers..."
            className="bg-transparent text-sm text-gray-700 outline-none w-full placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setShowNotif(!showNotif)}
            className="relative p-2 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotif && (
            <div className="absolute right-0 top-12 w-80 bg-white rounded-xl shadow-xl border border-gray-200 z-50">
              <div className="px-4 py-3 border-b border-gray-100">
                <h3 className="font-semibold text-gray-800 text-sm">Notifications</h3>
              </div>
              <div className="max-h-72 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-4 py-6 text-sm text-gray-400 text-center">No notifications</p>
                )}
                {notifications.map(n => (
                  <div
                    key={n.id}
                    onClick={() => { markNotificationRead(n.id); setShowNotif(false); }}
                    className={`px-4 py-3 border-b border-gray-50 cursor-pointer hover:bg-gray-50 flex items-start gap-3
                      ${!n.read ? 'bg-blue-50' : ''}`}
                  >
                    <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0
                      ${n.type === 'alert' ? 'bg-red-500' : n.type === 'warning' ? 'bg-yellow-500' : 'bg-green-500'}`} />
                    <p className="text-sm text-gray-700">{n.text}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Admin info */}
        <div className="hidden sm:flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1e3a8a] flex items-center justify-center text-white text-sm font-semibold">
            {initials}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-800">{displayName}</p>
            <p className="text-xs text-gray-500">Admin · IMC</p>
          </div>
        </div>

        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-red-500"
          title="Sign out"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
