export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image?: string;
  category: string;
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
  status: 'pending' | 'preparing' | 'ready' | 'delivered';
  payment_method: string;
  customer_name?: string;
}
