// Mock Notification Service for Firebase Cloud Messaging
// In a real production environment, this would use firebase-admin

export const sendPushNotification = async (
  userId: string,
  title: string,
  body: string,
  data?: any
) => {
  console.log(`[PUSH NOTIFICATION] To User: ${userId}`);
  console.log(`[PUSH NOTIFICATION] Title: ${title}`);
  console.log(`[PUSH NOTIFICATION] Body: ${body}`);
  if (data) {
    console.log(`[PUSH NOTIFICATION] Data:`, data);
  }
  
  // TODO: Fetch user's FCM token from DB
  // const user = await User.findById(userId);
  // if (!user?.fcmToken) return;
  
  // TODO: Send via firebase-admin
  // await admin.messaging().send({
  //   token: user.fcmToken,
  //   notification: { title, body },
  //   data,
  // });
};

export const triggerCartAbandonmentNotification = async (userId: string) => {
  await sendPushNotification(
    userId,
    "Your items are waiting 🛒",
    "Complete your order now and get fast delivery!"
  );
};

export const triggerPaymentFailureNotification = async (userId: string, orderId: string) => {
  await sendPushNotification(
    userId,
    "Payment failed ⚠️",
    "Your recent payment attempt failed. Tap here to retry and complete your order.",
    { orderId }
  );
};

export const triggerOrderUpdateNotification = async (userId: string, orderId: string, status: string) => {
  let title = "Order Update";
  let body = `Your order status is now: ${status}`;

  if (status === 'OUT_FOR_DELIVERY') {
    title = "Order out for delivery 🚴";
    body = "Your order is on its way and will reach you shortly!";
  } else if (status === 'DELIVERED') {
    title = "Order Delivered 🎉";
    body = "Your order has been delivered. Enjoy!";
  }

  await sendPushNotification(userId, title, body, { orderId });
};
