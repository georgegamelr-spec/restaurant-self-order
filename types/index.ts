export type OrderStatus = 'draft' | 'submitted' | 'preparing' | 'ready' | 'done'

export interface MenuItem {
  id: string
  name: string
  name_ar: string
  emoji: string
  price: number
  description: string
  description_ar: string
  category: 'starters' | 'mains' | 'drinks' | 'desserts'
  available: boolean
  image?: string
}

export interface OrderItem {
  menu_item_id: string
  name: string
  name_ar: string
  emoji: string
  price: number
  qty: number
}

export interface Order {
  id: string
  table_number: string
  session_id: string
  items: OrderItem[]
  status: OrderStatus
  notes?: string
  total: number
  created_at: string
  updated_at: string
}
