import React, { createContext, useContext, useState, ReactNode } from 'react';

export type CartItem = {
  category: string;
  secondaryCategory?: string;
  name: string;
  price: number;
  quantity: number;
  sku: string;
  title: string;
  image: string;
};

type CartContextType = {
  cart: CartItem[];
  addToCart: (item: Omit<CartItem, 'quantity'>) => void;
  removeFromCart: (name: string, category: string) => void;
  isInCart: (name: string, category: string) => boolean;
  incrementQuantity: (name: string, category: string) => void;
  decrementQuantity: (name: string, category: string) => void;
  clearCart: () => void;
  cartSessionId: string;
  isCartSessionLoading: false;
  /** Non-null when productListOpens has not yet fired for the current session. */
  productListOpenPending: string | null;
  resetCartSession: () => void;
  markOpenSent: () => void;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

function generateSessionId(): string {
  return `cart-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartSessionId, setCartSessionId] = useState(() => generateSessionId());
  const [productListOpenPending, setProductListOpenPending] = useState<string | null>(
    () => cartSessionId
  );

  const resetCartSession = () => {
    const newId = generateSessionId();
    setCartSessionId(newId);
    setProductListOpenPending(newId);
  };

  const markOpenSent = () => setProductListOpenPending(null);

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCart(prev => {
      const existing = prev.find(i => i.name === item.name && i.category === item.category);
      if (existing) {
        return prev.map(i =>
          i.name === item.name && i.category === item.category
            ? { ...i, quantity: i.quantity + 1 }
            : i
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };

  const removeFromCart = (name: string, category: string) => {
    setCart(prev => prev.filter(i => !(i.name === name && i.category === category)));
  };

  const isInCart = (name: string, category: string) =>
    cart.some(i => i.name === name && i.category === category);

  const incrementQuantity = (name: string, category: string) => {
    setCart(prev => prev.map(i =>
      i.name === name && i.category === category ? { ...i, quantity: i.quantity + 1 } : i
    ));
  };

  const decrementQuantity = (name: string, category: string) => {
    setCart(prev => prev.flatMap(i => {
      if (i.name === name && i.category === category) {
        return i.quantity > 1 ? { ...i, quantity: i.quantity - 1 } : [];
      }
      return i;
    }));
  };

  const clearCart = () => setCart([]);

  return (
    <CartContext.Provider value={{
      cart, addToCart, removeFromCart, isInCart, incrementQuantity, decrementQuantity, clearCart,
      cartSessionId, isCartSessionLoading: false, productListOpenPending, resetCartSession, markOpenSent,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
