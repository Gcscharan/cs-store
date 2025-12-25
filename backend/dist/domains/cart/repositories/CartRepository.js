"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CartRepository = void 0;
const Cart_1 = require("../../../models/Cart");
const mongodb_1 = require("mongodb");
class CartRepository {
    async findByUserId(userId) {
        return await Cart_1.Cart.findOne({ userId });
    }
    async findByUserIdWithPopulate(userId) {
        return await Cart_1.Cart.findOne({ userId }).populate("items.productId");
    }
    async create(userId) {
        const cart = new Cart_1.Cart({
            userId,
            items: [],
            total: 0,
            itemCount: 0,
        });
        return await cart.save();
    }
    async save(cart) {
        return await cart.save();
    }
    async updateOne(userId, updateData) {
        return await Cart_1.Cart.findOneAndUpdate({ userId }, updateData, { new: true });
    }
    async atomicAddToCart(userId, productId, name, price, image, quantity) {
        // Convert productId to ObjectId for consistent comparison
        const productObjectId = new mongodb_1.ObjectId(productId);
        return await Cart_1.Cart.findOneAndUpdate({ userId }, [
            {
                $set: {
                    items: {
                        $cond: {
                            // Check if product already exists in items array (ObjectId comparison)
                            if: {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: { $ifNull: ['$items', []] },
                                                as: 'item',
                                                cond: { $eq: ['$$item.productId', productObjectId] }
                                            }
                                        }
                                    },
                                    0
                                ]
                            },
                            then: {
                                $map: {
                                    input: '$items',
                                    as: 'item',
                                    in: {
                                        $cond: {
                                            if: { $eq: ['$$item.productId', productObjectId] },
                                            then: {
                                                $mergeObjects: [
                                                    '$$item',
                                                    { quantity: { $add: ['$$item.quantity', quantity] } }
                                                ]
                                            },
                                            else: '$$item'
                                        }
                                    }
                                }
                            },
                            else: {
                                $concatArrays: [
                                    { $ifNull: ['$items', []] },
                                    [{
                                            productId: productObjectId,
                                            name,
                                            price,
                                            image,
                                            quantity
                                        }]
                                ]
                            }
                        }
                    }
                }
            },
            {
                $set: {
                    total: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                in: { $multiply: ['$$item.price', '$$item.quantity'] },
                            },
                        },
                    },
                    itemCount: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                in: '$$item.quantity',
                            },
                        },
                    },
                }
            }
        ], { new: true, upsert: true });
    }
    async atomicUpdateCartItem(userId, productId, quantity) {
        // Convert productId to ObjectId for consistent comparison
        const productObjectId = new mongodb_1.ObjectId(productId);
        if (quantity <= 0) {
            // Remove item when quantity is zero or negative
            return await Cart_1.Cart.findOneAndUpdate({ userId }, [
                {
                    $set: {
                        items: {
                            $filter: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                cond: { $ne: ['$$item.productId', productObjectId] },
                            },
                        },
                    },
                },
                {
                    $set: {
                        total: {
                            $sum: {
                                $map: {
                                    input: { $ifNull: ['$items', []] },
                                    as: 'item',
                                    in: { $multiply: ['$$item.price', '$$item.quantity'] },
                                },
                            },
                        },
                        itemCount: {
                            $sum: {
                                $map: {
                                    input: { $ifNull: ['$items', []] },
                                    as: 'item',
                                    in: '$$item.quantity',
                                },
                            },
                        },
                    },
                },
            ], { new: true });
        }
        // Update quantity for an existing item using an aggregation pipeline
        return await Cart_1.Cart.findOneAndUpdate({ userId }, [
            {
                $set: {
                    items: {
                        $map: {
                            input: { $ifNull: ['$items', []] },
                            as: 'item',
                            in: {
                                $cond: {
                                    if: { $eq: ['$$item.productId', productObjectId] },
                                    then: {
                                        $mergeObjects: ['$$item', { quantity }],
                                    },
                                    else: '$$item',
                                },
                            },
                        },
                    },
                },
            },
            {
                $set: {
                    total: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                in: { $multiply: ['$$item.price', '$$item.quantity'] },
                            },
                        },
                    },
                    itemCount: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                in: '$$item.quantity',
                            },
                        },
                    },
                },
            },
        ], { new: true });
    }
    async atomicRemoveFromCart(userId, productId) {
        // Convert productId to ObjectId for consistent comparison
        const productObjectId = new mongodb_1.ObjectId(productId);
        return await Cart_1.Cart.findOneAndUpdate({ userId }, [
            {
                $set: {
                    items: {
                        $filter: {
                            input: '$items',
                            as: 'item',
                            cond: { $ne: ['$$item.productId', productObjectId] }
                        }
                    }
                }
            },
            {
                $set: {
                    total: { $sum: { $map: { input: '$items', as: 'item', in: { $multiply: ['$$item.price', '$$item.quantity'] } } } },
                    itemCount: { $sum: '$items.quantity' }
                }
            }
        ], { new: true });
    }
    async atomicClearCart(userId) {
        return await Cart_1.Cart.findOneAndUpdate({ userId }, {
            $set: {
                items: [],
                total: 0,
                itemCount: 0
            }
        }, { new: true });
    }
    /**
     * ADMIN ONLY: Cleanup duplicate product items in a cart
     *
     * This helper merges duplicate product entries that may have been created
     * due to the productId type mismatch bug. It should be run manually
     * by an admin to clean up corrupted carts.
     *
     * WARNING: This is a one-time cleanup utility and should NOT be called
     * during normal cart operations. It modifies cart data directly.
     *
     * @param userId - User ID whose cart needs cleanup
     * @returns Promise<any> - Updated cart with merged items
     */
    async cleanupDuplicateItems(userId) {
        return await Cart_1.Cart.findOneAndUpdate({ userId }, [
            {
                $set: {
                    items: {
                        $reduce: {
                            input: { $ifNull: ['$items', []] },
                            initialValue: [],
                            in: {
                                $let: {
                                    vars: {
                                        existingItem: {
                                            $first: {
                                                $filter: {
                                                    input: '$$value',
                                                    as: 'existing',
                                                    cond: { $eq: ['$$existing.productId', '$$this.productId'] }
                                                }
                                            }
                                        }
                                    },
                                    in: {
                                        $cond: {
                                            if: { $ne: ['$$existingItem', null] },
                                            then: {
                                                $map: {
                                                    input: '$$value',
                                                    as: 'item',
                                                    in: {
                                                        $cond: {
                                                            if: { $eq: ['$$item.productId', '$$this.productId'] },
                                                            then: {
                                                                $mergeObjects: [
                                                                    '$$item',
                                                                    {
                                                                        quantity: {
                                                                            $add: ['$$item.quantity', '$$this.quantity']
                                                                        }
                                                                    }
                                                                ]
                                                            },
                                                            else: '$$item'
                                                        }
                                                    }
                                                }
                                            },
                                            else: { $concatArrays: ['$$value', ['$$this']] }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            {
                $set: {
                    total: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                in: { $multiply: ['$$item.price', '$$item.quantity'] }
                            }
                        }
                    },
                    itemCount: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ['$items', []] },
                                as: 'item',
                                in: '$$item.quantity'
                            }
                        }
                    }
                }
            }
        ], { new: true });
    }
}
exports.CartRepository = CartRepository;
