import { Product } from './types';

export const PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Pizza Margarita",
    description: "Salsa de tomate San Marzano, mozzarella fior di latte, albahaca fresca y aceite de oliva virgen extra.",
    price: 12.99,
    category: "Menú",
    image: "/pizza Margarita.jpg",
    is_recommendation: false
  },
  {
    id: "2",
    name: "Hamburguesa Trufada",
    description: "Carne de buey madurada, queso gouda, cebolla caramelizada y nuestra exclusiva salsa de trufa negra.",
    price: 14.50,
    category: "Menú",
    image: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&q=80&w=800",
    is_recommendation: false
  },
  {
    id: "3",
    name: "Ensalada César Imperial",
    description: "Corazones de lechuga romana, lascas de parmesano de 24 meses, crutones artesanos y pechuga a la brasa.",
    price: 11.75,
    category: "Menú",
    image: "https://images.unsplash.com/photo-1550304943-4f24f54ddde9?auto=format&fit=crop&q=80&w=800",
    is_recommendation: false
  },
  {
    id: "4",
    name: "Limonada de Hierbabuena",
    description: "Limones recién exprimidos, un toque de jengibre y hierbabuena fresca de nuestro huerto.",
    price: 4.20,
    category: "Bebidas",
    image: "https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?auto=format&fit=crop&q=80&w=800",
    is_recommendation: false
  },
  {
    id: "5",
    name: "Cerveza Artesanal IPA",
    description: "Cerveza artesanal India Pale Ale, notas cítricas y amargas.",
    price: 5.50,
    category: "Bebidas",
    image: "/cerveza artesanal.jpg",
    is_recommendation: false
  },
  {
    id: "5b",
    name: "Cerveza Artesanal HONEY",
    description: "Cerveza dorada con un toque de miel pura de abejas, dulzor suave.",
    price: 5.50,
    category: "Bebidas",
    image: "/cerveza artesanal.jpg",
    is_recommendation: false
  },
  {
    id: "5c",
    name: "Cerveza Artesanal GOLDEN",
    description: "Cerveza rubia y ligera, muy refrescante, ideal para cualquier momento.",
    price: 5.00,
    category: "Bebidas",
    image: "/cerveza artesanal.jpg",
    is_recommendation: false
  },
  {
    id: "6",
    name: "Risotto Funghi",
    description: "Arroz carnaroli con una selección de setas de temporada, vino blanco y manteca de parmesano.",
    price: 13.90,
    category: "Menú",
    image: "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&q=80&w=800",
    is_recommendation: false
  }
];

export const WHATSAPP_PHONE = "5491157002744"; // Updated restaurant number
