export interface ProductFeature {
  name: string;
  description: string;
  benefit: string;
}

export interface ProductPrice {
  amount: number;
  currency: string;
  discount: number;
  originalPrice: number;
  discountAmount: number;
  discountType: 'percentage' | 'fixed';
  isOnSale: boolean;
  saleEndsAt: string;
}

export interface Feature {
  name: string;
  description: string;
  benefit: string;
}

export interface Price {
  amount: number;
  currency: string;
  isOnSale: boolean;
  originalPrice?: number;
  discount?: number;
  discountAmount?: number;
  saleEndsAt?: string;
}

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  category: string;
  imageUrl: string;
  keyFeatures: string[];
  features: {
    name: string;
    description: string;
    benefit: string;
  }[];
  pros: string[];
  cons: string[];
  whyBuy: string;
  price: {
    amount: number;
    currency: string;
    discount: number;
    originalPrice: number;
    discountAmount: number;
    discountType: 'percentage' | 'fixed';
    isOnSale: boolean;
    saleEndsAt: string;
  };
  rating: number;
  stockStatus: 'in_stock' | 'out_of_stock';
  confidence: number;
}

export interface SearchResponse {
  results: SearchResult[];
  totalResults: number;
} 