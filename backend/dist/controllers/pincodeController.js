"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkPincodeController = exports.getValidPincodeRangesController = exports.validateBulkPincodesController = exports.validatePincodeController = void 0;
const Pincode_1 = require("../models/Pincode");
const validatePincode = (pincode) => {
    if (!pincode || pincode.length !== 6)
        return false;
    if (!/^\d{6}$/.test(pincode))
        return false;
    const pincodeNum = parseInt(pincode);
    const validRanges = [
        { start: 500001, end: 599999 },
    ];
    const isValid = validRanges.some((range) => pincodeNum >= range.start && pincodeNum <= range.end);
    const invalidRanges = [
        { start: 360001, end: 399999 },
        { start: 380001, end: 389999 },
        { start: 400001, end: 499999 },
        { start: 600001, end: 699999 },
        { start: 670001, end: 699999 },
        { start: 110001, end: 110096 },
        { start: 700001, end: 799999 },
        { start: 800001, end: 899999 },
        { start: 200001, end: 299999 },
        { start: 100001, end: 199999 },
        { start: 300001, end: 349999 },
        { start: 140001, end: 199999 },
        { start: 120001, end: 139999 },
        { start: 450001, end: 499999 },
        { start: 750001, end: 799999 },
        { start: 780001, end: 799999 },
        { start: 800001, end: 899999 },
        { start: 490001, end: 499999 },
        { start: 240001, end: 249999 },
        { start: 170001, end: 179999 },
        { start: 180001, end: 199999 },
        { start: 403001, end: 403999 },
        { start: 795001, end: 799999 },
        { start: 793001, end: 799999 },
        { start: 796001, end: 799999 },
        { start: 797001, end: 799999 },
        { start: 737101, end: 737999 },
        { start: 799001, end: 799999 },
        { start: 790001, end: 799999 },
    ];
    const isFromOtherState = invalidRanges.some((range) => pincodeNum >= range.start && pincodeNum <= range.end);
    return isValid && !isFromOtherState;
};
const getPincodeErrorMessage = (pincode) => {
    if (!pincode || pincode.length !== 6) {
        return "Please enter a valid 6-digit pincode";
    }
    if (!/^\d{6}$/.test(pincode)) {
        return "Please enter a valid 6-digit pincode";
    }
    const pincodeNum = parseInt(pincode);
    const isFromOtherState = [
        { start: 360001, end: 399999 },
        { start: 400001, end: 499999 },
        { start: 600001, end: 699999 },
        { start: 110001, end: 110096 },
        { start: 700001, end: 799999 },
        { start: 800001, end: 899999 },
        { start: 200001, end: 299999 },
        { start: 100001, end: 199999 },
        { start: 300001, end: 349999 },
        { start: 140001, end: 199999 },
        { start: 120001, end: 139999 },
    ].some((range) => pincodeNum >= range.start && pincodeNum <= range.end);
    if (isFromOtherState) {
        return "Sorry, we are unable to deliver to this location. We currently deliver only to Andhra Pradesh and Telangana.";
    }
    return "Sorry, we are unable to deliver to this location.";
};
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
//# sourceMappingURL=pincodeController.js.map