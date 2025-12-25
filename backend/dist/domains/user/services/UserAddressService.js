"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserAddressService = void 0;
const UserRepository_1 = require("../repositories/UserRepository");
const mongoose_1 = __importDefault(require("mongoose"));
const geocoding_1 = require("../../../utils/geocoding");
const Pincode_1 = require("../../../models/Pincode");
class UserAddressService {
    constructor() {
        this.userRepository = new UserRepository_1.UserRepository();
    }
    async getUserAddresses(userId) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                return { success: false, addresses: [], defaultAddressId: null };
            }
            const transformedAddresses = (user.addresses || []).map((addr) => ({
                ...addr.toObject(),
                id: addr._id.toString(),
            }));
            const defaultAddress = user.addresses.find((addr) => addr.isDefault);
            const defaultAddressId = defaultAddress ? defaultAddress._id.toString() : null;
            return {
                success: true,
                addresses: transformedAddresses,
                defaultAddressId,
            };
        }
        catch (error) {
            console.error("Error fetching user addresses:", error);
            throw error;
        }
    }
    async addUserAddress(userId, addressData) {
        try {
            const { name, label, pincode, city: _city, state: _state, addressLine, phone, isDefault } = addressData;
            if (!label || !pincode || !addressLine) {
                throw new Error("Missing required fields");
            }
            const canonicalPincode = String(pincode);
            const pincodeData = await Pincode_1.Pincode.findOne({ pincode: canonicalPincode });
            if (!pincodeData) {
                throw new Error("Enter a valid pincode to continue");
            }
            const canonicalState = pincodeData.state;
            const canonicalCity = pincodeData.taluka || pincodeData.district || "";
            if (!canonicalCity) {
                throw new Error("Enter a valid pincode to continue");
            }
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
            let geocodeResult = await (0, geocoding_1.smartGeocode)(addressLine, canonicalCity, canonicalState, canonicalPincode);
            let coordsSource = 'geocoded';
            if (!geocodeResult) {
                const { geocodeByPincode } = require('../../../../utils/geocoding');
                geocodeResult = await geocodeByPincode(canonicalPincode);
                if (geocodeResult) {
                    coordsSource = 'pincode';
                }
                else {
                    throw new Error("Unable to locate this address or pincode");
                }
            }
            if (isDefault) {
                user.addresses.forEach((addr) => {
                    addr.isDefault = false;
                });
            }
            const newAddress = {
                _id: new mongoose_1.default.Types.ObjectId(),
                name: name || "",
                label,
                pincode: canonicalPincode,
                city: canonicalCity,
                state: canonicalState,
                addressLine,
                phone: phone || "",
                lat: geocodeResult.lat,
                lng: geocodeResult.lng,
                isDefault: isDefault || false,
                isGeocoded: true,
                coordsSource: coordsSource,
            };
            user.addresses.push(newAddress);
            await this.userRepository.save(user);
            const savedAddress = user.addresses[user.addresses.length - 1];
            return {
                ...(savedAddress.toObject ? savedAddress.toObject() : savedAddress),
                id: savedAddress._id.toString(),
            };
        }
        catch (error) {
            console.error("Error adding user address:", error);
            throw error;
        }
    }
    async updateUserAddress(userId, addressId, updateData) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
            const address = user.addresses.find((addr) => addr._id.toString() === addressId);
            if (!address) {
                throw new Error("Address not found");
            }
            const { name, label, pincode, city: _city, state: _state, addressLine, phone, isDefault } = updateData;
            let canonicalPincode = address.pincode;
            if (pincode) {
                canonicalPincode = String(pincode);
            }
            const pincodeData = await Pincode_1.Pincode.findOne({ pincode: canonicalPincode });
            if (!pincodeData) {
                throw new Error("Enter a valid pincode to continue");
            }
            const canonicalState = pincodeData.state;
            const canonicalCity = pincodeData.district || pincodeData.taluka || "";
            if (!canonicalCity) {
                throw new Error("Enter a valid pincode to continue");
            }
            const addressChanged = (addressLine && addressLine !== address.addressLine) ||
                (pincode && pincode !== address.pincode);
            if (addressChanged) {
                const finalAddressLine = addressLine || address.addressLine;
                const finalCity = canonicalCity;
                const finalState = canonicalState;
                const finalPincode = canonicalPincode;
                let geocodeResult = await (0, geocoding_1.smartGeocode)(finalAddressLine, finalCity, finalState, finalPincode);
                let coordsSource = 'geocoded';
                if (!geocodeResult) {
                    const { geocodeByPincode } = require('../../../../utils/geocoding');
                    geocodeResult = await geocodeByPincode(finalPincode);
                    if (geocodeResult) {
                        coordsSource = 'pincode';
                    }
                    else {
                        throw new Error("Unable to locate this address or pincode");
                    }
                }
                address.lat = geocodeResult.lat;
                address.lng = geocodeResult.lng;
                address.isGeocoded = true;
                address.coordsSource = coordsSource;
            }
            if (name !== undefined)
                address.name = name || "";
            if (label)
                address.label = label;
            address.pincode = canonicalPincode;
            address.city = canonicalCity;
            address.state = canonicalState;
            if (addressLine)
                address.addressLine = addressLine;
            if (phone !== undefined)
                address.phone = phone || "";
            if (isDefault !== undefined) {
                if (isDefault) {
                    user.addresses.forEach((addr) => {
                        if (addr._id.toString() !== addressId) {
                            addr.isDefault = false;
                        }
                    });
                }
                address.isDefault = isDefault;
            }
            await this.userRepository.save(user);
            return {
                ...address,
                id: address._id.toString(),
            };
        }
        catch (error) {
            console.error("Error updating user address:", error);
            throw error;
        }
    }
    async deleteUserAddress(userId, addressId) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
            const address = user.addresses.find((addr) => addr._id.toString() === addressId);
            if (!address) {
                throw new Error("Address not found");
            }
            const wasDefault = address.isDefault;
            user.addresses = user.addresses.filter((addr) => addr._id.toString() !== addressId);
            if (wasDefault && user.addresses.length > 0) {
                user.addresses[0].isDefault = true;
            }
            await this.userRepository.save(user);
            return {
                success: true,
                defaultUpdated: wasDefault && user.addresses.length > 0,
            };
        }
        catch (error) {
            console.error("Error deleting user address:", error);
            throw error;
        }
    }
    async setDefaultAddress(userId, addressId) {
        try {
            const user = await this.userRepository.findById(userId);
            if (!user) {
                throw new Error("User not found");
            }
            const address = user.addresses.find((addr) => addr._id.toString() === addressId);
            if (!address) {
                throw new Error("Address not found");
            }
            user.addresses.forEach((addr) => {
                addr.isDefault = false;
            });
            address.isDefault = true;
            await this.userRepository.save(user);
            return {
                ...address,
                id: address._id.toString(),
            };
        }
        catch (error) {
            console.error("Error setting default address:", error);
            throw error;
        }
    }
}
exports.UserAddressService = UserAddressService;
