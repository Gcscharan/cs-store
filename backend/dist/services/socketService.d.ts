import { Server as HTTPServer } from "http";
declare class SocketService {
    private io;
    private connectedUsers;
    constructor(server: HTTPServer);
    private setupMiddleware;
    private setupEventHandlers;
    sendOTPToUser(userId: string, otpData: any): boolean;
    sendOTPVerificationResult(userId: string, result: any): boolean;
    sendPaymentStatusUpdate(userId: string, status: any): boolean;
    getConnectedUsersCount(): number;
    getConnectedUsers(): string[];
}
export default SocketService;
//# sourceMappingURL=socketService.d.ts.map