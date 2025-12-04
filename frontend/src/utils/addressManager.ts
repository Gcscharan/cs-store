export interface Address {
  id: string;
  // Core fields for saved addresses
  name?: string;
  phone?: string;
  address?: string;
  landmark?: string;
  pincode: string;
  city: string;
  state: string;
  type?: 'home' | 'work' | 'other';
  isDefault: boolean;

  // Extended fields used by UI components
  label?: string;
  addressLine?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
}

export const addAddress = (address: Omit<Address, 'id'>): Address => {
  const newAddress: Address = {
    ...address,
    id: Date.now().toString(),
  };
  
  // Save to localStorage
  const existingAddresses = getAddresses();
  existingAddresses.push(newAddress);
  localStorage.setItem('addresses', JSON.stringify(existingAddresses));
  
  return newAddress;
};

export const getAddresses = (): Address[] => {
  try {
    const stored = localStorage.getItem('addresses');
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

export const updateAddress = (id: string, updates: Partial<Address>): Address | null => {
  const addresses = getAddresses();
  const index = addresses.findIndex(addr => addr.id === id);
  
  if (index !== -1) {
    addresses[index] = { ...addresses[index], ...updates };
    localStorage.setItem('addresses', JSON.stringify(addresses));
    return addresses[index];
  }
  
  return null;
};

export const deleteAddress = (id: string): boolean => {
  const addresses = getAddresses();
  const filteredAddresses = addresses.filter(addr => addr.id !== id);
  
  if (filteredAddresses.length !== addresses.length) {
    localStorage.setItem('addresses', JSON.stringify(filteredAddresses));
    return true;
  }
  
  return false;
};

export const setDefaultAddress = (id: string): boolean => {
  const addresses = getAddresses();
  const updatedAddresses = addresses.map(addr => ({
    ...addr,
    isDefault: addr.id === id
  }));
  
  localStorage.setItem('addresses', JSON.stringify(updatedAddresses));
  return true;
};
