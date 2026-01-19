import { api } from "../../app/api";

// Define types for better TypeScript support
export interface Product {
  _id: string;
  id: string; // Add id field for frontend compatibility
  name: string;
  description: string;
  price: number;
  mrp?: number;
  category: string;
  stock: number;
  weight?: number;
  images: Array<{
    full: string;
    thumb: string;
    _id?: string;
  }>;
  tags?: string[];
  sku?: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
}

export interface ProductsResponse {
  products: Product[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export const productsApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getProducts: builder.query<ProductsResponse, any>({
      query: (params) => ({
        url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products`,
        method: "GET",
        params,
      }),
      transformResponse: (response: ProductsResponse) => {
        console.log("🔥 RAW PRODUCTS FROM BACKEND:", response);

        // Add id field for frontend compatibility
        const transformedResponse = {
          ...response,
          products: response.products.map(product => ({
            ...product,
            id: product._id // Map _id to id for frontend compatibility
          }))
        };

        return transformedResponse;
      },
    }),

    getProductById: builder.query<Product, string>({
      query: (id) => `${process.env.NEXT_PUBLIC_API_BASE_URL}/api/products/${id}`,
      transformResponse: (response: Product) => {
        console.log("🔥 PRODUCT DETAIL FROM BACKEND:", response);
        
        // Add id field for frontend compatibility
        return {
          ...response,
          id: response._id // Map _id to id for frontend compatibility
        };
      }
    }),
  }),
});

export const {
  useGetProductsQuery,
  useGetProductByIdQuery,
} = productsApi;
