// Mock addressesApi for testing
export const useGetAddressesQuery = jest.fn(() => ({
  data: {
    addresses: [],
    defaultAddressId: null,
  },
  isLoading: false,
  isError: false,
}));

export const useAddAddressMutation = jest.fn(() => [
  jest.fn().mockResolvedValue({ unwrap: async () => ({ success: true }) }),
  { isLoading: false },
]);

export const useUpdateAddressMutation = jest.fn(() => [
  jest.fn().mockResolvedValue({ unwrap: async () => ({ success: true }) }),
  { isLoading: false },
]);

export const useLazyCheckPincodeQuery = jest.fn(() => [
  jest.fn().mockResolvedValue({
    unwrap: async () => ({
      deliverable: true,
      state: 'Telangana',
      cities: ['Hyderabad', 'Secunderabad'],
      admin_district: 'Hyderabad',
      postal_district: 'Hyderabad',
    }),
  }),
]);

export interface Address {
  _id: string;
  name: string;
  phone: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  label: string;
  isDefault: boolean;
}

export interface PincodeCheckResponse {
  deliverable: boolean;
  state?: string;
  cities?: string[];
  admin_district?: string;
  postal_district?: string;
}
