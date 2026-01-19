import { api } from "../../app/api";
import { publicApi } from "../../config/publicApi";

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
      async queryFn(params) {
        try {
          const res = await publicApi.get("/api/products", { params });
          return { data: res.data };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
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
      async queryFn(id) {
        try {
          const res = await publicApi.get(`/api/products/${id}`);
          return { data: res.data };
        } catch (err: any) {
          return {
            error: {
              status: err?.response?.status ?? "FETCH_ERROR",
              data: err?.response?.data ?? err?.message,
            } as any,
          };
        }
      },
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
