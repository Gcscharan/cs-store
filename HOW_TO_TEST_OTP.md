# 📧 HOW TO TEST EMAIL OTP - COMPLETE GUIDE

## IMPORTANT: OTP Only Sent to Registered Users!

**You cannot receive OTP if you haven't signed up yet!**

---

## ✅ Registered Emails (Can Receive OTP)

These emails are currently registered and CAN receive OTP:

1. **gcs.charan@gmail.com**
   - Password: Gcs@2004
   - Role: Admin
   - ✅ Can receive OTP via email

2. **2203031240398@paruluniversity.ac.in**
   - Role: Customer
   - ✅ Can receive OTP via email

3. **delivery@test.com**
   - Role: Delivery
   - ✅ Can receive OTP

4. **customer@test.com**
   - Role: Customer
   - ✅ Can receive OTP

---

## 🧪 Test Email OTP (Step by Step)

### Method 1: Test with gcs.charan@gmail.com

```bash
Step 1: Go to login page
http://localhost:3000/login

Step 2: Enter email
Email: gcs.charan@gmail.com

Step 3: Click "Send OTP"

Step 4: Check backend console - you'll see:
================================================================================
🔔 OTP LOGIN REQUEST
================================================================================
📧 Input: gcs.charan@gmail.com
📋 Input type: Email
🔍 Searching for user with email: gcs.charan@gmail.com
✅ User found: gcs.charan@gmail.com (ID: xxx)
👤 Name: Admin
📱 Phone: 9391795162
🔑 Generated OTP: 123456  ← USE THIS OTP
💾 OTP record saved to database
📧 Sending email to: gcs.charan@gmail.com

📧 Attempting to send OTP email to: gcs.charan@gmail.com
🔑 OTP: 123456 (also logged for debugging)
📤 Sending email via Resend API...
================================================================================
✅ OTP EMAIL SENT SUCCESSFULLY VIA RESEND
================================================================================
📧 To: gcs.charan@gmail.com
📨 Email ID: abc123...
🔑 OTP: 123456 (for debugging)
⏰ Valid for: 10 minutes
================================================================================
✅ User should receive email shortly!
================================================================================

Step 5: Check email inbox (gcs.charan@gmail.com)
- Look for email from "CS Store <onboarding@resend.dev>"
- Subject: "Your CS Store OTP - Login Verification"
- If not in inbox, check SPAM/Promotions folder

Step 6: Enter OTP from email (or use console OTP)
OTP: 123456

Step 7: Click "Verify OTP"

Step 8: ✅ Login successful!
```

### Method 2: Test with University Email

```bash
Step 1: Go to login page
http://localhost:3000/login

Step 2: Enter university email
Email: 2203031240398@paruluniversity.ac.in

Step 3: Click "Send OTP"

Step 4: Check backend console for OTP
Look for: 🔑 Generated OTP: 123456

Step 5: Wait 30-60 seconds for university email
- University emails are SLOWER
- Check JUNK/SPAM folder first
- Use console OTP if email doesn't arrive

Step 6: Enter OTP
OTP: [from email or console]

Step 7: ✅ Login successful!
```

---

## ❌ Testing with Unregistered Email

### What Happens:

```bash
Step 1: Enter unregistered email
Email: newuser@example.com

Step 2: Click "Send OTP"

Step 3: Backend console shows:
================================================================================
🔔 OTP LOGIN REQUEST
================================================================================
📧 Input: newuser@example.com
📋 Input type: Email
🔍 Searching for user with email: newuser@example.com
❌ User not found in database
💡 Available action: Sign up required
================================================================================

Step 4: Frontend shows error:
"Account not found for newuser@example.com. Please sign up first."

Step 5: Auto-redirects to signup page after 2 seconds
```

### Solution:
**You must SIGN UP first!**
```
http://localhost:3000/signup
```

---

## 🔍 Check Which Emails Are Registered

Run this command anytime:
```bash
cd backend
node check-users.js
```

Output:
```
================================================================================
📋 REGISTERED USERS IN DATABASE
================================================================================

✅ Found 6 registered user(s):

1. Admin
   📧 Email: gcs.charan@gmail.com
   📱 Phone: 9391795162
   👤 Role: admin

2. Gannavarapu chiranjeevi Satya
   📧 Email: 2203031240398@paruluniversity.ac.in
   📱 Phone: 9391795162
   👤 Role: customer

... (more users)

================================================================================
💡 Only these emails can receive OTP for login
💡 Other emails need to SIGN UP first
================================================================================
```

---

## 🐛 Debugging OTP Issues

### Issue 1: "Account not found"

**Symptom:** Error message "Account not found. Please sign up first."

**Cause:** Email is not registered in database

**Solution:**
```bash
Option A: Sign up first
http://localhost:3000/signup

Option B: Use registered email
gcs.charan@gmail.com
or
2203031240398@paruluniversity.ac.in
```

### Issue 2: Email Not Received

**Symptom:** OTP sent successfully (per console) but no email

**Possible Causes:**
1. Email in spam/junk folder
2. Resend API delay
3. University email server blocking

**Solution:**
```bash
1. Check spam/junk folder ⭐
2. Wait 1-2 minutes for university emails
3. Use OTP from backend console (always logged)
4. Check backend console for errors
```

### Issue 3: University Email Slow

**Symptom:** Gmail works instantly, university email takes forever

**Cause:** University email servers have:
- Strict spam filters
- Batch email processing
- Unknown sender blocking

**Solution:**
```bash
1. Wait up to 2 minutes
2. Check junk folder
3. Mark as "Not Spam" for future emails
4. Use console OTP for testing:
   Look for: 🔑 Generated OTP: 123456
```

### Issue 4: Invalid Email Format

**Symptom:** Error "Invalid phone or email format"

**Cause:** Email doesn't match regex pattern

**Solution:**
```bash
Ensure email has:
- @ symbol
- Domain name
- Top-level domain (.com, .in, etc.)

Valid: user@example.com
Invalid: user@example, @example.com, user.com
```

---

## 📊 What You'll See in Console

### Successful OTP Send:
```
================================================================================
🔔 OTP LOGIN REQUEST
================================================================================
📧 Input: gcs.charan@gmail.com
📋 Input type: Email
🔍 Searching for user with email: gcs.charan@gmail.com
✅ User found: gcs.charan@gmail.com
👤 Name: Admin
📱 Phone: 9391795162
🔑 Generated OTP: 123456
💾 OTP record saved to database
📧 Sending email to: gcs.charan@gmail.com
✅ Email OTP request completed
================================================================================
✅ OTP SENT SUCCESSFULLY
================================================================================
```

### User Not Found:
```
================================================================================
🔔 OTP LOGIN REQUEST
================================================================================
📧 Input: unknown@example.com
📋 Input type: Email
🔍 Searching for user with email: unknown@example.com
❌ User not found in database
💡 Available action: Sign up required
================================================================================
```

### Email Send Error:
```
================================================================================
❌ SEND AUTH OTP ERROR
================================================================================
Error message: [error details]
Error stack: [stack trace]
================================================================================
```

---

## 🎯 Quick Test Checklist

Before reporting "OTP not working":

- [ ] Is the email registered? (Run `node check-users.js`)
- [ ] Checked spam/junk folder?
- [ ] Waited at least 1 minute?
- [ ] Checked backend console for OTP?
- [ ] Checked backend console for errors?
- [ ] Is backend server running?
- [ ] Is frontend server running?
- [ ] Using correct email format?

---

## 📝 Summary

**Problem:** OTP not generating for some emails

**Root Cause:** OTP only sent to registered users

**Registered Emails (Work):**
- ✅ gcs.charan@gmail.com
- ✅ 2203031240398@paruluniversity.ac.in
- ✅ delivery@test.com
- ✅ customer@test.com

**Unregistered Emails (Don't Work):**
- ❌ Must sign up first at `/signup`

**Improvements Made:**
- ✅ Detailed backend logging
- ✅ Better error messages
- ✅ Auto-redirect to signup
- ✅ User checker script
- ✅ Console OTP fallback

**Test Now:**
1. Use `gcs.charan@gmail.com` for quick test
2. Check backend console for detailed logs
3. Use console OTP if email doesn't arrive
4. Check spam folder for first-time emails

**Need Help?**
- Check `OTP_NOT_GENERATING_FIX.md` for details
- Run `node check-users.js` to see registered emails
- Check backend console for detailed logs
