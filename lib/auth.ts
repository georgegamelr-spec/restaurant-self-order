// Simple session-based auth using cookies via API
export interface AdminUser {
  id: string
  username: string
  name: string
  role: 'super_admin' | 'manager' | 'cashier' | 'kitchen'
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير النظام',
  manager:     'مدير',
  cashier:     'كاشير',
  kitchen:     'مطبخ',
}

export const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: ['dashboard','orders','menu','users','inventory','suppliers'],
  manager:     ['dashboard','orders','menu','inventory','suppliers'],
  cashier:     ['orders'],
  kitchen:     ['kitchen'],
}

export function canAccess(role: string, page: string): boolean {
  return ROLE_PERMISSIONS[role]?.includes(page) ?? false
}
