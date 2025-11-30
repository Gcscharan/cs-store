"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPincodeController = exports.getValidPincodeRangesController = exports.validateBulkPincodesController = exports.validatePincodeController = void 0;
const Pincode_1 = require("../models/Pincode");
// Comprehensive pincode validation for Andhra Pradesh and Telangana
const validatePincode = (pincode) => {
    if (!pincode || pincode.length !== 6)
        return false;
    // Check if pincode is numeric
    if (!/^\d{6}$/.test(pincode))
        return false;
    const pincodeNum = parseInt(pincode);
    // Andhra Pradesh and Telangana pincode ranges
    const validRanges = [
        { start: 500001, end: 599999 }, // AP and Telangana combined range
    ];
    // Check if pincode falls within AP/Telangana ranges
    const isValid = validRanges.some((range) => pincodeNum >= range.start && pincodeNum <= range.end);
    // Additional validation: Explicitly exclude pincodes from other states
    const invalidRanges = [
        // Gujarat
        { start: 360001, end: 399999 },
        { start: 380001, end: 389999 },
        // Maharashtra
        { start: 400001, end: 499999 },
        // Tamil Nadu
        { start: 600001, end: 699999 },
        // Kerala
        { start: 670001, end: 699999 },
        // Delhi
        { start: 110001, end: 110096 },
        // West Bengal
        { start: 700001, end: 799999 },
        // Bihar
        { start: 800001, end: 899999 },
        // Uttar Pradesh
        { start: 200001, end: 299999 },
        { start: 100001, end: 199999 },
        // Rajasthan
        { start: 300001, end: 349999 },
        // Punjab
        { start: 140001, end: 199999 },
        // Haryana
        { start: 120001, end: 139999 },
        // Madhya Pradesh
        { start: 450001, end: 499999 },
        // Odisha
        { start: 750001, end: 799999 },
        // Assam
        { start: 780001, end: 799999 },
        // Jharkhand
        { start: 800001, end: 899999 },
        // Chhattisgarh
        { start: 490001, end: 499999 },
        // Uttarakhand
        { start: 240001, end: 249999 },
        // Himachal Pradesh
        { start: 170001, end: 179999 },
        // Jammu and Kashmir
        { start: 180001, end: 199999 },
        // Goa
        { start: 403001, end: 403999 },
        // Manipur
        { start: 795001, end: 799999 },
        // Meghalaya
        { start: 793001, end: 799999 },
        // Mizoram
        { start: 796001, end: 799999 },
        // Nagaland
        { start: 797001, end: 799999 },
        // Sikkim
        { start: 737101, end: 737999 },
        // Tripura
        { start: 799001, end: 799999 },
        // Arunachal Pradesh
        { start: 790001, end: 799999 },
    ];
    // Check if pincode is from other states (should be invalid)
    const isFromOtherState = invalidRanges.some((range) => pincodeNum >= range.start && pincodeNum <= range.end);
    // Return true only if it's valid for AP/Telangana AND not from other states
    return isValid && !isFromOtherState;
};
// Get error message for invalid pincode
const getPincodeErrorMessage = (pincode) => {
    if (!pincode || pincode.length !== 6) {
        return "Please enter a valid 6-digit pincode";
    }
    if (!/^\d{6}$/.test(pincode)) {
        return "Please enter a valid 6-digit pincode";
    }
    const pincodeNum = parseInt(pincode);
    const isFromOtherState = [
        { start: 360001, end: 399999 }, // Gujarat
        { start: 400001, end: 499999 }, // Maharashtra
        { start: 600001, end: 699999 }, // Tamil Nadu
        { start: 110001, end: 110096 }, // Delhi
        { start: 700001, end: 799999 }, // West Bengal
        { start: 800001, end: 899999 }, // Bihar
        { start: 200001, end: 299999 }, // Uttar Pradesh
        { start: 100001, end: 199999 }, // Uttar Pradesh
        { start: 300001, end: 349999 }, // Rajasthan
        { start: 140001, end: 199999 }, // Punjab
        { start: 120001, end: 139999 }, // Haryana
    ].some((range) => pincodeNum >= range.start && pincodeNum <= range.end);
    if (isFromOtherState) {
        return "Sorry, we are unable to deliver to this location. We currently deliver only to Andhra Pradesh and Telangana.";
    }
    return "Sorry, we are unable to deliver to this location.";
};
// Validate pincode endpoint
const validatePincodeController = async (req, res) => {
    try {
        const { pincode } = req.body;
        if (!pincode) {
            res.status(400).json({
                success: false,
                message: "Pincode is required",
                valid: false,
            });
            return;
        }
        const isValid = validatePincode(pincode);
        const errorMessage = isValid ? null : getPincodeErrorMessage(pincode);
        res.status(200).json({
            success: true,
            valid: isValid,
            pincode,
            message: isValid ? "Pincode is valid for delivery" : errorMessage,
            deliveryAvailable: isValid,
        });
    }
    catch (error) {
        console.error("Pincode validation error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            valid: false,
        });
    }
};
exports.validatePincodeController = validatePincodeController;
// Bulk validate pincodes endpoint
const validateBulkPincodesController = async (req, res) => {
    try {
        const { pincodes } = req.body;
        if (!Array.isArray(pincodes)) {
            res.status(400).json({
                success: false,
                message: "Pincodes array is required",
            });
            return;
        }
        const results = pincodes.map((pincode) => ({
            pincode,
            valid: validatePincode(pincode),
            errorMessage: validatePincode(pincode)
                ? null
                : getPincodeErrorMessage(pincode),
        }));
        res.status(200).json({
            success: true,
            results,
            totalValid: results.filter((r) => r.valid).length,
            totalInvalid: results.filter((r) => !r.valid).length,
        });
    }
    catch (error) {
        console.error("Bulk pincode validation error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.validateBulkPincodesController = validateBulkPincodesController;
// Get valid pincode ranges endpoint
const getValidPincodeRangesController = async (req, res) => {
    try {
        const validRanges = [
            { start: 500001, end: 599999, state: "Andhra Pradesh and Telangana" },
        ];
        res.status(200).json({
            success: true,
            ranges: validRanges,
            totalCoverage: "Approximately 16,000 pincodes",
            states: ["Andhra Pradesh", "Telangana"],
        });
    }
    catch (error) {
        console.error("Get pincode ranges error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};
exports.getValidPincodeRangesController = getValidPincodeRangesController;
// Check pincode deliverability endpoint
const checkPincodeController = async (req, res) => {
    try {
        const { pincode } = req.params;
        if (!pincode || pincode.length !== 6 || !/^\d{6}$/.test(pincode)) {
            res.status(200).json({
                deliverable: false,
                message: "Not deliverable to this location or pincode",
            });
            return;
        }
        // Check if pincode exists in database
        const pincodeData = await Pincode_1.Pincode.findOne({ pincode });
        if (pincodeData) {
            res.status(200).json({
                deliverable: true,
                state: pincodeData.state,
                district: pincodeData.district,
                taluka: pincodeData.taluka,
            });
        }
        else {
            res.status(200).json({
                deliverable: false,
                message: "Not deliverable to this location or pincode",
            });
        }
    }
    catch (error) {
        console.error("Pincode check error:", error);
        res.status(500).json({
            deliverable: false,
            message: "Internal server error",
        });
    }
};
exports.checkPincodeController = checkPincodeController;
