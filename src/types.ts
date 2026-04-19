export interface Product {
  id: string | number;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
  is_recommendation?: boolean;
}

export interface CartItem {
  product: Product;
  quantity: number;
  instructions: string;
}

export interface Order {
  id: string;
  created_at: string;
  items: CartItem[];
  total: number;
  status: 'pending' | 'preparing' | 'ready' | 'on_the_way' | 'delivered' | 'completed';
  payment_method: string;
  customer_name?: string;
  is_paid?: boolean;
}
