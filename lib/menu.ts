import { MenuItem } from '@/types'

export const MENU_ITEMS: MenuItem[] = [
  // Starters
  { id: 's1', name: 'Garlic Bread', name_ar: 'خبز بالثوم', emoji: '🥖', price: 4.99, description: 'Crispy with herb butter', description_ar: 'مقرمش مع زبدة الأعشاب', category: 'starters', available: true },
  { id: 's2', name: 'Caesar Salad', name_ar: 'سلطة سيزر', emoji: '🥗', price: 8.99, description: 'Romaine, croutons, parmesan', description_ar: 'خس روماني، خبز محمص، بارميزان', category: 'starters', available: true },
  { id: 's3', name: 'Soup of the Day', name_ar: 'شوربة اليوم', emoji: '🍲', price: 6.99, description: 'Ask for today\'s special', description_ar: 'اسأل عن طبق اليوم', category: 'starters', available: true },
  { id: 's4', name: 'Bruschetta', name_ar: 'بروشيتا', emoji: '🍅', price: 7.49, description: 'Tomato, basil, olive oil', description_ar: 'طماطم، ريحان، زيت زيتون', category: 'starters', available: true },
  // Mains
  { id: 'm1', name: 'Grilled Chicken', name_ar: 'دجاج مشوي', emoji: '🍗', price: 16.99, description: 'Herb marinated with side salad', description_ar: 'متبّل بالأعشاب مع سلطة جانبية', category: 'mains', available: true },
  { id: 'm2', name: 'Beef Burger', name_ar: 'برجر لحم', emoji: '🍔', price: 14.99, description: '200g wagyu beef with cheese', description_ar: '200 جرام لحم واجيو مع جبن', category: 'mains', available: true },
  { id: 'm3', name: 'Margherita Pizza', name_ar: 'بيتزا مارجريتا', emoji: '🍕', price: 13.99, description: 'San Marzano tomatoes, mozzarella', description_ar: 'طماطم سان مارزانو، موزاريلا', category: 'mains', available: true },
  { id: 'm4', name: 'Grilled Salmon', name_ar: 'سلمون مشوي', emoji: '🐟', price: 19.99, description: 'Lemon butter with asparagus', description_ar: 'زبدة الليمون مع الهليون', category: 'mains', available: true },
  { id: 'm5', name: 'Pasta Carbonara', name_ar: 'باستا كاربونارا', emoji: '🍝', price: 13.49, description: 'Pancetta, egg, pecorino', description_ar: 'بانشيتا، بيض، جبن بيكورينو', category: 'mains', available: true },
  { id: 'm6', name: 'Veggie Risotto', name_ar: 'ريزوتو خضار', emoji: '🥘', price: 12.99, description: 'Seasonal vegetables', description_ar: 'خضروات موسمية', category: 'mains', available: true },
  // Drinks
  { id: 'd1', name: 'Fresh Juice', name_ar: 'عصير طازج', emoji: '🧃', price: 4.99, description: 'Orange, apple or mango', description_ar: 'برتقال، تفاح أو مانجو', category: 'drinks', available: true },
  { id: 'd2', name: 'Sparkling Water', name_ar: 'مياه غازية', emoji: '💧', price: 2.99, description: '500ml bottle', description_ar: 'زجاجة 500 مل', category: 'drinks', available: true },
  { id: 'd3', name: 'Soft Drink', name_ar: 'مشروب غازي', emoji: '🥤', price: 3.49, description: 'Coke, Sprite, Fanta', description_ar: 'كوكاكولا، سبرايت، فانتا', category: 'drinks', available: true },
  { id: 'd4', name: 'House Wine', name_ar: 'نبيذ المنزل', emoji: '🍷', price: 7.99, description: 'Red, white or rosé', description_ar: 'أحمر، أبيض أو روزيه', category: 'drinks', available: true },
  { id: 'd5', name: 'Craft Beer', name_ar: 'بيرة محلية', emoji: '🍺', price: 6.49, description: 'Local IPA on tap', description_ar: 'IPA محلي من الصنبور', category: 'drinks', available: true },
  // Desserts
  { id: 'ds1', name: 'Tiramisu', name_ar: 'تيراميسو', emoji: '🍮', price: 6.99, description: 'Classic Italian style', description_ar: 'على الطريقة الإيطالية الكلاسيكية', category: 'desserts', available: true },
  { id: 'ds2', name: 'Chocolate Lava Cake', name_ar: 'كيك الشوكولاتة', emoji: '🎂', price: 7.49, description: 'Warm molten center', description_ar: 'مركز شوكولاتة ساخن ومنصهر', category: 'desserts', available: true },
  { id: 'ds3', name: 'Ice Cream', name_ar: 'آيس كريم', emoji: '🍦', price: 4.99, description: '3 scoops, your choice', description_ar: '3 كرات، اختيارك', category: 'desserts', available: true },
]

export const CATEGORIES = [
  { key: 'starters', label: 'Starters', label_ar: 'المقبلات', emoji: '🥗' },
  { key: 'mains', label: 'Main Course', label_ar: 'الأطباق الرئيسية', emoji: '🍽️' },
  { key: 'drinks', label: 'Drinks', label_ar: 'المشروبات', emoji: '🥤' },
  { key: 'desserts', label: 'Desserts', label_ar: 'الحلويات', emoji: '🍮' },
]
