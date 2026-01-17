"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.close = exports.clear = exports.connect = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const mongodb_memory_server_1 = require("mongodb-memory-server");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({ path: '.env.test', override: true });
let mongoServer = null;
let ownsConnection = false;
const connect = async () => {
    // If another Jest setup already connected mongoose, reuse it.
    if (mongoose_1.default.connection.readyState !== 0) {
        return;
    }
    if (mongoServer) {
        // Already initialized
        return;
    }
    mongoServer = await mongodb_memory_server_1.MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    // Ensure we never accidentally hit the real DB in tests
    process.env.MONGO_URI = uri;
    await mongoose_1.default.connect(uri, {
        dbName: 'test-db',
    });
    ownsConnection = true;
};
exports.connect = connect;
const clear = async () => {
    if (!mongoose_1.default.connection.db)
        return;
    const collections = await mongoose_1.default.connection.db.collections();
    for (const collection of collections) {
        await collection.deleteMany({});
    }
};
exports.clear = clear;
const close = async () => {
    if (ownsConnection) {
        await mongoose_1.default.connection.dropDatabase().catch(() => undefined);
        await mongoose_1.default.connection.close().catch(() => undefined);
        if (mongoServer) {
            await mongoServer.stop();
            mongoServer = null;
        }
        ownsConnection = false;
    }
};
exports.close = close;
/**
 * Global Jest setup for integration tests.
 * - Starts an in-memory MongoDB instance
 * - Points Mongoose at that instance
 * - Clears all collections between tests
 */
beforeAll(async () => {
    await (0, exports.connect)();
});
beforeEach(async () => {
    await (0, exports.clear)();
});
afterAll(async () => {
    await (0, exports.close)();
});
