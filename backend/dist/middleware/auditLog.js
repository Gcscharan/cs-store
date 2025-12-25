"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditLog = void 0;
const auditLog = (req, res, next) => {
    try {
        const user = req.user;
        const action = req.method + ' ' + req.originalUrl;
        const targetId = req.params.id || req.body.id;
        const timestamp = new Date().toISOString();
        console.log(`AUDIT LOG - User: ${user?.email || 'anonymous'}, Action: ${action}, Target: ${targetId}, Time: ${timestamp}`);
        // In production, this would write to a secure audit database
        if (process.env.NODE_ENV === 'production') {
            // TODO: Implement secure audit logging
        }
    }
    catch (error) {
        console.error('Audit logging failed:', error);
    }
    next();
};
exports.auditLog = auditLog;
