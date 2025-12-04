const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Mock user data
const mockUser = {
  id: 'test-user-id',
  name: 'Test User',
  email: 'test+dev@local',
  phone: '+14155552671',
  role: 'customer'
};

// Mock endpoints for Module 2 testing
app.get('/api/user/profile', (req, res) => {
  res.json({
    success: true,
    user: mockUser
  });
});

app.put('/api/user/profile', (req, res) => {
  const { name, phone, email } = req.body;
  
  // Handle email change requirement
  if (email && email !== mockUser.email) {
    return res.json({
      success: true,
      message: "Email change requires verification",
      emailChangePending: true,
      pendingEmail: email,
      user: mockUser
    });
  }
  
  // Update other fields
  if (name) mockUser.name = name;
  if (phone) mockUser.phone = phone;
  
  res.json({
    success: true,
    message: "Profile updated successfully",
    user: mockUser
  });
});

app.get('/api/user/notification-preferences', (req, res) => {
  res.json({
    success: true,
    preferences: {
      whatsapp: { enabled: true, categories: { myOrders: true } },
      email: { enabled: true, categories: { myOrders: true } },
      push: { enabled: false, categories: { myOrders: false } }
    }
  });
});

app.put('/api/user/notification-preferences', (req, res) => {
  res.json({
    success: true,
    message: "Notification preferences updated",
    preferences: req.body
  });
});

app.post('/api/user/change-password', (req, res) => {
  res.json({
    success: true,
    message: "Password changed successfully"
  });
});

app.delete('/api/user/delete-account', (req, res) => {
  res.json({
    success: true,
    message: "Account deleted successfully"
  });
});

app.post('/api/notifications', (req, res) => {
  console.log('Notification received:', req.body);
  res.json({
    success: true,
    message: "Notification sent",
    notification: {
      id: 'notif-' + Date.now(),
      ...req.body,
      createdAt: new Date().toISOString()
    }
  });
});

app.listen(3001, () => {
  console.log('Mock backend running on http://localhost:3001');
});
