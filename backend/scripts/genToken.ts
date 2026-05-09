import jwt from 'jsonwebtoken';

const secret = '72638fe3f08cfee50d8019ac3300ce2265e15d5587da4609cb2f862f4f2af4bfb555d82bbb3904c339240f7cffe56821c04aa7a7eb2b8da73be3bf34bc2849da';
const payload = {
  userId: '6919daf97132dc737499a63f',
  role: 'customer'
};

const token = jwt.sign(payload, secret, { expiresIn: '24h' });
console.log(token);
