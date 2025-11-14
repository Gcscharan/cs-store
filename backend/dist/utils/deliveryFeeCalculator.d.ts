import { IAddress } from "../models/User";
export declare function getRoadDistance(userAddress: IAddress): Promise<number>;
export declare function calculateHaversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number;
export declare function calculateDeliveryFee(userAddress: IAddress, orderAmount: number): Promise<{
    distance: number;
    baseFee: number;
    distanceFee: number;
    totalFee: number;
    isFreeDelivery: boolean;
    finalFee: number;
    distanceFrom: string;
}>;
export declare function getAdminAddress(): IAddress;
export declare function isDeliveryAvailable(pincode: string): boolean;
export declare function getDeliveryFeeBreakdown(userAddress: IAddress, orderAmount: number): Promise<{
    distance: string;
    baseFee: string;
    distanceFee: string;
    totalFee: string;
    isFreeDelivery: boolean;
    finalFee: string;
    message: string;
    distanceFrom: string;
}>;
//# sourceMappingURL=deliveryFeeCalculator.d.ts.map