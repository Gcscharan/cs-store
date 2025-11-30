"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.csrfProtection = void 0;
const csrfProtection = (req, res, next) => {
    // Skip CSRF for GET, HEAD, OPTIONS requests
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }
    // Get CSRF token from header and cookie
    const headerCsrfToken = req.headers['x-csrf-token'];
    const cookieCsrfToken = req.cookies.csrf_token;
    // Validate CSRF token
    if (!headerCsrfToken || !cookieCsrfToken || headerCsrfToken !== cookieCsrfToken) {
        return res.status(403).json({ message: 'Invalid CSRF token' });
    }
    next();
};
exports.csrfProtection = csrfProtection;
