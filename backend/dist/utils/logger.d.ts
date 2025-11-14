interface LogContext {
    userId?: string;
    orderId?: string;
    paymentId?: string;
    requestId?: string;
    [key: string]: any;
}
declare class Logger {
    private context;
    setContext(context: LogContext): void;
    clearContext(): void;
    private formatMessage;
    info(message: string, data?: any): void;
    warn(message: string, data?: any): void;
    error(message: string, error?: Error, data?: any): void;
    debug(message: string, data?: any): void;
    auth(message: string, data?: any): void;
    payment(message: string, data?: any): void;
    order(message: string, data?: any): void;
    delivery(message: string, data?: any): void;
    admin(message: string, data?: any): void;
    security(message: string, data?: any): void;
    performance(operation: string, duration: number, data?: any): void;
    metrics(event: string, value: number, data?: any): void;
}
export declare const logger: Logger;
export declare const initializeSentry: () => void;
export declare const sentryMiddleware: {
    requestHandler: () => (req: any, res: any, next: any) => any;
    tracingHandler: () => (req: any, res: any, next: any) => any;
    errorHandler: () => (err: any, req: any, res: any, next: any) => any;
};
export declare const logAuthAttempt: (email: string, success: boolean, ip: string) => void;
export declare const logPaymentEvent: (orderId: string, event: string, amount: number, data?: any) => void;
export declare const logOrderEvent: (orderId: string, event: string, userId: string, data?: any) => void;
export declare const logSecurityEvent: (event: string, severity: "low" | "medium" | "high", data?: any) => void;
export declare const logPerformance: (operation: string, startTime: number, data?: any) => void;
export declare const logBusinessMetric: (metric: string, value: number, data?: any) => void;
export default logger;
//# sourceMappingURL=logger.d.ts.map