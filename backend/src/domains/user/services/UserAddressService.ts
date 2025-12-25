import { UserRepository } from "../repositories/UserRepository";
import { IAddress } from "../../../models/User";
import mongoose from "mongoose";
import { geocodeByPincode, smartGeocode } from "../../../utils/geocoding";
import { resolvePincodeForAddressSave } from "../../../utils/pincodeResolver";

export interface AddressData {
  id: string;
  _id: mongoose.Types.ObjectId;
  name: string;
  label: string;
  pincode: string;
  city: string;
  state: string;
  addressLine: string;
  phone: string;
  lat: number;
  lng: number;
  isDefault: boolean;
  isGeocoded?: boolean;
  coordsSource?: 'manual' | 'geocoded' | 'pincode' | 'unresolved';
}

export interface AddressCreateData {
  name?: string;
  label: string;
  pincode: string;
  city: string;
  state: string;
  addressLine: string;
  phone?: string;
  isDefault?: boolean;
}

export interface AddressUpdateData {
  name?: string;
  label?: string;
  pincode?: string;
  city?: string;
  state?: string;
  addressLine?: string;
  phone?: string;
  isDefault?: boolean;
}

export interface AddressesResponse {
  success: boolean;
  addresses: AddressData[];
  defaultAddressId: string | null;
}

export class UserAddressService {
  private userRepository: UserRepository;

  constructor() {
    this.userRepository = new UserRepository();
  }

  async getUserAddresses(userId: string): Promise<AddressesResponse> {
    try {
      const user = await this.userRepository.findById(userId);

      if (!user) {
        return { success: false, addresses: [], defaultAddressId: null };
      }

      const transformedAddresses = (user.addresses || []).map((addr: any) => ({
        ...addr.toObject(),
        id: addr._id.toString(),
      }));

      const defaultAddress = user.addresses.find((addr: any) => addr.isDefault);
      const defaultAddressId = defaultAddress ? defaultAddress._id.toString() : null;

      return {
        success: true,
        addresses: transformedAddresses,
        defaultAddressId,
      };
    } catch (error) {
      console.error("Error fetching user addresses:", error);
      throw error;
    }
  }

  async addUserAddress(userId: string, addressData: AddressCreateData): Promise<AddressData> {
    try {
      const { name, label, pincode, city, state, addressLine, phone, isDefault } = addressData;

      if (!label || !pincode || !city || !addressLine) {
        throw new Error("Missing required fields");
      }

      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      let geocodeResult = await smartGeocode(addressLine, city, state, pincode);
      let coordsSource: 'geocoded' | 'pincode' = 'geocoded';
      
      if (!geocodeResult) {
        geocodeResult = await geocodeByPincode(pincode);
        
        if (geocodeResult) {
          coordsSource = 'pincode';
        } else {
          throw new Error("Unable to locate this address or pincode");
        }
      }

      if (isDefault) {
        user.addresses.forEach((addr: any) => {
          addr.isDefault = false;
        });
      }

      const newAddress: IAddress = {
        _id: new mongoose.Types.ObjectId(),
        name: name || "",
        label,
        pincode,
        city,
        state,
        postal_district: "",
        admin_district: "",
        addressLine,
        phone: phone || "",
        lat: geocodeResult.lat,
        lng: geocodeResult.lng,
        isDefault: isDefault || false,
        isGeocoded: true,
        coordsSource: coordsSource,
      };

      const resolved = await resolvePincodeForAddressSave(pincode);
      if (!resolved) {
        throw new Error("Invalid pincode");
      }

      newAddress.state = resolved.state;
      newAddress.postal_district = resolved.postal_district;
      newAddress.admin_district = resolved.admin_district;

      user.addresses.push(newAddress);
      await this.userRepository.save(user);

      const savedAddress: any = user.addresses[user.addresses.length - 1];

      return {
        ...(savedAddress.toObject ? savedAddress.toObject() : savedAddress),
        id: savedAddress._id.toString(),
      };
    } catch (error) {
      console.error("Error adding user address:", error);
      throw error;
    }
  }

  async updateUserAddress(userId: string, addressId: string, updateData: AddressUpdateData): Promise<AddressData> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const address = user.addresses.find(
        (addr: any) => addr._id.toString() === addressId
      );
      if (!address) {
        throw new Error("Address not found");
      }

      const { name, label, pincode, city, state, addressLine, phone, isDefault } = updateData;

      const addressChanged = 
        (addressLine && addressLine !== address.addressLine) ||
        (city && city !== address.city) ||
        (state && state !== address.state) ||
        (pincode && pincode !== address.pincode);

      if (addressChanged) {
        const finalAddressLine = addressLine || address.addressLine;
        const finalCity = city || address.city;
        const finalState = state || address.state;
        const finalPincode = pincode || address.pincode;
        
        let geocodeResult = await smartGeocode(finalAddressLine, finalCity, finalState, finalPincode);
        let coordsSource: 'geocoded' | 'pincode' = 'geocoded';
        
        if (!geocodeResult) {
          geocodeResult = await geocodeByPincode(finalPincode);
          
          if (geocodeResult) {
            coordsSource = 'pincode';
          } else {
            throw new Error("Unable to locate this address or pincode");
          }
        }
        
        address.lat = geocodeResult.lat;
        address.lng = geocodeResult.lng;
        address.isGeocoded = true;
        address.coordsSource = coordsSource;
      }

      if (name !== undefined) address.name = name || "";
      if (label) address.label = label;
      if (pincode) address.pincode = pincode;
      if (city) address.city = city;
      if (state) address.state = state;
      if (addressLine) address.addressLine = addressLine;
      if (phone !== undefined) address.phone = phone || "";
      if (isDefault !== undefined) {
        if (isDefault) {
          user.addresses.forEach((addr: any) => {
            if (addr._id.toString() !== addressId) {
              addr.isDefault = false;
            }
          });
        }
        address.isDefault = isDefault;
      }

      const finalPincode = (pincode || address.pincode || "").toString();
      const finalCity = (city || address.city || "").toString();
      const resolved = await resolvePincodeForAddressSave(finalPincode);
      if (!resolved) {
        throw new Error("Invalid pincode");
      }

      if (!finalCity || !finalCity.trim()) {
        throw new Error("City is required");
      }

      address.state = resolved.state;
      address.postal_district = resolved.postal_district;
      address.admin_district = resolved.admin_district;

      await this.userRepository.save(user);

      return {
        ...address,
        id: address._id.toString(),
      };
    } catch (error) {
      console.error("Error updating user address:", error);
      throw error;
    }
  }

  async deleteUserAddress(userId: string, addressId: string): Promise<{ success: boolean; defaultUpdated: boolean }> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const address = user.addresses.find(
        (addr: any) => addr._id.toString() === addressId
      );
      if (!address) {
        throw new Error("Address not found");
      }

      const wasDefault = address.isDefault;

      user.addresses = user.addresses.filter(
        (addr: any) => addr._id.toString() !== addressId
      );

      if (wasDefault && user.addresses.length > 0) {
        user.addresses[0].isDefault = true;
      }

      await this.userRepository.save(user);

      return {
        success: true,
        defaultUpdated: wasDefault && user.addresses.length > 0,
      };
    } catch (error) {
      console.error("Error deleting user address:", error);
      throw error;
    }
  }

  async setDefaultAddress(userId: string, addressId: string): Promise<AddressData> {
    try {
      const user = await this.userRepository.findById(userId);
      if (!user) {
        throw new Error("User not found");
      }

      const address = user.addresses.find(
        (addr: any) => addr._id.toString() === addressId
      );
      if (!address) {
        throw new Error("Address not found");
      }

      user.addresses.forEach((addr: any) => {
        addr.isDefault = false;
      });

      address.isDefault = true;

      await this.userRepository.save(user);

      return {
        ...address,
        id: address._id.toString(),
      };
    } catch (error) {
      console.error("Error setting default address:", error);
      throw error;
    }
  }
}
