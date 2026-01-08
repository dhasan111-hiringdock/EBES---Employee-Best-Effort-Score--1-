import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '@/react-app/hooks/useAuth';
import { Bell, Check, Trash2, X } from 'lucide-react';
import { fetchWithAuth } from '@/react-app/utils/api';

interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  related_entity_type?: string;
  related_entity_id?: number;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snoozeSelection, setSnoozeSelection] = useState<Record<number, number>>({});
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUnreadCount();
  }, []);

  useEffect(() => {
    if (showDropdown) {
      fetchNotifications();
    }
  }, [showDropdown]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDropdown]);

  const fetchUnreadCount = async () => {
    try {
      const response = await fetchWithAuth('/api/notifications/unread-count');
      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Failed to fetch unread count:', error);
    }
  };

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const response = await fetchWithAuth('/api/notifications?limit=10');
      if (response.ok) {
        const data = await response.json();
        setNotifications(data);
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: number) => {
    try {
      const response = await fetchWithAuth(`/api/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetchWithAuth('/api/notifications/read-all', {
        method: 'PUT'
      });
      
      if (response.ok) {
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  const deleteNotification = async (notificationId: number) => {
    try {
      const response = await fetchWithAuth(`/api/notifications/${notificationId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const notification = notifications.find(n => n.id === notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        if (notification && !notification.is_read) {
          setUnreadCount(prev => Math.max(0, prev - 1));
        }
      }
    } catch (error) {
      console.error('Failed to delete notification:', error);
    }
  };

  const snoozeAssociation = async (notification: Notification) => {
    if (!notification.related_entity_type || !notification.related_entity_id) return;
    const days = snoozeSelection[notification.id] || 7;
    try {
      const response = await fetchWithAuth(`/api/recruiter/stale-notifications/${notification.related_entity_id}/snooze`, {
        method: 'POST',
        body: JSON.stringify({ days })
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - (notification.is_read ? 0 : 1)));
      }
    } catch (error) {
      console.error('Failed to snooze reminder:', error);
    }
  };

  const disableAssociationReminders = async (notification: Notification) => {
    if (!notification.related_entity_type || !notification.related_entity_id) return;
    try {
      const response = await fetchWithAuth(`/api/recruiter/stale-notifications/${notification.related_entity_id}/disable`, {
        method: 'POST'
      });
      if (response.ok) {
        setNotifications(prev =>
          prev.map(n => n.id === notification.id ? { ...n, is_read: true } : n)
        );
        setUnreadCount(prev => Math.max(0, prev - (notification.is_read ? 0 : 1)));
      }
    } catch (error) {
      console.error('Failed to disable reminders:', error);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'role_assignment':
        return '📋';
      case 'dropout':
        return '⚠️';
      case 'deal':
        return '✅';
      case 'performance':
        return '📊';
      case 'system':
        return '🔔';
      default:
        return '📢';
    }
  };

  const navigate = useNavigate();
  const { user } = useAuth();
  const navigateToCandidate = (notification: Notification) => {
    if (!notification.related_entity_id) return;
    const associationId = notification.related_entity_id;
    const roleRoute = user?.role === 'account_manager' ? '/am/pipeline' : user?.role === 'recruitment_manager' ? '/rm/pipeline' : '';
    if (!roleRoute) return;
    setShowDropdown(false);
    navigate(`${roleRoute}?association_id=${associationId}`);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full flex items-center justify-center hover:shadow-lg transition-all"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center shadow-lg">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 max-h-[32rem] flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-indigo-50 to-purple-50">
            <h3 className="text-lg font-bold text-slate-800">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setShowDropdown(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-200 border-t-indigo-600"></div>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell className="w-12 h-12 text-slate-300 mb-3" />
                <p className="text-slate-600 font-medium">No notifications</p>
                <p className="text-sm text-slate-400 mt-1">You're all caught up!</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {notifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-slate-50 transition-colors ${
                      !notification.is_read ? 'bg-indigo-50/50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-2xl flex-shrink-0">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-slate-800 text-sm">
                            {notification.title}
                          </h4>
                          {!notification.is_read && (
                            <div className="w-2 h-2 bg-indigo-600 rounded-full flex-shrink-0 mt-1"></div>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">
                          {notification.message}
                        </p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">
                    {formatTime(notification.created_at)}
                  </span>
                  <div className="flex items-center gap-2">
                    {notification.related_entity_type === 'candidate_role_association' && (user?.role === 'recruitment_manager' || user?.role === 'account_manager') && (
                      <>
                        <button
                          onClick={() => navigateToCandidate(notification)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          title="Review"
                        >
                          Review
                        </button>
                        <select
                          value={snoozeSelection[notification.id] ?? 7}
                          onChange={(e) => setSnoozeSelection(prev => ({ ...prev, [notification.id]: parseInt(e.target.value) }))}
                          className="text-xs border border-slate-300 rounded px-2 py-1 text-slate-600"
                          title="Remind me in"
                        >
                          <option value={3}>3d</option>
                          <option value={7}>7d</option>
                          <option value={14}>14d</option>
                          <option value={30}>30d</option>
                        </select>
                        <button
                          onClick={() => snoozeAssociation(notification)}
                          className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                          title="Snooze"
                        >
                          Snooze
                        </button>
                        <button
                          onClick={() => disableAssociationReminders(notification)}
                          className="text-xs text-slate-500 hover:text-red-600"
                          title="Turn off reminders"
                        >
                          Turn off
                        </button>
                      </>
                    )}
                    {!notification.is_read && (
                      <button
                        onClick={() => markAsRead(notification.id)}
                        className="text-indigo-600 hover:text-indigo-700"
                        title="Mark as read"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(notification.id)}
                              className="text-slate-400 hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
