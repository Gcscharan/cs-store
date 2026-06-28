/**
 * Vyapara Setu — Master QA Workbook Generator
 * Generates a complete Excel workbook with atomic test cases
 * for every reachable feature in the application.
 */
const XLSX = require('xlsx');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════
// COLUMN DEFINITIONS
// ═══════════════════════════════════════════════════════════════════
const MASTER_COLUMNS = [
  'Test Number', 'Parent Module', 'Sub Module', 'Feature', 'Sub Feature',
  'Business Journey', 'Screen Name', 'Component', 'API Endpoint',
  'Backend Controller', 'Backend Route', 'Database Collection',
  'Redux Slice', 'RTK Query Endpoint', 'Socket Event',
  'Notification Event', 'Offline Queue', 'Background Task',
  'Dependencies', 'Preconditions', 'Test Priority', 'Business Criticality',
  'Risk', 'Severity if Failed', 'Manual/Automation', 'Estimated Minutes',
  'Platform', 'Build Number', 'Environment',
  'Test Title', 'Objective', 'Detailed Steps', 'Expected Result',
  'Actual Result', 'Status', 'Bug ID', 'Bug Severity',
  'Developer', 'Retest Status', 'Regression Status',
  'Execution Date', 'Tester', 'Device', 'OS Version',
  'Network', 'GPS', 'Camera', 'Microphone',
  'Notification Permission', 'Location Permission', 'Storage Permission',
  'Internet Type', 'Battery %', 'Memory', 'CPU',
  'Logs Attached', 'Video Attached', 'HAR Attached',
  'Backend Logs', 'Console Logs',
  'PNG Before', 'PNG During', 'PNG After',
  'Video Before', 'Video During', 'Video After',
  'Database Before', 'Database After',
  'API Request', 'API Response',
  'Comments', 'Notes', 'Retest Notes',
  'Release Blocker', 'Production Blocker', 'Sign Off'
];

let testCounter = {};
function nextId(prefix) {
  if (!testCounter[prefix]) testCounter[prefix] = 0;
  testCounter[prefix]++;
  return `${prefix}-${String(testCounter[prefix]).padStart(6, '0')}`;
}


// ═══════════════════════════════════════════════════════════════════
// TEST CASE FACTORY
// ═══════════════════════════════════════════════════════════════════
function tc(prefix, module, sub, feature, subFeature, opts = {}) {
  return {
    'Test Number': nextId(prefix),
    'Parent Module': module,
    'Sub Module': sub,
    'Feature': feature,
    'Sub Feature': subFeature,
    'Business Journey': opts.journey || '',
    'Screen Name': opts.screen || '',
    'Component': opts.component || '',
    'API Endpoint': opts.api || '',
    'Backend Controller': opts.controller || '',
    'Backend Route': opts.route || '',
    'Database Collection': opts.collection || '',
    'Redux Slice': opts.slice || '',
    'RTK Query Endpoint': opts.rtk || '',
    'Socket Event': opts.socket || '',
    'Notification Event': opts.notification || '',
    'Offline Queue': opts.offline || '',
    'Background Task': opts.bgTask || '',
    'Dependencies': opts.deps || '',
    'Preconditions': opts.preconditions || '',
    'Test Priority': opts.priority || 'P1',
    'Business Criticality': opts.criticality || 'High',
    'Risk': opts.risk || 'Medium',
    'Severity if Failed': opts.severity || 'Major',
    'Manual/Automation': opts.automation || 'Manual',
    'Estimated Minutes': opts.minutes || 5,
    'Platform': opts.platform || 'Android, iOS',
    'Build Number': '',
    'Environment': opts.env || 'Staging',
    'Test Title': opts.title || `${feature} - ${subFeature}`,
    'Objective': opts.objective || `Verify ${feature} ${subFeature} works correctly`,
    'Detailed Steps': opts.steps || '',
    'Expected Result': opts.expected || '',
    'Actual Result': '', 'Status': 'Not Executed',
    'Bug ID': '', 'Bug Severity': '', 'Developer': '',
    'Retest Status': '', 'Regression Status': '',
    'Execution Date': '', 'Tester': '', 'Device': '', 'OS Version': '',
    'Network': '', 'GPS': '', 'Camera': '', 'Microphone': '',
    'Notification Permission': '', 'Location Permission': '',
    'Storage Permission': '', 'Internet Type': '',
    'Battery %': '', 'Memory': '', 'CPU': '',
    'Logs Attached': '', 'Video Attached': '', 'HAR Attached': '',
    'Backend Logs': '', 'Console Logs': '',
    'PNG Before': '', 'PNG During': '', 'PNG After': '',
    'Video Before': '', 'Video During': '', 'Video After': '',
    'Database Before': '', 'Database After': '',
    'API Request': '', 'API Response': '',
    'Comments': '', 'Notes': '', 'Retest Notes': '',
    'Release Blocker': opts.releaseBlocker || 'No',
    'Production Blocker': opts.prodBlocker || 'No',
    'Sign Off': ''
  };
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 01: AUTHENTICATION
// ═══════════════════════════════════════════════════════════════════
function generateAuthTests() {
  const tests = [];
  const M = 'Authentication'; const P = 'AUTH';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  // Login Screen
  s('Login', 'Navigation', 'Open Login screen from app launch', { screen: 'LoginScreen', priority: 'P0', criticality: 'Critical', steps: '1. Kill app 2. Reopen app 3. Observe Login screen loads', expected: 'Login screen displays with phone input and CTA' });
  s('Login', 'UI Layout', 'All elements visible', { screen: 'LoginScreen', steps: '1. Open Login 2. Verify logo, phone input, CTA button visible', expected: 'All UI elements render correctly' });
  s('Login', 'Phone Input', 'Valid 10-digit number accepted', { screen: 'LoginScreen', api: 'POST /auth/send-otp', steps: '1. Enter 9391795162 2. Tap Send OTP', expected: 'OTP sent, navigates to OTP screen' });
  s('Login', 'Phone Input', 'Empty phone shows error', { screen: 'LoginScreen', steps: '1. Leave phone empty 2. Tap Send OTP', expected: 'Validation error shown' });
  s('Login', 'Phone Input', 'Less than 10 digits shows error', { screen: 'LoginScreen', steps: '1. Enter 12345 2. Tap Send OTP', expected: 'Validation error: invalid phone number' });
  s('Login', 'Phone Input', 'Non-numeric chars rejected', { screen: 'LoginScreen', steps: '1. Try entering letters/special chars', expected: 'Input only accepts numeric characters' });
  s('Login', 'Phone Input', 'More than 10 digits truncated', { screen: 'LoginScreen', steps: '1. Enter 12345678901 2. Observe', expected: 'Input truncated to 10 digits or error shown' });
  s('Login', 'Send OTP', 'API success', { api: 'POST /auth/send-otp', rtk: 'sendOtp', collection: 'otps', steps: '1. Enter valid phone 2. Tap Send OTP', expected: 'API returns success, OTP screen shown' });
  s('Login', 'Send OTP', 'API failure (network error)', { api: 'POST /auth/send-otp', steps: '1. Disable network 2. Enter phone 3. Tap Send OTP', expected: 'Error message shown, retry possible' });
  s('Login', 'Send OTP', 'Rate limiting', { api: 'POST /auth/send-otp', steps: '1. Send OTP 5+ times rapidly', expected: 'Rate limit error displayed after threshold' });
  s('Login', 'Send OTP', 'Loading state', { screen: 'LoginScreen', steps: '1. Tap Send OTP 2. Observe loading indicator', expected: 'Button disabled, spinner/loading shown' });
  s('Login', 'Navigation', 'Navigate to Signup', { screen: 'SignupScreen', steps: '1. On Login screen 2. Tap signup link', expected: 'Navigates to Signup screen' });
  s('Login', 'Navigation', 'Navigate to Delivery Login', { screen: 'DeliveryLoginScreen', steps: '1. On Login 2. Tap delivery login link', expected: 'Navigates to DeliveryLoginScreen' });

  // Signup
  s('Signup', 'Navigation', 'Open Signup screen', { screen: 'SignupScreen', steps: '1. From Login, tap Signup', expected: 'Signup screen loads' });
  s('Signup', 'UI Layout', 'All fields visible', { screen: 'SignupScreen', steps: '1. Open Signup 2. Check name, phone fields', expected: 'Name and phone input visible with CTA' });
  s('Signup', 'Name Input', 'Valid name accepted', { screen: 'SignupScreen', steps: '1. Enter "Test User" 2. Proceed', expected: 'Name accepted without error' });
  s('Signup', 'Name Input', 'Empty name shows error', { steps: '1. Leave name empty 2. Submit', expected: 'Validation error shown' });
  s('Signup', 'Phone Input', 'Valid phone accepted', { steps: '1. Enter 10-digit phone 2. Submit', expected: 'Phone accepted, OTP sent' });
  s('Signup', 'API', 'Signup success → OTP screen', { api: 'POST /auth/send-otp', rtk: 'sendOtp', steps: '1. Fill valid details 2. Submit', expected: 'API success, navigate to OTP' });
  s('Signup', 'API', 'Duplicate phone error', { api: 'POST /auth/send-otp', steps: '1. Enter already registered phone 2. Submit', expected: 'Error: phone already registered' });

  // OTP Screen
  s('OTP', 'Navigation', 'OTP screen loads after send', { screen: 'OTPScreen', steps: '1. Send OTP from Login 2. Observe', expected: 'OTP screen with input fields loads' });
  s('OTP', 'UI Layout', 'Timer and resend visible', { screen: 'OTPScreen', steps: '1. Open OTP screen 2. Check timer', expected: 'Countdown timer shown, resend disabled initially' });
  s('OTP', 'Input', 'Valid 6-digit OTP accepted', { api: 'POST /auth/verify-otp', rtk: 'verifyOtp', steps: '1. Enter correct OTP 2. Submit', expected: 'Login successful, navigate to Home' });
  s('OTP', 'Input', 'Wrong OTP shows error', { api: 'POST /auth/verify-otp', steps: '1. Enter wrong OTP 2. Submit', expected: 'Error: invalid OTP' });
  s('OTP', 'Input', 'Expired OTP shows error', { steps: '1. Wait for OTP to expire 2. Enter OTP 3. Submit', expected: 'Error: OTP expired' });
  s('OTP', 'Resend', 'Resend OTP after timer', { api: 'POST /auth/send-otp', steps: '1. Wait for timer 2. Tap Resend', expected: 'New OTP sent, timer resets' });
  s('OTP', 'Resend', 'Resend disabled during countdown', { steps: '1. Try tapping Resend before timer ends', expected: 'Button disabled/grayed out' });
  s('OTP', 'Auto-fill', 'OTP auto-read (Android)', { platform: 'Android', steps: '1. Receive SMS OTP 2. Observe auto-fill', expected: 'OTP fields populate automatically' });

  // Google Onboarding
  s('Google Onboarding', 'Navigation', 'Onboarding screen loads for GOOGLE_AUTH_ONLY', { screen: 'OnboardingScreen', slice: 'authSlice', steps: '1. Login with Google 2. Observe redirect', expected: 'OnboardingScreen loads for profile completion' });
  s('Google Onboarding', 'Form', 'Complete profile with name and phone', { api: 'POST /auth/complete-onboarding', rtk: 'completeOnboarding', steps: '1. Enter name 2. Enter phone 3. Submit', expected: 'Profile completed, navigate to Home' });
  s('Google Onboarding', 'Form', 'Missing name shows error', { steps: '1. Leave name empty 2. Submit', expected: 'Validation error' });
  s('Google Onboarding', 'Form', 'Invalid phone shows error', { steps: '1. Enter invalid phone 2. Submit', expected: 'Validation error' });

  // Logout
  s('Logout', 'Action', 'Logout clears session', { api: 'POST /auth/logout', rtk: 'logout', slice: 'authSlice', steps: '1. Go to Account 2. Tap Logout 3. Confirm', expected: 'Session cleared, navigate to Login screen' });
  s('Logout', 'State', 'Redux state cleared', { slice: 'authSlice', steps: '1. Logout 2. Check Redux store', expected: 'auth, cart, orders state reset' });
  s('Logout', 'Push Token', 'Push token removed', { api: 'DELETE /notifications/token', steps: '1. Logout 2. Verify push token deregistered', expected: 'Device token removed from backend' });
  s('Logout', 'Navigation', 'Cannot access protected screens after logout', { steps: '1. Logout 2. Try deep link to Orders', expected: 'Redirect to Login' });

  // Session / Token Refresh
  s('Session', 'Token Refresh', 'Auto-refresh on 401', { api: 'POST /auth/refresh', rtk: 'refreshToken', steps: '1. Wait for token expiry 2. Make any API call', expected: 'Token refreshed silently, request succeeds' });
  s('Session', 'Token Refresh', 'Refresh token expired → force logout', { steps: '1. Both tokens expired 2. Make API call', expected: 'Force logout, navigate to Login' });
  s('Session', 'Persistence', 'Session persists across app restart', { steps: '1. Login 2. Kill app 3. Reopen', expected: 'User still logged in, Home screen shown' });
  s('Session', 'Suspended', 'Suspended account shows error', { steps: '1. Login with suspended account', expected: 'Error: Account suspended' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 02: HOME / DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function generateHomeTests() {
  const tests = []; const M = 'Home'; const P = 'HOME';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('HomeScreen', 'Navigation', 'Home tab loads on login', { screen: 'HomeScreen', priority: 'P0', steps: '1. Login 2. Observe Home tab active', expected: 'Home screen loads with content' });
  s('HomeScreen', 'Categories Strip', 'Categories horizontal scroll visible', { screen: 'HomeScreen', component: 'CategoryGrid', rtk: 'getCategories', steps: '1. Open Home 2. Check categories strip', expected: 'Categories displayed horizontally' });
  s('HomeScreen', 'Categories Strip', 'Tap category navigates to products', { screen: 'CategoriesScreen', steps: '1. Tap a category chip', expected: 'Navigates to filtered products list' });
  s('HomeScreen', 'Featured Products', 'Featured section loads', { rtk: 'getFeaturedProducts', steps: '1. Open Home 2. Scroll to Featured', expected: 'Featured products grid visible' });
  s('HomeScreen', 'Top Deals', 'Top deals section loads', { rtk: 'getTopDeals', steps: '1. Open Home 2. Scroll to Top Deals', expected: 'Deals section with discount badges visible' });
  s('HomeScreen', 'Pull-to-Refresh', 'Refresh reloads data', { steps: '1. Pull down on Home screen', expected: 'Loading indicator, data refreshes' });
  s('HomeScreen', 'Search Bar', 'Tap search bar navigates to Search', { screen: 'SearchScreen', component: 'HomeSearchBar', steps: '1. Tap search bar on Home', expected: 'Navigate to SearchScreen' });
  s('HomeScreen', 'Notification Bell', 'Bell icon shows unread count', { component: 'NotificationBell', rtk: 'getUnreadCount', steps: '1. Open Home 2. Check bell icon', expected: 'Badge shows unread notification count' });
  s('HomeScreen', 'Notification Bell', 'Tap bell navigates to Notifications', { screen: 'NotificationsScreen', steps: '1. Tap notification bell', expected: 'Navigate to Notifications screen' });
  s('HomeScreen', 'Loading State', 'Skeleton/loading on first load', { steps: '1. Clear cache 2. Open Home', expected: 'Loading skeleton shown before data' });
  s('HomeScreen', 'Error State', 'Network error shows retry', { steps: '1. Disable network 2. Open Home', expected: 'Error state with retry button' });
  s('HomeScreen', 'Empty State', 'No products shows empty message', { steps: '1. Empty database 2. Open Home', expected: 'Empty state message shown' });
  s('CustomerDashboard', 'Navigation', 'Dashboard accessible from Home', { screen: 'CustomerDashboardScreen', steps: '1. Navigate to CustomerDashboard', expected: 'Dashboard loads with order summary' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 03: CATEGORIES
// ═══════════════════════════════════════════════════════════════════
function generateCategoryTests() {
  const tests = []; const M = 'Categories'; const P = 'CAT';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('CategoriesScreen', 'Navigation', 'Categories tab loads', { screen: 'CategoriesScreen', priority: 'P1', steps: '1. Tap Categories tab', expected: 'Categories grid loads' });
  s('CategoriesScreen', 'Display', 'All categories from API shown', { rtk: 'getCategories', steps: '1. Open Categories 2. Compare with API', expected: 'All categories visible' });
  s('CategoriesScreen', 'Tap Category', 'Navigate to filtered ProductsList', { screen: 'ProductsListScreen', steps: '1. Tap a category', expected: 'Products filtered by selected category' });
  s('CategoriesScreen', 'Loading', 'Loading state shown', { steps: '1. Slow network 2. Open Categories', expected: 'Loading indicator visible' });
  s('CategoriesScreen', 'Empty', 'No categories message', { steps: '1. Empty categories 2. Open', expected: 'Empty state shown' });
  s('CategoriesScreen', 'Error', 'API error shows retry', { steps: '1. API fails 2. Open Categories', expected: 'Error with retry option' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 04: SEARCH (incl. Voice)
// ═══════════════════════════════════════════════════════════════════
function generateSearchTests() {
  const tests = []; const M = 'Search'; const P = 'SEARCH';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('Text Search', 'Navigation', 'Search screen opens', { screen: 'SearchScreen', steps: '1. Tap search bar or icon', expected: 'Search screen with input focused' });
  s('Text Search', 'Input', 'Type query shows results', { api: 'GET /products?search=', rtk: 'getProducts', steps: '1. Type "tomato" 2. Observe', expected: 'Products matching "tomato" shown' });
  s('Text Search', 'Input', 'Empty query shows recent/suggestions', { steps: '1. Focus search with empty input', expected: 'Recent searches or suggestions shown' });
  s('Text Search', 'Input', 'Special characters handled', { steps: '1. Type "test@#$%" 2. Search', expected: 'No crash, empty or sanitized results' });
  s('Text Search', 'Results', 'Product card tap → ProductDetail', { screen: 'ProductDetailScreen', steps: '1. Search 2. Tap product', expected: 'Navigate to product detail' });
  s('Text Search', 'Results', 'Pagination / scroll loads more', { steps: '1. Search with many results 2. Scroll down', expected: 'More results load (infinite scroll)' });
  s('Text Search', 'Results', 'No results shows empty state', { steps: '1. Search "xyznonexist"', expected: 'Empty state: no products found' });
  s('Text Search', 'Sort', 'Sort by price/name/discount', { steps: '1. Search 2. Tap sort 3. Select price low-high', expected: 'Results sorted by price ascending' });
  s('Text Search', 'Filters', 'Filter by category/price range', { component: 'FilterBottomSheet', steps: '1. Search 2. Tap filter 3. Select category', expected: 'Results filtered by selection' });
  s('Text Search', 'Loading', 'Loading shown during search', { steps: '1. Type query on slow network', expected: 'Loading indicator shown' });
  s('Text Search', 'Debounce', 'No API call per keystroke', { steps: '1. Type quickly 2. Monitor network', expected: 'API called after debounce, not per char' });

  // Voice Search
  s('Voice Search', 'Mic Button', 'Voice icon visible', { component: 'VoiceListeningModal', steps: '1. Open search 2. Check mic icon', expected: 'Microphone icon visible on search bar' });
  s('Voice Search', 'Permission', 'Mic permission requested on first tap', { steps: '1. Tap mic icon (first time)', expected: 'System mic permission dialog appears' });
  s('Voice Search', 'Permission', 'Permission denied shows explanation', { steps: '1. Deny mic permission 2. Tap mic again', expected: 'Settings redirect or explanation shown' });
  s('Voice Search', 'Listening', 'Listening modal opens', { component: 'VoiceListeningModal', steps: '1. Grant mic 2. Tap mic icon', expected: 'Listening modal with animation appears' });
  s('Voice Search', 'SEARCH Intent', 'Voice "search tomato" → text search', { steps: '1. Say "search tomato"', expected: 'Search executed for "tomato", results shown' });
  s('Voice Search', 'ADD_TO_CART Intent', 'Voice "add tomato to cart"', { component: 'VoiceCartConfirmation', steps: '1. Say "add tomato to cart"', expected: 'Product matched, confirmation modal shown' });
  s('Voice Search', 'FILTER Intent', 'Voice "show vegetables under 50"', { steps: '1. Say "show vegetables under 50"', expected: 'Filters applied: category=vegetables, maxPrice=50' });
  s('Voice Search', 'Error', 'No speech detected', { steps: '1. Tap mic 2. Stay silent', expected: 'Timeout message shown after silence period' });
  s('Voice Search', 'Error', 'Unrecognized speech', { steps: '1. Speak gibberish', expected: 'Fallback to text search with best guess' });
  s('Voice Search', 'Correction', 'Voice correction API called', { api: 'POST /voice/correct', rtk: 'correctVoiceQuery', steps: '1. Say "tamato" (misspell)', expected: 'Correction to "tomato" applied' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 05: PRODUCT DISCOVERY
// ═══════════════════════════════════════════════════════════════════
function generateProductListTests() {
  const tests = []; const M = 'Product Discovery'; const P = 'PROD';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('ProductsList', 'Navigation', 'Products list loads from category', { screen: 'ProductsListScreen', rtk: 'getProducts', steps: '1. Tap a category', expected: 'Products list loads' });
  s('ProductsList', 'Display', 'Product cards show name/price/image', { component: 'ProductCard', steps: '1. Open products list 2. Check cards', expected: 'Each card shows image, name, price, MRP' });
  s('ProductsList', 'Pagination', 'Scroll loads more products', { steps: '1. Scroll to bottom', expected: 'Next page loads automatically' });
  s('ProductsList', 'Sort', 'Sort dropdown works', { steps: '1. Tap sort 2. Select option', expected: 'Products reorder per sort choice' });
  s('ProductsList', 'Filter', 'Filter bottom sheet opens', { component: 'FilterBottomSheet', steps: '1. Tap filter icon', expected: 'Filter bottom sheet shows options' });
  s('ProductsList', 'Stock', 'Out of stock badge shown', { steps: '1. View product with stock=0', expected: 'Out of stock badge, add-to-cart disabled' });
  s('ProductsList', 'Stock', 'Low stock badge shown', { steps: '1. View product with stock < 5', expected: 'Low stock indicator visible' });
  s('ProductsList', 'Tap', 'Tap card → ProductDetail', { screen: 'ProductDetailScreen', steps: '1. Tap a product card', expected: 'Navigate to ProductDetail' });
  s('ProductsList', 'Empty', 'No products in category', { steps: '1. Open empty category', expected: 'Empty state message shown' });
  s('ProductsList', 'Loading', 'Loading state on slow network', { steps: '1. Open on 3G', expected: 'Loading skeleton/indicator' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 06: PRODUCT DETAIL
// ═══════════════════════════════════════════════════════════════════
function generateProductDetailTests() {
  const tests = []; const M = 'Product Detail'; const P = 'PD';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('ProductDetail', 'Navigation', 'Screen loads from products list', { screen: 'ProductDetailScreen', rtk: 'getProduct', steps: '1. Tap product card', expected: 'Product detail screen loads with data' });
  s('ProductDetail', 'Media', 'Product image displays', { steps: '1. Open product 2. Check image', expected: 'Product image renders correctly' });
  s('ProductDetail', 'Media', 'Multiple images swipeable', { steps: '1. Product with multiple images 2. Swipe', expected: 'Images carousel works' });
  s('ProductDetail', 'Price', 'Price and MRP shown', { steps: '1. Open product 2. Check price', expected: 'Current price and original MRP visible' });
  s('ProductDetail', 'Price', 'Discount badge shown', { steps: '1. Product with discount', expected: 'Discount percentage badge visible' });
  s('ProductDetail', 'Stock', 'In stock → Add to Cart enabled', { steps: '1. Open in-stock product', expected: 'Add to Cart button active' });
  s('ProductDetail', 'Stock', 'Out of stock → Add to Cart disabled', { steps: '1. Open out-of-stock product', expected: 'Button disabled or shows "Out of Stock"' });
  s('ProductDetail', 'Add to Cart', 'Tap adds product to cart', { api: 'POST /cart', rtk: 'addToCart', slice: 'cartSlice', steps: '1. Tap Add to Cart', expected: 'Product added, cart badge updates' });
  s('ProductDetail', 'Add to Cart', 'Quantity selector works', { steps: '1. Change quantity 2. Add to cart', expected: 'Correct quantity added' });
  s('ProductDetail', 'Add to Cart', 'Already in cart shows "Go to Cart"', { steps: '1. Add product 2. Revisit same product', expected: 'Shows Go to Cart / update quantity' });
  s('ProductDetail', 'Share', 'Share button works', { steps: '1. Tap share icon', expected: 'System share sheet opens with product link' });
  s('ProductDetail', 'Reviews Summary', 'Rating and count shown', { rtk: 'getProductReviews', steps: '1. Open product with reviews', expected: 'Star rating and review count visible' });
  s('ProductDetail', 'Reviews', 'Tap reviews → AllReviews', { screen: 'AllReviewsScreen', steps: '1. Tap "View All Reviews"', expected: 'Navigate to AllReviews screen' });
  s('ProductDetail', 'Similar', 'Similar products section', { steps: '1. Scroll down 2. Check similar section', expected: 'Similar products shown' });
  s('ProductDetail', 'Realtime', 'Stock update via socket', { socket: 'product:update', steps: '1. Open product 2. Admin changes stock', expected: 'Stock badge updates in realtime' });
  s('ProductDetail', 'Loading', 'Loading state while fetching', { steps: '1. Open product on slow network', expected: 'Loading skeleton shown' });
  s('ProductDetail', 'Error', 'Invalid product ID shows error', { steps: '1. Deep link to invalid product', expected: 'Error: Product not found' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 07: REVIEWS
// ═══════════════════════════════════════════════════════════════════
function generateReviewTests() {
  const tests = []; const M = 'Reviews'; const P = 'REV';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('AllReviews', 'Navigation', 'Screen loads from ProductDetail', { screen: 'AllReviewsScreen', rtk: 'getProductReviews', steps: '1. On ProductDetail 2. Tap View All Reviews', expected: 'AllReviews screen loads' });
  s('AllReviews', 'Display', 'Reviews list shows rating/comment/date', { steps: '1. Open AllReviews with data', expected: 'Each review shows stars, text, date, user' });
  s('AllReviews', 'Stats', 'Rating distribution bar chart', { steps: '1. Open AllReviews 2. Check stats section', expected: 'Star distribution (5★ to 1★) bars shown' });
  s('AllReviews', 'Pagination', 'Load more reviews on scroll', { steps: '1. Scroll to bottom', expected: 'More reviews load' });
  s('AllReviews', 'Empty', 'No reviews message', { steps: '1. Product with no reviews', expected: 'Empty state: "No reviews yet"' });
  s('WriteReview', 'Navigation', 'Write Review button visible', { screen: 'WriteReviewScreen', steps: '1. Open AllReviews 2. Tap Write Review', expected: 'Navigate to WriteReview' });
  s('WriteReview', 'Auth', 'Requires login to write review', { steps: '1. Logged out 2. Try Write Review', expected: 'Redirect to login or auth error' });
  s('WriteReview', 'Rating', 'Star selection works', { steps: '1. Tap 4 stars', expected: '4 stars highlighted' });
  s('WriteReview', 'Rating', 'No rating shows error on submit', { steps: '1. Leave rating empty 2. Submit', expected: 'Validation: rating required' });
  s('WriteReview', 'Comment', 'Text input accepts review', { steps: '1. Type review text 2. Submit', expected: 'Review text saved' });
  s('WriteReview', 'Submit', 'API success creates review', { api: 'POST /products/:id/reviews', rtk: 'addReview', collection: 'reviews', steps: '1. Fill rating+comment 2. Submit', expected: 'Review created, success message shown' });
  s('WriteReview', 'Submit', 'Duplicate review error', { steps: '1. Submit review for same product twice', expected: 'Error: already reviewed this product' });
  s('WriteReview', 'Loading', 'Loading state during submit', { steps: '1. Submit 2. Observe', expected: 'Button disabled, spinner shown' });
  s('WriteReview', 'Error', 'API error shows message', { steps: '1. Submit on network failure', expected: 'Error message with retry' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 09: CART
// ═══════════════════════════════════════════════════════════════════
function generateCartTests() {
  const tests = []; const M = 'Cart'; const P = 'CART';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('Cart', 'Navigation', 'Cart tab loads', { screen: 'CartScreen', priority: 'P0', criticality: 'Critical', rtk: 'getCart', steps: '1. Tap Cart tab', expected: 'Cart screen loads' });
  s('Cart', 'Display', 'Cart items shown with details', { steps: '1. Add items 2. Open cart', expected: 'Products with name, price, qty, subtotal' });
  s('Cart', 'Add', 'Add to cart from ProductDetail', { api: 'POST /cart', rtk: 'addToCart', slice: 'cartSlice', steps: '1. On ProductDetail 2. Tap Add to Cart', expected: 'Item added, cart count updates in tab badge' });
  s('Cart', 'Add', 'Add same product increases quantity', { steps: '1. Add tomato 2. Add tomato again', expected: 'Quantity increments, not duplicate row' });
  s('Cart', 'Quantity', 'Increase quantity', { api: 'PUT /cart', rtk: 'updateCartItem', steps: '1. Tap + on item', expected: 'Quantity +1, total updates' });
  s('Cart', 'Quantity', 'Decrease quantity', { steps: '1. Tap - on item (qty > 1)', expected: 'Quantity -1, total updates' });
  s('Cart', 'Quantity', 'Decrease to 0 removes item', { steps: '1. Tap - when qty=1', expected: 'Item removed from cart or confirm dialog' });
  s('Cart', 'Quantity', 'Max quantity limit', { steps: '1. Try setting qty > max stock', expected: 'Quantity capped at available stock' });
  s('Cart', 'Remove', 'Remove item from cart', { api: 'DELETE /cart/:productId', rtk: 'removeFromCart', steps: '1. Swipe or tap remove on item', expected: 'Item removed, total recalculates' });
  s('Cart', 'Clear', 'Clear entire cart', { api: 'DELETE /cart/clear', rtk: 'clearCart', steps: '1. Tap Clear Cart', expected: 'All items removed, empty state shown' });
  s('Cart', 'Empty State', 'Empty cart message', { steps: '1. Open cart with no items', expected: 'Empty cart illustration and "Browse products" CTA' });
  s('Cart', 'Price Calc', 'Subtotal correct', { steps: '1. 2x ₹50 + 1x ₹100 2. Check subtotal', expected: 'Subtotal = ₹200' });
  s('Cart', 'Price Calc', 'Delivery fee shown', { steps: '1. Check delivery fee section', expected: 'Delivery fee amount shown or FREE badge' });
  s('Cart', 'Free Delivery', 'Free delivery banner threshold', { component: 'FreeDeliveryBanner', steps: '1. Cart below threshold 2. Check banner', expected: 'Banner shows "Add ₹X more for free delivery"' });
  s('Cart', 'Checkout CTA', 'Proceed to Checkout button', { steps: '1. Cart with items 2. Tap Checkout', expected: 'Navigate to Checkout screen' });
  s('Cart', 'Sync', 'Cart syncs with backend', { steps: '1. Add item on device A 2. Open cart on device B', expected: 'Cart consistent across devices' });
  s('Cart', 'Offline', 'Add to cart while offline', { offline: 'ADD_TO_CART', steps: '1. Go offline 2. Add to cart', expected: 'Action queued, shown in cart locally' });
  s('Cart', 'Offline', 'Offline queue replays on reconnect', { steps: '1. Add offline 2. Reconnect', expected: 'Cart syncs with server, no duplicates' });
  s('Cart', 'Out of Stock', 'Item becomes out of stock in cart', { socket: 'product:update', steps: '1. Add item 2. Admin sets stock=0', expected: 'Warning shown, item grayed or flagged' });
  s('Cart', 'Badge', 'Tab badge shows item count', { slice: 'cartSlice', component: 'CartBadge', steps: '1. Add 3 items 2. Check Cart tab icon', expected: 'Badge shows "3"' });
  s('Cart', 'Badge', 'Badge shows 9+ for >9 items', { steps: '1. Add 10+ items 2. Check badge', expected: 'Badge shows "9+"' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 10: COUPONS
// ═══════════════════════════════════════════════════════════════════
function generateCouponTests() {
  const tests = []; const M = 'Coupons'; const P = 'COUPON';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('Coupons', 'Display', 'Available coupons shown', { api: 'GET /coupons', rtk: 'getCoupons', steps: '1. Open coupon section', expected: 'List of available coupons displayed' });
  s('Coupons', 'Apply', 'Valid coupon applies discount', { api: 'POST /coupons/validate', rtk: 'validateCoupon', steps: '1. Enter valid code 2. Tap Apply', expected: 'Discount applied, total reduces' });
  s('Coupons', 'Apply', 'Invalid code shows error', { steps: '1. Enter "INVALID123" 2. Tap Apply', expected: 'Error: coupon not found' });
  s('Coupons', 'Apply', 'Expired coupon rejected', { steps: '1. Enter expired coupon code 2. Apply', expected: 'Error: coupon expired' });
  s('Coupons', 'Apply', 'Min cart value not met', { steps: '1. Cart=₹100, coupon min=₹500 2. Apply', expected: 'Error: minimum cart value ₹500 required' });
  s('Coupons', 'Remove', 'Remove applied coupon', { steps: '1. Apply coupon 2. Tap Remove/X', expected: 'Discount removed, original total restored' });
  s('Coupons', 'Smart', 'Smart coupons based on cart', { api: 'GET /coupons/smart', rtk: 'getSmartCoupons', steps: '1. Open coupons with cart items', expected: 'Relevant coupons suggested' });
  s('Coupons', 'Percentage', 'Percentage discount calculation', { steps: '1. Apply 10% off coupon on ₹500 cart', expected: 'Discount = ₹50' });
  s('Coupons', 'Fixed', 'Fixed amount discount', { steps: '1. Apply ₹100 off coupon', expected: 'Discount = ₹100' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 11: ADDRESSES
// ═══════════════════════════════════════════════════════════════════
function generateAddressTests() {
  const tests = []; const M = 'Addresses'; const P = 'ADDR';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('AddressList', 'Navigation', 'Addresses screen loads', { screen: 'AddressesScreen', rtk: 'getAddresses', steps: '1. Navigate to Addresses', expected: 'List of saved addresses shown' });
  s('AddressList', 'Display', 'Address details shown correctly', { steps: '1. Open address list 2. Verify display', expected: 'Name, phone, address, pincode, default badge' });
  s('AddressList', 'Default', 'Default address highlighted', { steps: '1. Check default address', expected: 'Default badge/checkmark visible on one address' });
  s('AddressList', 'Set Default', 'Change default address', { api: 'PATCH /user/addresses/:id/default', rtk: 'setDefaultAddress', steps: '1. Tap "Set as Default" on another address', expected: 'New default set, old default unmarked' });
  s('AddressList', 'Empty', 'No addresses shows add CTA', { steps: '1. New user, no addresses 2. Open', expected: 'Empty state with "Add Address" button' });
  s('AddAddress', 'Navigation', 'Add Address screen loads', { screen: 'AddAddressScreen', steps: '1. Tap Add Address', expected: 'Form loads with all fields' });
  s('AddAddress', 'Form', 'All fields visible', { steps: '1. Open Add Address', expected: 'Name, phone, flat, street, city, state, pincode fields' });
  s('AddAddress', 'Pincode', 'Valid pincode auto-fills city/state', { api: 'GET /pincode/check/:pin', rtk: 'checkPincode', steps: '1. Enter valid pincode 530017', expected: 'City and state auto-populated' });
  s('AddAddress', 'Pincode', 'Invalid pincode shows error', { steps: '1. Enter 000000', expected: 'Error: invalid pincode' });
  s('AddAddress', 'Pincode', 'Non-serviceable pincode warning', { steps: '1. Enter valid but unserviced pincode', expected: 'Warning: delivery not available' });
  s('AddAddress', 'Submit', 'Valid address saved', { api: 'POST /user/addresses', rtk: 'addAddress', collection: 'users', steps: '1. Fill all fields 2. Submit', expected: 'Address saved, navigate back to list' });
  s('AddAddress', 'Submit', 'Missing required fields error', { steps: '1. Leave name empty 2. Submit', expected: 'Validation errors shown' });
  s('AddAddress', 'Edit', 'Edit existing address', { api: 'PUT /user/addresses/:id', rtk: 'updateAddress', steps: '1. Tap edit on address 2. Change field 3. Save', expected: 'Address updated' });
  s('AddAddress', 'Delete', 'Delete address', { api: 'DELETE /user/addresses/:id', rtk: 'deleteAddress', steps: '1. Tap delete 2. Confirm', expected: 'Address removed from list' });
  s('AddAddress', 'Delete', 'Cannot delete last/default address', { steps: '1. Try deleting only address', expected: 'Warning or prevention if only address' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 12: CHECKOUT
// ═══════════════════════════════════════════════════════════════════
function generateCheckoutTests() {
  const tests = []; const M = 'Checkout'; const P = 'CHK';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('Checkout', 'Navigation', 'Checkout screen loads from cart', { screen: 'CheckoutScreen', priority: 'P0', criticality: 'Critical', steps: '1. Cart with items 2. Tap Proceed to Checkout', expected: 'Checkout screen loads' });
  s('Checkout', 'Address', 'Default address pre-selected', { steps: '1. Open Checkout 2. Check address', expected: 'Default address shown at top' });
  s('Checkout', 'Address', 'Change address button works', { screen: 'AddressesScreen', steps: '1. Tap Change Address', expected: 'Navigate to address selection' });
  s('Checkout', 'Address', 'No address → prompt to add', { steps: '1. User with no addresses opens Checkout', expected: 'Prompt to add address first' });
  s('Checkout', 'Summary', 'Order summary correct', { steps: '1. Verify items, quantities, prices', expected: 'Matches cart contents exactly' });
  s('Checkout', 'Delivery Fee', 'Delivery charges shown', { steps: '1. Check delivery fee section', expected: 'Fee amount or FREE shown' });
  s('Checkout', 'Coupon', 'Applied coupon reflected', { steps: '1. Apply coupon in cart 2. Open checkout', expected: 'Discount shown in summary' });
  s('Checkout', 'Total', 'Grand total calculation', { steps: '1. Verify: items + delivery - discount = total', expected: 'Math correct' });
  s('Checkout', 'Payment Method', 'COD option available', { steps: '1. Check payment methods', expected: 'COD option visible and selectable' });
  s('Checkout', 'Payment Method', 'UPI/Card/Netbanking via Razorpay', { steps: '1. Select online payment', expected: 'Razorpay options shown' });
  s('Checkout', 'Terms', 'Terms checkbox required', { steps: '1. Try placing order without checking terms', expected: 'Error: please accept terms' });
  s('Checkout', 'Place Order', 'COD order placement', { api: 'POST /orders', rtk: 'createOrder', collection: 'orders', steps: '1. Select COD 2. Accept terms 3. Place Order', expected: 'Order created, navigate to OrderSuccess' });
  s('Checkout', 'Place Order', 'UPI order → Razorpay flow', { api: 'POST /orders', steps: '1. Select UPI 2. Place Order', expected: 'Razorpay SDK opens with payment options' });
  s('Checkout', 'Idempotency', 'Double-tap Place Order is safe', { steps: '1. Tap Place Order rapidly twice', expected: 'Only one order created (idempotency key)' });
  s('Checkout', 'Loading', 'Loading state during order creation', { steps: '1. Place order 2. Observe', expected: 'Button disabled, spinner shown' });
  s('Checkout', 'Error', 'API failure shows error', { steps: '1. Network error during Place Order', expected: 'Error message with retry option' });
  s('Checkout', 'Error', 'Out of stock during checkout', { steps: '1. Item goes OOS while on checkout 2. Place Order', expected: 'Error: item no longer available' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 13: PAYMENTS
// ═══════════════════════════════════════════════════════════════════
function generatePaymentTests() {
  const tests = []; const M = 'Payments'; const P = 'PAY';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('Razorpay', 'UPI', 'UPI payment success', { priority: 'P0', criticality: 'Critical', severity: 'Critical', api: 'POST /orders', collection: 'payments', steps: '1. Checkout 2. Select UPI 3. Enter VPA 4. Authorize', expected: 'Payment succeeds, order PAID, OrderSuccess shown' });
  s('Razorpay', 'UPI', 'UPI VPA verification', { api: 'POST /upi/verify', rtk: 'verifyUPI', steps: '1. Enter VPA 2. Verify', expected: 'VPA validated, name/bank shown' });
  s('Razorpay', 'UPI', 'Invalid VPA error', { steps: '1. Enter invalid VPA "abc@xyz"', expected: 'Error: invalid UPI ID' });
  s('Razorpay', 'Card', 'Card payment success', { steps: '1. Select Card 2. Enter details 3. OTP', expected: 'Payment success' });
  s('Razorpay', 'Netbanking', 'Netbanking payment success', { steps: '1. Select Netbanking 2. Choose bank 3. Auth', expected: 'Payment success' });
  s('Razorpay', 'Failure', 'Payment declined', { steps: '1. Use test card for decline', expected: 'Failure screen shown with retry' });
  s('Razorpay', 'Failure', 'Payment timeout', { steps: '1. Start payment 2. Wait for timeout', expected: 'Timeout error, retry available' });
  s('Razorpay', 'Retry', 'Retry after failure', { steps: '1. Payment fails 2. Tap Retry', expected: 'Razorpay reopens for same order' });
  s('Razorpay', 'App Killed', 'App killed mid-payment → recovery', { priority: 'P0', severity: 'Critical', steps: '1. Start UPI 2. Kill app 3. Reopen', expected: 'Pending payment tracker shows, order converges to PAID via webhook' });
  s('Razorpay', 'Webhook', 'Webhook arrives → order PAID', { api: 'POST /payments/razorpay-webhook', route: 'orders.ts', collection: 'payments,orders', steps: '1. Complete payment 2. Webhook fires', expected: 'Order transitions to PAID' });
  s('Razorpay', 'Webhook', 'Duplicate webhook → no double charge', { steps: '1. Simulate webhook retry 2. Check order', expected: 'Order stays PAID, no duplicate' });
  s('Razorpay', 'Status', 'Payment status polling', { api: 'GET /payments/verify/:orderId', rtk: 'getPaymentStatus', steps: '1. After payment 2. Check status', expected: 'Status returns PAID with details' });
  s('COD', 'Placement', 'COD order success', { api: 'POST /orders', steps: '1. Select COD 2. Place Order', expected: 'Order created with paymentMethod=cod, status=CREATED' });
  s('COD', 'No Payment', 'No Razorpay flow for COD', { steps: '1. COD checkout 2. Observe', expected: 'Direct order creation, no payment SDK' });
  s('Pending', 'Tracker', 'PendingPaymentTracker shown', { component: 'PendingPaymentTracker', steps: '1. Payment pending 2. Open app', expected: 'Banner shows pending payment status' });
  s('Pending', 'Convergence', 'Pending → PAID after webhook', { steps: '1. Payment pending 2. Webhook arrives', expected: 'Tracker disappears, order shows PAID' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 14: ORDERS
// ═══════════════════════════════════════════════════════════════════
function generateOrderTests() {
  const tests = []; const M = 'Orders'; const P = 'ORD';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('OrdersList', 'Navigation', 'Orders tab loads', { screen: 'OrdersListScreen', rtk: 'getOrders', steps: '1. Tap Orders tab', expected: 'Orders list loads' });
  s('OrdersList', 'Display', 'Orders shown with status/date/total', { steps: '1. Open orders 2. Check list', expected: 'Each order shows ID, status badge, date, total' });
  s('OrdersList', 'Filter', 'Filter by status', { steps: '1. Filter by DELIVERED', expected: 'Only delivered orders shown' });
  s('OrdersList', 'Pagination', 'Load more orders on scroll', { steps: '1. Scroll to bottom', expected: 'Next page loads' });
  s('OrdersList', 'Empty', 'No orders shows empty state', { steps: '1. New user 2. Open Orders', expected: '"No orders yet" with shop now CTA' });
  s('OrderDetail', 'Navigation', 'Tap order → detail screen', { screen: 'OrderDetailScreen', rtk: 'getOrderById', steps: '1. Tap an order', expected: 'OrderDetail loads with full info' });
  s('OrderDetail', 'Display', 'Order items, address, payment shown', { steps: '1. Open order detail', expected: 'Items list, delivery address, payment method, amounts' });
  s('OrderDetail', 'Status', 'Status timeline/badges', { steps: '1. Check order status section', expected: 'Current status badge and timeline' });
  s('OrderDetail', 'Invoice', 'Download invoice', { api: 'GET /orders/:id/invoice', rtk: 'getOrderInvoice', steps: '1. Tap Download Invoice', expected: 'Invoice PDF downloads/opens' });
  s('OrderDetail', 'Cancel', 'Cancel order (if cancellable)', { api: 'PUT /orders/:id/cancel', rtk: 'cancelOrder', steps: '1. Open CREATED order 2. Tap Cancel 3. Confirm', expected: 'Order cancelled, status updates' });
  s('OrderDetail', 'Cancel', 'Cannot cancel delivered order', { steps: '1. Open DELIVERED order 2. Check', expected: 'Cancel button not visible' });
  s('OrderDetail', 'Refund', 'Request refund', { api: 'POST /orders/:id/refund', rtk: 'requestRefund', steps: '1. Cancelled order 2. Request Refund', expected: 'Refund initiated' });
  s('OrderDetail', 'Track', 'Track order button → Tracking', { screen: 'OrderTrackingScreen', steps: '1. Active order 2. Tap Track', expected: 'Navigate to OrderTracking' });
  s('OrderSuccess', 'Display', 'Success screen after payment', { screen: 'OrderSuccessScreen', steps: '1. Complete payment', expected: 'Success screen with order ID and animation' });
  s('OrderSuccess', 'Navigation', 'View Order button', { steps: '1. On success 2. Tap View Order', expected: 'Navigate to OrderDetail' });
  s('OrderSuccess', 'Back', 'Back gesture disabled', { steps: '1. Try swipe back from success', expected: 'Gesture disabled (gestureEnabled: false)' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// MODULE 15: ORDER TRACKING
// ═══════════════════════════════════════════════════════════════════
function generateTrackingTests() {
  const tests = []; const M = 'Tracking'; const P = 'TRACK';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, M, sub, feat, subFeat, opts));

  s('Tracking', 'Navigation', 'Tracking screen loads', { screen: 'OrderTrackingScreen', rtk: 'getOrderTracking', steps: '1. Active order 2. Tap Track', expected: 'Tracking screen with map loads' });
  s('Tracking', 'Socket', 'Live rider location via socket', { socket: 'order:location-update', steps: '1. Open tracking 2. Rider moves', expected: 'Rider marker moves on map in realtime' });
  s('Tracking', 'ETA', 'ETA displayed and updates', { steps: '1. Open tracking 2. Check ETA', expected: 'Estimated arrival time shown and updates' });
  s('Tracking', 'Rider Info', 'Rider name and phone shown', { steps: '1. Open tracking 2. Check rider card', expected: 'Rider name, photo, phone visible' });
  s('Tracking', 'Call Rider', 'Tap call rider', { steps: '1. Tap call icon on rider card', expected: 'Phone dialer opens with rider number' });
  s('Tracking', 'Polling Fallback', 'Socket fails → polling starts', { api: 'GET /orders/:id/tracking', steps: '1. Kill socket connection 2. Observe', expected: 'Tracking continues via HTTP polling' });
  s('Tracking', 'Terminal', 'DELIVERED state shows final', { steps: '1. Rider delivers 2. Check tracking', expected: 'Delivered badge, no more updates' });
  s('Tracking', 'Terminal', 'CANCELLED state shown', { steps: '1. Order cancelled 2. Check tracking', expected: 'Cancelled status, tracking stopped' });
  s('Tracking', 'Reconnect', 'Socket reconnects on resume', { steps: '1. Background app 2. Resume', expected: 'Socket reconnects, latest position shown' });
  s('Tracking', 'Deep Link', 'Notification → tracking screen', { notification: 'ORDER_STATUS', steps: '1. Receive push notification 2. Tap', expected: 'Deep links to OrderTracking screen' });
  s('Tracking', 'Loading', 'Loading while fetching tracking data', { steps: '1. Open tracking on slow network', expected: 'Loading indicator shown' });
  s('Tracking', 'Error', 'No tracking data available', { steps: '1. Order not yet assigned rider', expected: '"Waiting for rider assignment" message' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// MODULE 16-19: PROFILE, SETTINGS, SUPPORT, INFO
// ═══════════════════════════════════════════════════════════════════
function generateProfileSettingsTests() {
  const tests = []; const P = 'PROF';
  const s = (m, sub, feat, subFeat, opts) => tests.push(tc(P, m, sub, feat, subFeat, opts));

  // Profile
  s('Profile', 'Account', 'Navigation', 'Account tab loads', { screen: 'AccountScreen', steps: '1. Tap Account tab', expected: 'Profile screen with user info' });
  s('Profile', 'Account', 'Display', 'User name/phone/email shown', { rtk: 'getProfile', steps: '1. Open Account', expected: 'User details displayed' });
  s('Profile', 'Account', 'Edit Profile', 'Navigate to EditProfile', { screen: 'EditProfileScreen', steps: '1. Tap Edit Profile', expected: 'Edit form loads' });
  s('Profile', 'EditProfile', 'Update', 'Change name succeeds', { api: 'PUT /auth/complete-profile', rtk: 'updateProfile', steps: '1. Change name 2. Save', expected: 'Name updated' });
  s('Profile', 'EditProfile', 'Validation', 'Empty name rejected', { steps: '1. Clear name 2. Save', expected: 'Error: name required' });
  s('Profile', 'ReferEarn', 'Navigation', 'Refer & Earn loads', { screen: 'ReferEarnScreen', steps: '1. Tap Refer & Earn', expected: 'Referral screen with code' });
  s('Profile', 'ReferEarn', 'Share', 'Share referral code', { steps: '1. Tap Share', expected: 'System share sheet with code' });

  // Settings
  s('Settings', 'Settings', 'Navigation', 'Settings screen loads', { screen: 'SettingsScreen', steps: '1. Tap Settings', expected: 'Settings screen loads' });
  s('Settings', 'NotifPrefs', 'Navigation', 'Notification prefs loads', { screen: 'NotificationPreferencesScreen', api: 'GET /user/notification-preferences', rtk: 'getNotificationPreferences', steps: '1. Tap Notification Preferences', expected: 'Preferences screen with toggles' });
  s('Settings', 'NotifPrefs', 'Toggle', 'Enable/disable category', { api: 'PUT /user/notification-preferences', rtk: 'updateNotificationPreferences', steps: '1. Toggle a notification category', expected: 'Preference saved' });

  // Support
  s('Support', 'Help', 'Navigation', 'Help screen loads', { screen: 'HelpSupportScreen', steps: '1. Tap Help & Support', expected: 'Help screen with FAQ/contact' });
  s('Support', 'Contact', 'Navigation', 'Contact screen loads', { screen: 'ContactScreen', steps: '1. Tap Contact Us', expected: 'Contact screen with options' });
  s('Support', 'Contact', 'Phone', 'Tap phone calls support', { steps: '1. Tap phone number', expected: 'Dialer opens with 9391795162' });
  s('Support', 'Contact', 'WhatsApp', 'Tap WhatsApp opens chat', { steps: '1. Tap WhatsApp', expected: 'WhatsApp opens with support number' });
  s('Support', 'Contact', 'Email', 'Tap email opens mail', { steps: '1. Tap email', expected: 'Mail client opens' });
  s('Support', 'Contact', 'Maps', 'Tap address opens maps', { steps: '1. Tap address/maps link', expected: 'Maps app opens with location' });

  // Info / Legal
  s('Info', 'About', 'Navigation', 'About screen loads', { screen: 'AboutScreen', steps: '1. Tap About', expected: 'About page with app info' });
  s('Info', 'Privacy', 'Navigation', 'Privacy policy loads', { screen: 'PrivacyPolicyScreen', steps: '1. Tap Privacy Policy', expected: 'Privacy content renders' });
  s('Info', 'Terms', 'Navigation', 'Terms screen loads', { screen: 'TermsScreen', steps: '1. Tap Terms', expected: 'Terms content renders' });
  s('Info', 'Cancellation', 'Navigation', 'Cancellation policy loads', { screen: 'CancellationScreen', steps: '1. Tap Cancellation', expected: 'Cancellation policy renders' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// DELIVERY MODULES (D1-D8)
// ═══════════════════════════════════════════════════════════════════
function generateDeliveryTests() {
  const tests = []; const P = 'DEL';
  const s = (m, sub, feat, subFeat, opts) => tests.push(tc(P, m, sub, feat, subFeat, opts));

  // D1: Delivery Auth
  s('Delivery Auth', 'Login', 'Navigation', 'Delivery login screen', { screen: 'DeliveryLoginScreen', steps: '1. From Login tap "Delivery Partner"', expected: 'Delivery login screen loads' });
  s('Delivery Auth', 'Login', 'Success', 'Valid credentials login', { api: 'POST /delivery/auth/login', rtk: 'deliveryLogin', steps: '1. Enter email/password 2. Login', expected: 'Login success, navigate to Delivery home' });
  s('Delivery Auth', 'Login', 'Failure', 'Wrong password error', { steps: '1. Enter wrong password 2. Login', expected: 'Error: invalid credentials' });
  s('Delivery Auth', 'Login', 'Pending', 'KYC pending shows message', { steps: '1. Login with pending KYC account', expected: 'Message: KYC pending, wait for approval' });
  s('Delivery Auth', 'Signup', 'Navigation', 'Signup screen loads', { screen: 'DeliverySignupScreen', steps: '1. Tap signup link', expected: 'Delivery signup form loads' });
  s('Delivery Auth', 'Signup', 'Success', 'Valid signup', { api: 'POST /delivery/auth/signup', rtk: 'deliverySignup', steps: '1. Fill name/email/phone/password/vehicle 2. Submit', expected: 'Account created, KYC prompt shown' });
  s('Delivery Auth', 'Signup', 'Validation', 'Missing fields error', { steps: '1. Leave email empty 2. Submit', expected: 'Validation errors shown' });
  s('Delivery Auth', 'Signup', 'Vehicle', 'Vehicle type selection', { steps: '1. Select vehicle type from dropdown', expected: 'AUTO/CAR/BIKE/SCOOTER/CYCLE options available' });

  // D2: KYC
  s('Delivery KYC', 'KYC', 'Navigation', 'KYC screen loads', { screen: 'DeliveryKYCScreen', steps: '1. After signup 2. Navigate to KYC', expected: 'KYC document upload screen' });
  s('Delivery KYC', 'KYC', 'Upload', 'Document upload success', { steps: '1. Take/select document photo 2. Upload', expected: 'Document uploaded to Cloudinary' });
  s('Delivery KYC', 'KYC', 'Status', 'NOT_STARTED shown initially', { steps: '1. New rider opens KYC', expected: 'Status: NOT_STARTED, upload prompts' });
  s('Delivery KYC', 'KYC', 'Status', 'PENDING after submission', { steps: '1. Submit KYC docs 2. Check status', expected: 'Status: PENDING, wait message' });
  s('Delivery KYC', 'KYC', 'Status', 'VERIFIED after admin approval', { steps: '1. Admin approves 2. Rider checks', expected: 'Status: VERIFIED, can go online' });
  s('Delivery KYC', 'KYC', 'Status', 'REJECTED shows reason + re-upload', { steps: '1. Admin rejects 2. Rider checks', expected: 'Rejection reason shown, re-upload option' });
  s('Delivery KYC', 'Selfie', 'Navigation', 'Selfie screen loads', { screen: 'DeliverySelfieScreen', steps: '1. Navigate to selfie upload', expected: 'Camera/upload screen loads' });
  s('Delivery KYC', 'Selfie', 'Upload', 'Selfie captured and saved', { api: 'PUT /delivery/update-selfie', rtk: 'updateSelfie', steps: '1. Take selfie 2. Upload', expected: 'Selfie saved to profile' });

  // D3: Dashboard
  s('Delivery Dashboard', 'Home', 'Navigation', 'Dashboard loads after KYC', { screen: 'DeliveryDashboardScreen', steps: '1. Verified rider logs in', expected: 'Dashboard with status/orders' });
  s('Delivery Dashboard', 'Home', 'Toggle', 'Availability toggle', { api: 'PUT /delivery/status', rtk: 'toggleStatus', steps: '1. Toggle Online/Offline', expected: 'Status changes, API called' });
  s('Delivery Dashboard', 'Home', 'Orders', 'Active orders shown', { rtk: 'getDeliveryOrders', steps: '1. Open Home tab', expected: 'Assigned orders visible' });
  s('Delivery Dashboard', 'Home', 'Idle State', 'No orders shows idle card', { component: 'StateCard', steps: '1. Online with no orders', expected: 'IDLE state card shown' });

  // D4: Order Flow
  s('Delivery Flow', 'Accept', 'Order assignment notification', { notification: 'ORDER_ASSIGNED', steps: '1. Admin assigns order 2. Rider app', expected: 'New order notification/card appears' });
  s('Delivery Flow', 'Accept', 'Accept order', { api: 'POST /delivery/orders/:id/accept', rtk: 'acceptOrder', steps: '1. Tap Accept on new order', expected: 'Order accepted, status changes' });
  s('Delivery Flow', 'Accept', 'Reject order', { api: 'POST /delivery/orders/:id/reject', rtk: 'rejectOrder', steps: '1. Tap Reject', expected: 'Order rejected, removed from list' });
  s('Delivery Flow', 'Pickup', 'Pickup order', { api: 'POST /delivery/orders/:id/pickup', rtk: 'pickupOrder', steps: '1. At store 2. Tap Confirm Pickup', expected: 'Status → picked_up' });
  s('Delivery Flow', 'Start', 'Start delivery', { api: 'POST /delivery/orders/:id/start-delivery', rtk: 'startDelivery', steps: '1. After pickup 2. Tap Start Delivery', expected: 'Status → in_transit, nav starts' });
  s('Delivery Flow', 'Navigate', 'Route screen with maps', { screen: 'DeliveryRouteScreen', steps: '1. Start delivery 2. Open navigation', expected: 'Map with route shown' });
  s('Delivery Flow', 'Arrive', 'Mark arrived', { api: 'POST /delivery/orders/:id/arrived', rtk: 'markArrived', steps: '1. At destination 2. Tap Mark Arrived', expected: 'Status → arrived' });
  s('Delivery Flow', 'OTP', 'Enter delivery OTP', { api: 'POST /delivery/orders/:id/verify-otp', rtk: 'verifyDeliveryOtp', steps: '1. Enter OTP from customer 2. Verify', expected: 'OTP verified, order delivered' });
  s('Delivery Flow', 'OTP', 'Wrong OTP error', { steps: '1. Enter wrong OTP 2. Verify', expected: 'Error: invalid OTP' });
  s('Delivery Flow', 'OTP', 'Resend OTP', { api: 'POST /delivery/orders/:id/resend-otp', rtk: 'resendOtp', steps: '1. Tap Resend OTP', expected: 'New OTP sent to customer' });
  s('Delivery Flow', 'COD', 'COD collection gate', { api: 'POST /delivery/orders/:id/cod-collection', rtk: 'createCodCollection', steps: '1. COD order 2. Collect payment 3. Confirm', expected: 'Payment collected, proceed to OTP' });
  s('Delivery Flow', 'Failure', 'Record delivery failure', { api: 'POST /delivery/orders/:id/attempt', rtk: 'recordDeliveryAttempt', steps: '1. Cannot deliver 2. Tap Failed 3. Select reason', expected: 'Failure recorded, reattempt or escalation' });
  s('Delivery Flow', 'Escalation', 'Escalate after max attempts', { api: 'POST /delivery/orders/:id/escalate', rtk: 'escalateOrder', steps: '1. Max attempts reached 2. Escalate', expected: 'Order escalated for reassignment' });
  s('Delivery Flow', 'Reassignment', 'Reassigned order removed', { steps: '1. Admin reassigns to another rider', expected: 'Order removed from current rider list' });

  // D5: Earnings
  s('Delivery Earnings', 'Earnings', 'Navigation', 'Earnings tab loads', { screen: 'DeliveryEarningsTab', rtk: 'getEarnings', steps: '1. Tap Earnings tab', expected: 'Earnings summary and history' });
  s('Delivery Earnings', 'Earnings', 'After Delivery', 'Earning credited', { collection: 'deliveryearnings,riderwallet', steps: '1. Complete delivery 2. Check earnings', expected: 'Delivery fee credited exactly once' });
  s('Delivery Earnings', 'Earnings', 'History', 'Transaction history', { steps: '1. Open earnings history', expected: 'All past earnings with dates shown' });

  // D6: Background GPS
  s('Delivery GPS', 'GPS', 'Foreground', 'Location updates while active', { api: 'PUT /delivery/location', rtk: 'updateLocation', bgTask: 'backgroundLocationTask', steps: '1. Start delivery 2. Move', expected: 'Location updates sent to server' });
  s('Delivery GPS', 'GPS', 'Background', 'Location in background (Android)', { platform: 'Android', steps: '1. Start delivery 2. Background app 3. Move', expected: 'Location still updates' });
  s('Delivery GPS', 'GPS', 'Background', 'Location in background (iOS)', { platform: 'iOS', steps: '1. Start delivery 2. Background 3. Move', expected: 'Location updates with iOS permissions' });
  s('Delivery GPS', 'GPS', 'Mock GPS', 'Mocked GPS rejected', { steps: '1. Enable GPS spoofing 2. Try to deliver', expected: 'Mocked GPS detected, action blocked' });
  s('Delivery GPS', 'GPS', '422 Stop', 'Backend 422 stops route', { steps: '1. Server returns 422 for location', expected: 'Background task stops, route cleared' });
  s('Delivery GPS', 'GPS', 'Permission', 'Location permission prompt', { steps: '1. First delivery 2. Check permission', expected: 'FG+BG location permission requested' });

  // D7: Offline Action Queue
  s('Delivery Offline', 'Queue', 'Enqueue', 'Actions queued offline', { offline: 'delivery useActionQueue', steps: '1. Go offline 2. Tap pickup/arrive', expected: 'Action queued locally, UI shows "Queued"' });
  s('Delivery Offline', 'Queue', 'Replay', 'Queue replays on reconnect', { steps: '1. Queue actions offline 2. Reconnect', expected: 'Actions replayed FIFO, status updates' });
  s('Delivery Offline', 'Queue', 'Reassigned Drop', 'Reassigned order actions dropped', { steps: '1. Queue action 2. Order reassigned before replay', expected: 'Queued actions for that order discarded' });
  s('Delivery Offline', 'Queue', 'Retry/Backoff', 'Failed replay retries with backoff', { steps: '1. Action fails on replay', expected: 'Retries with exponential backoff' });
  s('Delivery Offline', 'Banner', 'Offline banner shown', { component: 'GlobalConnectivityBanner', steps: '1. Go offline', expected: 'Red "You are offline" banner shown' });
  s('Delivery Offline', 'Banner', 'Syncing banner', { steps: '1. Reconnect with queued actions', expected: 'Yellow "Syncing..." banner' });
  s('Delivery Offline', 'Banner', 'Reconnected banner', { steps: '1. After successful sync', expected: 'Green "Back online" banner (auto-hides)' });

  // D8: More/Settings
  s('Delivery More', 'Profile', 'Navigation', 'Profile loads', { screen: 'DeliveryProfileScreen', rtk: 'getDeliveryProfile', steps: '1. Tap Profile', expected: 'Profile with details' });
  s('Delivery More', 'Settings', 'Navigation', 'Settings loads', { screen: 'DeliverySettingsScreen', steps: '1. Tap Settings', expected: 'Settings screen loads' });
  s('Delivery More', 'Emergency', 'Navigation', 'Emergency screen', { screen: 'DeliveryEmergencyScreen', steps: '1. Tap Emergency', expected: 'Emergency contact/help screen' });
  s('Delivery More', 'Help', 'Navigation', 'Help center loads', { screen: 'DeliveryHelpCenterScreen', steps: '1. Tap Help Center', expected: 'Help content loads' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// ADMIN MODULES (A1-A8)
// ═══════════════════════════════════════════════════════════════════
function generateAdminTests() {
  const tests = []; const P = 'ADMIN';
  const s = (m, sub, feat, subFeat, opts) => tests.push(tc(P, m, sub, feat, subFeat, opts));

  // A1: Dashboard
  s('Admin Dashboard', 'Auth', 'Login', 'Admin login success', { screen: 'AdminDashboardScreen', steps: '1. Login with admin role', expected: 'AdminNavigator loads' });
  s('Admin Dashboard', 'Dashboard', 'Stats', 'Dashboard stats load', { rtk: 'getDashboardStats', steps: '1. Open admin dashboard', expected: 'Revenue, orders, users stats shown' });
  s('Admin Dashboard', 'Profile', 'Navigation', 'Admin profile loads', { screen: 'AdminProfileScreen', steps: '1. Tap admin profile', expected: 'Profile screen loads' });

  // A2: Products
  s('Admin Products', 'Products', 'List', 'Products list loads', { screen: 'AdminProductsScreen', rtk: 'getAdminProducts', steps: '1. Navigate to Products', expected: 'Products list with status badges' });
  s('Admin Products', 'Products', 'Create', 'Create product', { screen: 'AdminCreateProductScreen', api: 'POST /admin/products', rtk: 'createAdminProduct', steps: '1. Tap Create 2. Fill form 3. Save', expected: 'Product created in draft' });
  s('Admin Products', 'Products', 'Edit', 'Edit product', { screen: 'AdminEditProductScreen', api: 'PATCH /admin/products/:id', rtk: 'updateAdminProduct', steps: '1. Tap edit 2. Change fields 3. Save', expected: 'Product updated' });
  s('Admin Products', 'Products', 'Delete', 'Delete product', { api: 'DELETE /admin/products/:id', rtk: 'deleteAdminProduct', steps: '1. Tap delete 2. Confirm', expected: 'Product removed' });
  s('Admin Products', 'Products', 'Publish', 'Publish product', { api: 'POST /admin/products/:id/publish', rtk: 'publishAdminProduct', steps: '1. Draft product 2. Tap Publish', expected: 'Product published, visible to customers' });
  s('Admin Products', 'Versions', 'History', 'Version history loads', { screen: 'AdminProductVersionHistoryScreen', rtk: 'getProductVersionHistory', steps: '1. Tap version history', expected: 'Version list with diffs' });
  s('Admin Products', 'Versions', 'Rollback', 'Rollback to previous version', { api: 'POST /admin/products/:id/rollback/:v', rtk: 'rollbackProduct', steps: '1. Select old version 2. Rollback', expected: 'Product reverts to selected version' });

  // A3: Orders
  s('Admin Orders', 'Orders', 'List', 'Orders list loads', { screen: 'AdminOrdersScreen', rtk: 'getAdminOrders', steps: '1. Open Admin Orders', expected: 'All orders with status badges' });
  s('Admin Orders', 'Orders', 'Detail', 'Order detail loads', { screen: 'AdminOrderDetailScreen', steps: '1. Tap an order', expected: 'Full order detail with actions' });
  s('Admin Orders', 'Orders', 'Confirm', 'Confirm order', { api: 'POST /admin/orders/:id/confirm', rtk: 'confirmOrder', steps: '1. CREATED order 2. Tap Confirm', expected: 'Order → CONFIRMED' });
  s('Admin Orders', 'Orders', 'Pack', 'Pack order', { api: 'POST /admin/orders/:id/pack', rtk: 'packOrder', steps: '1. CONFIRMED order 2. Tap Pack', expected: 'Order → PACKED' });
  s('Admin Orders', 'Orders', 'Assign', 'Assign delivery partner', { api: 'PATCH /admin/orders/:id/assign', rtk: 'assignOrder', component: 'DeliveryPartnerSelectionModal', steps: '1. PACKED order 2. Select partner 3. Assign', expected: 'Order assigned to rider' });
  s('Admin Orders', 'Orders', 'Assign', 'Double-tap assign is safe', { steps: '1. Tap assign rapidly twice', expected: 'Only one assignment (no duplicate)' });
  s('Admin Orders', 'Orders', 'Cancel', 'Cancel order', { api: 'PUT /orders/:id/cancel', rtk: 'cancelOrder', component: 'CancelOrderModal', steps: '1. Tap cancel 2. Confirm', expected: 'Order cancelled, refund triggered' });
  s('Admin Orders', 'COD', 'Collection', 'View COD collection', { rtk: 'getAdminCodCollection', component: 'CodCollectionCard', steps: '1. COD order delivered 2. Check', expected: 'Collection status and amount shown' });

  // A4: Delivery Management
  s('Admin Delivery', 'DeliveryBoys', 'List', 'Delivery boys list', { screen: 'AdminDeliveryBoysScreen', rtk: 'getDeliveryBoys', steps: '1. Open Delivery Boys', expected: 'List with status/vehicle/KYC state' });
  s('Admin Delivery', 'KYC', 'Review', 'KYC review approve', { api: 'POST /admin/delivery-boys/:id/kyc/review', rtk: 'reviewDeliveryKyc', steps: '1. Pending KYC 2. Review docs 3. Approve', expected: 'Rider status → VERIFIED' });
  s('Admin Delivery', 'KYC', 'Review', 'KYC review reject', { steps: '1. Review docs 2. Reject with reason', expected: 'Rider status → REJECTED with reason' });
  s('Admin Delivery', 'Partners', 'Available', 'Available partners list', { rtk: 'getDeliveryPartners', screen: 'SelectDeliveryPartnerScreen', steps: '1. Assigning order 2. View partners', expected: 'Available/busy partners shown' });
  s('Admin Delivery', 'Suspend', 'Action', 'Suspend delivery partner', { api: 'PUT /admin/delivery-boys/:id/suspend', rtk: 'suspendDeliveryBoy', steps: '1. Select rider 2. Suspend with reason', expected: 'Rider suspended, cannot go online' });
  s('Admin Delivery', 'Routes', 'List', 'Routes screen loads', { screen: 'AdminRoutesScreen', rtk: 'getAdminRoutes', steps: '1. Open Routes', expected: 'Route list with status/distance' });
  s('Admin Delivery', 'Routes', 'Preview', 'Route preview/compute', { screen: 'AdminRoutesPreviewScreen', rtk: 'getClusters', steps: '1. Tap Route Preview', expected: 'Computed clusters shown on map' });
  s('Admin Delivery', 'Routes', 'Assign', 'Assign route to rider', { rtk: 'assignCluster', steps: '1. Select cluster 2. Select rider 3. Assign', expected: 'Route assigned' });
  s('Admin Delivery', 'Routes', 'Map', 'Route map view', { screen: 'AdminRouteMapScreen', steps: '1. Tap route 2. View map', expected: 'Route plotted on map' });
  s('Admin Delivery', 'Routes', 'Recent', 'Recent routes list', { screen: 'AdminRecentRoutesScreen', rtk: 'getRecentRoutes', steps: '1. Open Recent Routes', expected: 'Historical routes shown' });
  s('Admin Delivery', 'Clusters', 'Orders', 'Cluster orders view', { screen: 'ClusterOrdersScreen', steps: '1. Tap cluster', expected: 'Orders in cluster shown' });

  // A5-A8: Users, Finance, Analytics, Settings
  s('Admin Users', 'Users', 'List', 'Users list loads', { screen: 'AdminUsersScreen', rtk: 'getAdminUsers', steps: '1. Open Users', expected: 'Users list with roles' });
  s('Admin Users', 'Users', 'Delete', 'Delete user', { api: 'DELETE /admin/users/:id', rtk: 'deleteAdminUser', steps: '1. Select user 2. Delete', expected: 'User removed' });
  s('Admin Finance', 'Finance', 'Health', 'Finance health loads', { screen: 'AdminFinanceScreen', rtk: 'getFinanceHealth', steps: '1. Open Finance', expected: 'Financial health metrics' });
  s('Admin Finance', 'Finance', 'Revenue', 'Revenue ledger loads', { rtk: 'getFinanceRevenueLedger', steps: '1. Select date range 2. View revenue', expected: 'Revenue data shown' });
  s('Admin Finance', 'Payments', 'Reconciliation', 'Payment logs load', { screen: 'AdminPaymentsScreen', rtk: 'getPaymentLogs', steps: '1. Open Payments', expected: 'Payment reconciliation data' });
  s('Admin Finance', 'Payments', 'Recovery', 'Payment recovery action', { rtk: 'executePaymentRecovery', steps: '1. Stuck payment 2. Execute recovery', expected: 'Payment recovered or marked failed' });
  s('Admin Analytics', 'Analytics', 'Navigation', 'Analytics loads', { screen: 'AdminAnalyticsScreen', rtk: 'getAnalytics', steps: '1. Open Analytics', expected: 'Charts and metrics load' });
  s('Admin Ops', 'Ops', 'Outbox', 'Outbox failures shown', { screen: 'AdminOpsScreen', rtk: 'getOutboxFailures', steps: '1. Open Ops', expected: 'Failed outbox events listed' });
  s('Admin Ops', 'Ops', 'Inventory', 'Inventory drift check', { rtk: 'getInventoryDrift', steps: '1. Check inventory drift', expected: 'Drift report shown' });
  s('Admin Settings', 'Settings', 'Navigation', 'Admin settings loads', { screen: 'AdminSettingsScreen', rtk: 'getAdminSettings', steps: '1. Open Settings', expected: 'Store config fields shown' });
  s('Admin Settings', 'Settings', 'Update', 'Update store settings', { api: 'PUT /admin/settings', rtk: 'updateAdminSettings', steps: '1. Change setting 2. Save', expected: 'Settings updated' });
  s('Admin Settings', 'Killswitch', 'Toggle', 'Tracking killswitch', { rtk: 'toggleKillswitch', steps: '1. Toggle killswitch', expected: 'Tracking enabled/disabled globally' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// CROSS-CUTTING: NOTIFICATIONS, OFFLINE, PERMISSIONS, LIFECYCLE, DEEP LINKS
// ═══════════════════════════════════════════════════════════════════
function generateCrossCuttingTests() {
  const tests = []; const P = 'CROSS';
  const s = (m, sub, feat, subFeat, opts) => tests.push(tc(P, m, sub, feat, subFeat, opts));

  // Notifications
  s('Notifications', 'Push', 'Permission', 'Push permission prompt', { steps: '1. First launch 2. Observe', expected: 'Notification permission dialog shown' });
  s('Notifications', 'Push', 'Permission', 'Permission denied path', { steps: '1. Deny push permission 2. Try actions', expected: 'App works without push, no crash' });
  s('Notifications', 'Push', 'Token', 'Token registered on login', { api: 'POST /notifications/token', steps: '1. Login 2. Grant permission', expected: 'Device token registered with backend' });
  s('Notifications', 'Push', 'Token', 'Token removed on logout', { steps: '1. Logout', expected: 'Push token deregistered' });
  s('Notifications', 'Push', 'Receive', 'Order status push received', { notification: 'ORDER_STATUS', steps: '1. Order status changes 2. Check notification', expected: 'Push notification received with correct text' });
  s('Notifications', 'Push', 'Receive', 'Payment confirmed push', { notification: 'PAYMENT_CONFIRMED', steps: '1. Payment succeeds', expected: 'Payment confirmation push received' });
  s('Notifications', 'Push', 'Receive', 'Refund completed push', { notification: 'REFUND_COMPLETED', steps: '1. Refund processes', expected: 'Refund notification received' });
  s('Notifications', 'In-App', 'List', 'Notifications screen loads', { screen: 'NotificationsScreen', rtk: 'getNotifications', steps: '1. Open Notifications', expected: 'Notification list with categories' });
  s('Notifications', 'In-App', 'Read', 'Mark as read', { api: 'PUT /notifications/:id/read', rtk: 'markAsRead', steps: '1. Tap notification', expected: 'Marked as read, count decrements' });
  s('Notifications', 'In-App', 'Read All', 'Mark all as read', { api: 'PUT /notifications/read-all', rtk: 'markAllAsRead', steps: '1. Tap Mark All Read', expected: 'All notifications read, count = 0' });
  s('Notifications', 'In-App', 'Delete', 'Delete notification', { api: 'DELETE /notifications/:id', rtk: 'deleteNotification', steps: '1. Swipe to delete', expected: 'Notification removed from list' });

  // Deep Links
  s('Deep Links', 'Notification', 'OrderTracking', 'Push tap → OrderTracking', { screen: 'OrderTrackingScreen', steps: '1. Receive order push 2. Tap it', expected: 'Opens OrderTracking for that order' });
  s('Deep Links', 'Notification', 'OrderDetail', 'Push tap → OrderDetail', { screen: 'OrderDetailScreen', steps: '1. Receive delivery push 2. Tap', expected: 'Opens OrderDetail screen' });
  s('Deep Links', 'External', 'Phone', 'tel: link opens dialer', { steps: '1. Tap phone number link', expected: 'System dialer opens' });
  s('Deep Links', 'External', 'WhatsApp', 'whatsapp: link opens app', { steps: '1. Tap WhatsApp link', expected: 'WhatsApp opens with number' });
  s('Deep Links', 'External', 'Email', 'mailto: link opens mail', { steps: '1. Tap email link', expected: 'Mail client opens' });
  s('Deep Links', 'External', 'Maps', 'maps link opens navigation', { steps: '1. Tap maps/address link', expected: 'Maps app opens with location' });
  s('Deep Links', 'External', 'Settings', 'openSettings link', { steps: '1. Permission denied 2. Tap "Open Settings"', expected: 'System settings opens' });

  // Offline / Connectivity
  s('Offline', 'Detection', 'Banner', 'Offline banner shown', { component: 'OfflineBanner', steps: '1. Disable network', expected: 'Offline banner appears' });
  s('Offline', 'Detection', 'Banner', 'Online banner dismisses', { steps: '1. Re-enable network', expected: 'Banner dismisses, data refreshes' });
  s('Offline', 'Queue', 'Cart', 'Add to cart offline', { offline: 'ADD_TO_CART', steps: '1. Offline 2. Add to cart', expected: 'Queued, shown locally' });
  s('Offline', 'Queue', 'Cart', 'Update quantity offline', { offline: 'UPDATE_CART_QUANTITY', steps: '1. Offline 2. Change qty', expected: 'Queued locally' });
  s('Offline', 'Queue', 'Replay', 'Queue replays on reconnect', { steps: '1. Queue 3 actions 2. Reconnect', expected: 'All replay in order, no dupes' });
  s('Offline', 'Queue', 'Dedup', 'Duplicate actions not queued', { steps: '1. Add same item twice offline', expected: 'Only one action in queue' });
  s('Offline', 'Queue', 'Persistence', 'Queue survives app kill', { steps: '1. Queue action 2. Kill app 3. Reopen 4. Reconnect', expected: 'Queue restored from AsyncStorage, replays' });
  s('Offline', 'Queue', 'Max Retries', '3 failures drops action', { steps: '1. Queue action 2. API fails 3x', expected: 'Action dropped after 3 retries' });
  s('Offline', 'Socket', 'Reconnect', 'Socket reconnects', { socket: 'reconnect', steps: '1. Socket disconnects 2. Network restored', expected: 'Socket reconnects automatically' });
  s('Offline', 'Error Screen', 'Full offline', 'Connectivity error screen', { component: 'ConnectivityErrorScreen', steps: '1. Offline 2. Open new screen needing data', expected: 'Error screen with retry' });

  // Permissions
  s('Permissions', 'Notification', 'Grant', 'Push permission granted', { steps: '1. Grant notification permission', expected: 'Token registered, pushes work' });
  s('Permissions', 'Notification', 'Deny', 'Push permission denied', { steps: '1. Deny notification permission', expected: 'App functional, no push received' });
  s('Permissions', 'Microphone', 'Grant', 'Mic permission for voice', { steps: '1. Tap voice search 2. Grant mic', expected: 'Voice recording starts' });
  s('Permissions', 'Microphone', 'Deny', 'Mic denied shows explanation', { steps: '1. Deny mic 2. Tap voice', expected: 'Permission explanation/settings redirect' });
  s('Permissions', 'Location', 'Foreground', 'FG location for delivery', { steps: '1. Delivery rider 2. Grant FG location', expected: 'Location tracking works' });
  s('Permissions', 'Location', 'Background', 'BG location for delivery', { steps: '1. Grant BG location', expected: 'Background tracking works' });
  s('Permissions', 'Location', 'Deny', 'Location denied blocks delivery', { steps: '1. Deny location 2. Try to deliver', expected: 'Cannot start delivery, permission prompt' });

  // App Lifecycle
  s('Lifecycle', 'Background', 'Resume', 'App resumes correctly', { steps: '1. Open app 2. Background 3. Resume', expected: 'State preserved, no crash' });
  s('Lifecycle', 'Kill', 'Restart', 'App kill → restart', { steps: '1. Kill app 2. Reopen', expected: 'Session restored, Home loads' });
  s('Lifecycle', 'State', 'Persistence', 'Redux state persists', { slice: 'authSlice,cartSlice', steps: '1. Add items 2. Kill app 3. Reopen', expected: 'Cart items still present' });
  s('Lifecycle', 'Rotation', 'Portrait/Landscape', 'Rotation handling', { steps: '1. Rotate device', expected: 'No crash, layout adapts (if supported)' });
  s('Lifecycle', 'Memory', 'Low Memory', 'Low memory handling', { steps: '1. Open many apps 2. Return to VS app', expected: 'App recovers gracefully' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// BACKEND API & SECURITY TESTS
// ═══════════════════════════════════════════════════════════════════
function generateBackendTests() {
  const tests = []; const P = 'API';
  const s = (m, sub, feat, subFeat, opts) => tests.push(tc(P, m, sub, feat, subFeat, opts));

  // Auth API
  s('Backend Auth', 'POST /auth/send-otp', 'Valid', 'Success response', { api: 'POST /auth/send-otp', route: 'admin.ts', collection: 'otps', steps: '1. POST with valid phone', expected: '200 + OTP created in DB' });
  s('Backend Auth', 'POST /auth/send-otp', 'Rate Limit', 'Too many requests', { api: 'POST /auth/send-otp', steps: '1. Send 10+ OTPs in 1 min', expected: '429 rate limit error' });
  s('Backend Auth', 'POST /auth/verify-otp', 'Valid', 'Correct OTP → tokens', { api: 'POST /auth/verify-otp', collection: 'users,usersessions', steps: '1. POST correct OTP', expected: '200 + access/refresh tokens' });
  s('Backend Auth', 'POST /auth/verify-otp', 'Invalid', 'Wrong OTP → error', { api: 'POST /auth/verify-otp', steps: '1. POST wrong OTP', expected: '400/401 invalid OTP' });
  s('Backend Auth', 'POST /auth/refresh', 'Valid', 'Refresh token works', { api: 'POST /auth/refresh', steps: '1. POST valid refresh token', expected: '200 + new access token' });
  s('Backend Auth', 'POST /auth/refresh', 'Expired', 'Expired refresh token', { api: 'POST /auth/refresh', steps: '1. POST expired token', expected: '401 unauthorized' });
  s('Backend Auth', 'POST /auth/logout', 'Valid', 'Session cleared', { api: 'POST /auth/logout', collection: 'usersessions', steps: '1. POST with valid token', expected: '200 + session blacklisted' });

  // Cart API
  s('Backend Cart', 'POST /cart', 'Valid', 'Add to cart', { api: 'POST /cart', route: 'cart.ts', collection: 'carts', steps: '1. POST productId + qty', expected: '200 + item in cart' });
  s('Backend Cart', 'POST /cart', 'Invalid', 'Non-existent product', { api: 'POST /cart', steps: '1. POST invalid productId', expected: '404 product not found' });
  s('Backend Cart', 'POST /cart', 'Auth', 'No token → 401', { api: 'POST /cart', steps: '1. POST without auth header', expected: '401 unauthorized' });
  s('Backend Cart', 'PUT /cart', 'Valid', 'Update quantity', { api: 'PUT /cart', steps: '1. PUT with new qty', expected: '200 + qty updated' });
  s('Backend Cart', 'DELETE /cart/:id', 'Valid', 'Remove item', { api: 'DELETE /cart/:id', steps: '1. DELETE with productId', expected: '200 + item removed' });

  // Orders API
  s('Backend Orders', 'POST /orders', 'COD', 'Create COD order', { api: 'POST /orders', route: 'orders.ts', collection: 'orders,payments', steps: '1. POST COD order', expected: '201 + order created' });
  s('Backend Orders', 'POST /orders', 'Idempotency', 'Duplicate key → same order', { api: 'POST /orders', steps: '1. POST same idempotency key twice', expected: 'Same order returned, no duplicate' });
  s('Backend Orders', 'PUT /orders/:id/cancel', 'Valid', 'Cancel cancellable order', { api: 'PUT /orders/:id/cancel', steps: '1. PUT cancel on CREATED order', expected: '200 + order cancelled + refund' });
  s('Backend Orders', 'PUT /orders/:id/cancel', 'Invalid', 'Cannot cancel DELIVERED', { api: 'PUT /orders/:id/cancel', steps: '1. PUT cancel on DELIVERED', expected: '400 cannot cancel' });

  // Payment API
  s('Backend Payments', 'POST /payments/razorpay-webhook', 'Valid', 'Webhook processes', { api: 'POST /payments/razorpay-webhook', route: 'orders.ts', collection: 'payments,orders', steps: '1. POST valid webhook signature', expected: 'Payment verified, order → PAID' });
  s('Backend Payments', 'POST /payments/razorpay-webhook', 'Invalid Sig', 'Bad signature rejected', { api: 'POST /payments/razorpay-webhook', steps: '1. POST with wrong signature', expected: '400 invalid signature' });
  s('Backend Payments', 'POST /payments/razorpay-webhook', 'Duplicate', 'Idempotent processing', { steps: '1. POST same webhook twice', expected: 'Second ignored, order stays PAID' });

  // Security
  s('Security', 'Auth', 'IDOR', 'Cannot access other user orders', { api: 'GET /orders/:id', steps: '1. User A token 2. GET user B order ID', expected: '403/404 forbidden' });
  s('Security', 'Auth', 'Role Guard', 'Customer cannot access admin', { api: 'GET /admin/orders', steps: '1. Customer token 2. GET admin endpoint', expected: '403 forbidden' });
  s('Security', 'Auth', 'Role Guard', 'Delivery cannot access admin', { api: 'GET /admin/products', steps: '1. Delivery token 2. GET admin endpoint', expected: '403 forbidden' });
  s('Security', 'Input', 'Injection', 'NoSQL injection in search', { api: 'GET /products?search=', steps: '1. search=$ne:null', expected: 'Sanitized, no injection' });
  s('Security', 'Input', 'XSS', 'XSS in review comment', { api: 'POST /products/:id/reviews', steps: '1. comment=<script>alert(1)</script>', expected: 'Sanitized or escaped in response' });
  s('Security', 'Rate Limit', 'Login', 'Brute force protection', { api: 'POST /auth/send-otp', steps: '1. 100 requests in 1 min', expected: '429 after threshold' });
  s('Security', 'JWT', 'Expired', 'Expired token rejected', { steps: '1. Use expired access token', expected: '401 token expired' });
  s('Security', 'JWT', 'Malformed', 'Invalid token rejected', { steps: '1. Use random string as token', expected: '401 invalid token' });

  // Delivery API
  s('Backend Delivery', 'POST /delivery/auth/login', 'Valid', 'Login success', { api: 'POST /delivery/auth/login', route: 'deliveryAuth.ts', steps: '1. POST email/password', expected: '200 + tokens' });
  s('Backend Delivery', 'POST /delivery/orders/:id/pickup', 'Valid', 'Pickup transitions', { api: 'POST /delivery/orders/:id/pickup', route: 'deliveryPersonnel.ts', steps: '1. POST with assigned order', expected: '200 + status=picked_up' });
  s('Backend Delivery', 'POST /delivery/orders/:id/verify-otp', 'Valid', 'OTP delivery', { api: 'POST /delivery/orders/:id/verify-otp', steps: '1. POST correct customer OTP', expected: '200 + order DELIVERED' });
  s('Backend Delivery', 'PUT /delivery/location', 'Valid', 'Location update', { api: 'PUT /delivery/location', route: 'locationRoutes.ts', steps: '1. PUT lat/lng/accuracy', expected: '200 + location stored in Redis' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// END-TO-END BUSINESS JOURNEYS
// ═══════════════════════════════════════════════════════════════════
function generateE2EJourneyTests() {
  const tests = []; const P = 'E2E';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, 'E2E Journey', sub, feat, subFeat, opts));

  s('Journey 1', 'Full Purchase', 'Guest→Login→Browse→Cart→Pay→Track→Delivered', { priority: 'P0', criticality: 'Critical', severity: 'Critical', minutes: 30, journey: 'J1', steps: '1. Open app (guest) 2. Login 3. Browse categories 4. Search product 5. Add to cart 6. Apply coupon 7. Checkout 8. Pay UPI 9. View order 10. Track 11. Rider delivers', expected: 'Complete flow succeeds end-to-end' });
  s('Journey 2', 'Payment Recovery', 'Pay fail→retry→success', { priority: 'P0', criticality: 'Critical', minutes: 20, journey: 'J2', steps: '1. Checkout 2. Payment fails 3. Tap retry 4. Payment succeeds', expected: 'Order converges to PAID' });
  s('Journey 2b', 'App Kill Recovery', 'Kill mid-payment→webhook→converges', { priority: 'P0', criticality: 'Critical', minutes: 15, journey: 'J2b', steps: '1. Start payment 2. Kill app 3. Payment completes externally 4. Reopen app', expected: 'Order shows PAID via webhook convergence' });
  s('Journey 3', 'COD Delivery', 'COD→Admin→Pack→Assign→Deliver', { priority: 'P0', criticality: 'Critical', minutes: 30, journey: 'J3', steps: '1. Customer places COD 2. Admin confirms 3. Admin packs 4. Admin assigns rider 5. Rider picks up 6. Navigates 7. Arrives 8. COD collected 9. OTP 10. Delivered', expected: 'Full COD flow, earning credited to rider' });
  s('Journey 4', 'Cancel+Refund', 'Cancel→auto-refund→notification', { priority: 'P0', criticality: 'Critical', minutes: 15, journey: 'J4', steps: '1. Place order 2. Cancel 3. Refund processes', expected: 'Order cancelled, refund issued, notification received' });
  s('Journey 5', 'Reassignment', 'Assign A→reassign B', { priority: 'P1', minutes: 15, journey: 'J5', steps: '1. Assign to rider A 2. Reassign to rider B', expected: 'Customer tracking shows B, A queue dropped' });
  s('Journey 6', 'Offline Cart', 'Offline add→reconnect→syncs', { priority: 'P1', minutes: 10, journey: 'J6', steps: '1. Go offline 2. Add items to cart 3. Reconnect', expected: 'Cart syncs, no duplicates' });
  s('Journey 7', 'KYC Flow', 'Signup→KYC→Admin approve→Online', { priority: 'P1', minutes: 20, journey: 'J7', steps: '1. Delivery signup 2. Upload KYC 3. Admin approves 4. Rider goes online', expected: 'Complete KYC flow works' });
  s('Journey 8', 'Review After Delivery', 'Delivered→Write Review→Visible', { priority: 'P2', minutes: 10, journey: 'J8', steps: '1. Order delivered 2. Write review 3. Check AllReviews', expected: 'Review appears in product reviews' });
  s('Journey 9', 'Push Deep Link', 'Notification tap→correct screen', { priority: 'P1', minutes: 5, journey: 'J9', steps: '1. Receive order push 2. Tap notification', expected: 'Opens correct screen (Tracking/Detail)' });
  s('Journey 10', 'Multi-Device Rider', 'Same account 2 devices', { priority: 'P1', minutes: 15, journey: 'J10', steps: '1. Login on device A 2. Login on device B 3. Accept order on A', expected: 'No double actions, consistent state' });

  return tests;
}

// ═══════════════════════════════════════════════════════════════════
// EDGE CASES & REGRESSION
// ═══════════════════════════════════════════════════════════════════
function generateEdgeCaseTests() {
  const tests = []; const P = 'EDGE';
  const s = (sub, feat, subFeat, opts) => tests.push(tc(P, 'Edge Cases', sub, feat, subFeat, opts));

  s('Data', 'Empty', 'Empty cart checkout attempt', { steps: '1. Empty cart 2. Try Checkout button', expected: 'Button disabled or error' });
  s('Data', 'Empty', 'Zero quantity in cart', { steps: '1. Try setting qty=0', expected: 'Item removed or error' });
  s('Data', 'Max', 'Max quantity (999) in cart', { steps: '1. Set qty to 999', expected: 'Capped at stock limit or handled' });
  s('Data', 'Special Chars', 'Special chars in name/address', { steps: '1. Enter "Test @#$% User" as name', expected: 'Accepted and displayed correctly' });
  s('Data', 'Unicode', 'Hindi/Telugu text in fields', { steps: '1. Enter text in regional language', expected: 'Accepted, stored, displayed correctly' });
  s('Data', 'Long Text', 'Very long review comment', { steps: '1. Enter 5000 char review', expected: 'Truncated or accepted with limit' });
  s('Network', 'Slow 3G', 'App usable on 3G', { steps: '1. Throttle to 3G 2. Browse/add/checkout', expected: 'Works with loading states, no timeouts' });
  s('Network', 'Flaky', 'Intermittent connectivity', { steps: '1. Toggle network every 5s 2. Use app', expected: 'Graceful handling, no corruption' });
  s('Network', 'Timeout', 'API timeout handling', { steps: '1. Backend responds after 30s', expected: 'Timeout error shown, retry available' });
  s('Concurrency', 'Double Tap', 'Double-tap any CTA', { steps: '1. Rapidly double-tap Place Order / Add to Cart', expected: 'Single action executed' });
  s('Concurrency', 'Race', 'Two users buy last item', { steps: '1. Product stock=1 2. Both add to cart 3. Both checkout', expected: 'One succeeds, one gets OOS error' });
  s('State', 'Stale', 'Price changed mid-checkout', { steps: '1. Open checkout 2. Admin changes price', expected: 'Error or price refresh prompt' });
  s('State', 'Stale', 'Product deleted while in cart', { steps: '1. Add product 2. Admin deletes it 3. Open cart', expected: 'Item removed or flagged unavailable' });
  s('Recovery', 'Crash', 'App crash recovery', { steps: '1. Force crash 2. Reopen', expected: 'App recovers, no data loss' });
  s('Recovery', 'Update', 'App update preserves login', { steps: '1. Login 2. Update app 3. Reopen', expected: 'User still logged in' });

  return tests;
}


// ═══════════════════════════════════════════════════════════════════
// WORKBOOK GENERATION
// ═══════════════════════════════════════════════════════════════════
function generateWorkbook() {
  console.log('Generating Vyapara Setu Master QA Workbook...\n');

  // Collect all test cases
  const allTests = [
    ...generateAuthTests(),
    ...generateHomeTests(),
    ...generateCategoryTests(),
    ...generateSearchTests(),
    ...generateProductListTests(),
    ...generateProductDetailTests(),
    ...generateReviewTests(),
    ...generateCartTests(),
    ...generateCouponTests(),
    ...generateAddressTests(),
    ...generateCheckoutTests(),
    ...generatePaymentTests(),
    ...generateOrderTests(),
    ...generateTrackingTests(),
    ...generateProfileSettingsTests(),
    ...generateDeliveryTests(),
    ...generateAdminTests(),
    ...generateCrossCuttingTests(),
    ...generateBackendTests(),
    ...generateE2EJourneyTests(),
    ...generateEdgeCaseTests(),
    ...generateExpandedTests(),
  ];

  console.log(`Total atomic test cases: ${allTests.length}\n`);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Project Overview ──
  const overviewData = [
    ['Vyapara Setu — Master QA Workbook'],
    [''],
    ['Project', 'Vyapara Setu E-Commerce Platform'],
    ['Version', '1.0.0-rc'],
    ['Generated', new Date().toISOString()],
    ['Total Test Cases', allTests.length],
    ['Platform', 'React Native (Expo) - Android + iOS + Web Admin'],
    ['Architecture', 'Monorepo: backend/ + apps/customer-app/ + frontend/'],
    [''],
    ['Module Summary'],
    ['Module', 'Test Count', 'Critical', 'High', 'Medium', 'Low'],
  ];

  // Count by module
  const moduleCounts = {};
  allTests.forEach(t => {
    const mod = t['Parent Module'];
    if (!moduleCounts[mod]) moduleCounts[mod] = { total: 0, Critical: 0, High: 0, Medium: 0, Low: 0 };
    moduleCounts[mod].total++;
    const crit = t['Business Criticality'];
    if (moduleCounts[mod][crit] !== undefined) moduleCounts[mod][crit]++;
  });
  Object.entries(moduleCounts).forEach(([mod, counts]) => {
    overviewData.push([mod, counts.total, counts.Critical, counts.High, counts.Medium, counts.Low]);
  });

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, wsOverview, '01_Project_Overview');

  // ── Sheet 2: Master Test Execution (ALL tests) ──
  const wsMaster = XLSX.utils.json_to_sheet(allTests, { header: MASTER_COLUMNS });
  wsMaster['!cols'] = MASTER_COLUMNS.map(col => ({
    wch: col === 'Detailed Steps' || col === 'Expected Result' ? 50 :
         col === 'Test Title' || col === 'Objective' ? 40 :
         col === 'Test Number' ? 18 : 20
  }));
  XLSX.utils.book_append_sheet(wb, wsMaster, '02_Master_Execution');

  // ── Sheets 3-12: Module-specific sheets ──
  const moduleSheets = {
    '03_Customer_Auth': t => t['Parent Module'] === 'Authentication',
    '04_Search_Voice': t => t['Parent Module'] === 'Search',
    '05_Cart_Checkout': t => ['Cart', 'Coupons', 'Checkout'].includes(t['Parent Module']),
    '06_Payments': t => t['Parent Module'] === 'Payments',
    '07_Orders_Tracking': t => ['Orders', 'Tracking'].includes(t['Parent Module']),
    '08_Delivery': t => t['Parent Module'].startsWith('Delivery'),
    '09_Admin': t => t['Parent Module'].startsWith('Admin'),
    '10_Notifications': t => t['Parent Module'] === 'Notifications',
    '11_Offline_Lifecycle': t => ['Offline', 'Lifecycle', 'Permissions'].includes(t['Parent Module']),
    '12_Backend_Security': t => ['Backend Auth', 'Backend Cart', 'Backend Orders', 'Backend Payments', 'Backend Delivery', 'Security'].includes(t['Parent Module']),
    '13_E2E_Journeys': t => t['Parent Module'] === 'E2E Journey',
    '14_Edge_Cases': t => t['Parent Module'] === 'Edge Cases',
  };

  Object.entries(moduleSheets).forEach(([sheetName, filter]) => {
    const data = allTests.filter(filter);
    if (data.length > 0) {
      const ws = XLSX.utils.json_to_sheet(data, { header: MASTER_COLUMNS });
      ws['!cols'] = MASTER_COLUMNS.map(col => ({ wch: col === 'Detailed Steps' ? 50 : 20 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
  });

  // ── Sheet: Release Dashboard ──
  const dashboardData = [
    ['Vyapara Setu — Release Dashboard'],
    [''],
    ['Metric', 'Value', 'Formula'],
    ['Total Tests', allTests.length, ''],
    ['Executed', 0, 'COUNT(Status<>"Not Executed")'],
    ['Passed', 0, 'COUNTIF(Status,"Pass")'],
    ['Failed', 0, 'COUNTIF(Status,"Fail")'],
    ['Blocked', 0, 'COUNTIF(Status,"Blocked")'],
    ['Not Executed', allTests.length, 'COUNTIF(Status,"Not Executed")'],
    [''],
    ['Priority', 'Total', 'Passed', 'Failed'],
    ['P0 (Critical)', allTests.filter(t => t['Test Priority'] === 'P0').length, 0, 0],
    ['P1 (High)', allTests.filter(t => t['Test Priority'] === 'P1').length, 0, 0],
    ['P2 (Medium)', allTests.filter(t => t['Test Priority'] === 'P2').length, 0, 0],
    [''],
    ['Completion %', '0%', '=(Passed/Total)*100'],
    ['Production Readiness %', '0%', '=(P0_Passed/P0_Total)*100'],
    ['Release Status', 'NOT STARTED', ''],
    ['Go/No-Go', 'PENDING', 'All P0 pass + no critical bugs open'],
  ];
  const wsDash = XLSX.utils.aoa_to_sheet(dashboardData);
  wsDash['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wsDash, '15_Release_Dashboard');

  // ── Sheet: Bug Tracker ──
  const bugHeaders = [
    'Bug ID', 'Severity', 'Priority', 'Module', 'Environment', 'Test Number',
    'Summary', 'Steps to Reproduce', 'Expected', 'Actual',
    'Logs', 'Screenshots', 'Video', 'Developer', 'Status',
    'Root Cause', 'Fix Version', 'Release Version', 'Retest Status',
    'Regression Impact', 'Resolution Date'
  ];
  const wsBug = XLSX.utils.aoa_to_sheet([bugHeaders]);
  wsBug['!cols'] = bugHeaders.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, wsBug, '16_Bug_Tracker');

  // ── Sheet: Test Metrics ──
  const metricsData = [
    ['Test Metrics Summary'],
    [''],
    ['Module', 'Total', 'Pass', 'Fail', 'Blocked', 'Pass Rate %', 'Risk Level'],
  ];
  Object.entries(moduleCounts).forEach(([mod, counts]) => {
    metricsData.push([mod, counts.total, 0, 0, 0, '0%', counts.Critical > 3 ? 'HIGH' : 'MEDIUM']);
  });
  const wsMetrics = XLSX.utils.aoa_to_sheet(metricsData);
  wsMetrics['!cols'] = [{ wch: 25 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, wsMetrics, '17_Test_Metrics');

  // Write file
  const outPath = path.join(__dirname, 'VYAPARA_SETU_QA_WORKBOOK.xlsx');
  XLSX.writeFile(wb, outPath);
  console.log(`✅ Workbook generated: ${outPath}`);
  console.log(`   Sheets: ${wb.SheetNames.length}`);
  console.log(`   Total test cases: ${allTests.length}`);
  console.log(`   Modules covered: ${Object.keys(moduleCounts).length}`);

  // Print summary
  console.log('\n── Module Breakdown ──');
  Object.entries(moduleCounts)
    .sort((a, b) => b[1].total - a[1].total)
    .forEach(([mod, c]) => {
      console.log(`  ${mod.padEnd(25)} ${String(c.total).padStart(4)} tests`);
    });
}

generateWorkbook();


// ═══════════════════════════════════════════════════════════════════
// ADDITIONAL GRANULAR TESTS — PHASE 2 EXPANSION
// ═══════════════════════════════════════════════════════════════════
// This expands the workbook to cover every button, every state, every
// permission path, every error variant at atomic level.

function generateExpandedTests() {
  const tests = []; const P = 'EXP';
  const s = (m, sub, feat, subFeat, opts) => tests.push(tc(P, m, sub, feat, subFeat, opts));

  // ── Auth Expanded ──
  s('Authentication', 'Login', 'Keyboard', 'Keyboard dismisses on tap outside', { steps: '1. Focus phone input 2. Tap outside', expected: 'Keyboard dismisses' });
  s('Authentication', 'Login', 'Paste', 'Paste phone number works', { steps: '1. Copy number 2. Long press input 3. Paste', expected: 'Number pasted correctly' });
  s('Authentication', 'OTP', 'Auto-dismiss', 'Keyboard auto-opens on OTP screen', { steps: '1. Navigate to OTP 2. Observe keyboard', expected: 'Keyboard opens, cursor in first OTP field' });
  s('Authentication', 'OTP', 'Backspace', 'Backspace moves to previous field', { steps: '1. On OTP field 3 2. Press backspace', expected: 'Cursor moves to field 2' });
  s('Authentication', 'Login', 'Background', 'App backgrounded on Login→resume', { steps: '1. On Login 2. Background 3. Resume', expected: 'Login screen still shown, no crash' });
  s('Authentication', 'Signup', 'Duplicate email', 'Same phone different name', { api: 'POST /auth/send-otp', steps: '1. Registered phone 2. Different name', expected: 'Error: phone already exists' });
  s('Authentication', 'Google', 'Button', 'Google Sign-In button visible', { component: 'GoogleSignInButton', steps: '1. Open Login 2. Check Google button', expected: 'Google Sign-In button rendered' });
  s('Authentication', 'Google', 'Success', 'Google auth → Onboarding if new', { steps: '1. Tap Google Sign-In 2. Select account', expected: 'New user → Onboarding; existing → Home' });
  s('Authentication', 'Google', 'Cancel', 'Cancel Google auth', { steps: '1. Tap Google 2. Cancel on Google screen', expected: 'Return to Login, no error' });

  // ── Cart Expanded ──
  s('Cart', 'UI', 'Swipe Delete', 'Swipe to delete item', { steps: '1. Swipe left on cart item', expected: 'Delete option revealed' });
  s('Cart', 'UI', 'Image', 'Product image in cart', { steps: '1. Check cart item image', expected: 'Correct product thumbnail shown' });
  s('Cart', 'Price', 'Discount Applied', 'Discounted price shown in cart', { steps: '1. Product on sale 2. Check cart price', expected: 'Sale price shown, not original' });
  s('Cart', 'Navigation', 'Continue Shopping', 'Back to browse from empty cart', { steps: '1. Empty cart 2. Tap "Browse Products"', expected: 'Navigate to Home or Categories' });
  s('Cart', 'Realtime', 'Price change notification', 'Backend price change while in cart', { socket: 'product:update', steps: '1. Items in cart 2. Admin changes price', expected: 'Cart total updates or warning shown' });
  s('Cart', 'Validation', 'Exceed stock', 'Cannot add more than stock allows', { steps: '1. Stock=5 2. Try qty=10', expected: 'Error: only 5 available' });

  // ── Checkout Expanded ──
  s('Checkout', 'Address', 'Edit from checkout', 'Edit address in checkout flow', { steps: '1. Checkout 2. Edit address inline', expected: 'Address editable without leaving checkout' });
  s('Checkout', 'Address', 'Unserviceable area', 'Selected address not serviceable', { steps: '1. Address in non-delivery area 2. Checkout', expected: 'Warning: not serviceable, change address' });
  s('Checkout', 'Coupon', 'Apply from checkout', 'Apply coupon on checkout screen', { steps: '1. Enter coupon code on checkout', expected: 'Discount applied to summary' });
  s('Checkout', 'Coupon', 'Remove on checkout', 'Remove coupon from checkout', { steps: '1. Applied coupon 2. Remove', expected: 'Original total restored' });
  s('Checkout', 'Summary', 'Tax breakdown', 'Tax amount shown if applicable', { steps: '1. Check tax line in summary', expected: 'Tax shown or included in price' });
  s('Checkout', 'Navigation', 'Back to cart', 'Back button returns to cart', { steps: '1. On checkout 2. Tap back', expected: 'Return to cart, items preserved' });
  s('Checkout', 'Validation', 'Empty address field', 'Address missing city', { steps: '1. Address without city 2. Checkout', expected: 'Validation error shown' });
  s('Checkout', 'Loading', 'Long API response', 'Slow order creation', { steps: '1. Place order 2. API takes 10s', expected: 'Loading persists, no timeout error' });

  // ── Payment Expanded ──
  s('Payments', 'Razorpay', 'Back from SDK', 'User presses back in Razorpay', { steps: '1. Razorpay opens 2. Press back', expected: 'Return to checkout, payment not processed' });
  s('Payments', 'Razorpay', 'Multiple methods', 'Switch UPI→Card→UPI', { steps: '1. Open Razorpay 2. Select UPI 3. Switch to Card 4. Switch back', expected: 'No glitch, payment proceeds with final choice' });
  s('Payments', 'COD', 'Limit', 'COD amount limit check', { steps: '1. Order ₹10000 2. Select COD', expected: 'COD allowed or limit warning' });
  s('Payments', 'Status', 'Polling interval', 'Status polls at correct interval', { steps: '1. After payment 2. Monitor network', expected: 'Polls every 3-5 seconds until PAID/FAILED' });
  s('Payments', 'Webhook', 'Delayed webhook', 'Webhook arrives 30 min late', { steps: '1. Payment completes 2. Webhook delayed 30m', expected: 'Stuck-payment scanner catches it, reconciles' });
  s('Payments', 'Reconciliation', 'Scanner', 'Stuck payment scanner runs', { bgTask: 'stuckPaymentScanner', steps: '1. Payment pending 30+ min', expected: 'Scanner reconciles with Razorpay API' });

  // ── Orders Expanded ──
  s('Orders', 'List', 'Pull Refresh', 'Pull-to-refresh orders', { steps: '1. Pull down on orders list', expected: 'List refreshes with latest data' });
  s('Orders', 'Detail', 'Status Timeline', 'All statuses in timeline', { steps: '1. Delivered order 2. Check timeline', expected: 'CREATED→CONFIRMED→PACKED→IN_TRANSIT→DELIVERED shown' });
  s('Orders', 'Detail', 'Reorder', 'Items from past order', { steps: '1. Delivered order 2. Check if reorder CTA exists', expected: 'Reorder/add items back to cart option' });
  s('Orders', 'Cancel', 'Confirmation', 'Cancel confirmation dialog', { steps: '1. Tap Cancel 2. Observe dialog', expected: 'Confirmation with reason selection' });
  s('Orders', 'Refund', 'Status', 'Refund status tracking', { steps: '1. Cancelled order 2. Check refund status', expected: 'Refund status (initiated/processing/completed)' });

  // ── Delivery Expanded ──
  s('Delivery Flow', 'UI', 'StateCard transitions', 'Card changes on status change', { component: 'StateCard', steps: '1. Accept order 2. Observe card change', expected: 'Card transitions from NEW_ORDER to ACTIVE_DELIVERY' });
  s('Delivery Flow', 'UI', 'StickyPanel actions', 'Sticky panel shows correct action', { component: 'StickyCurrentOrderPanel', steps: '1. Each delivery state 2. Check panel', expected: 'Button label matches: Confirm Pickup/Start/Mark Arrived/Enter OTP' });
  s('Delivery Flow', 'Idempotency', 'Double pickup tap', 'Tap pickup twice', { steps: '1. Tap Confirm Pickup rapidly twice', expected: 'Only one API call via idempotency key' });
  s('Delivery Flow', 'Idempotency', 'Double OTP verify', 'Submit OTP twice', { steps: '1. Tap Verify OTP twice', expected: 'Single verification, no error' });
  s('Delivery Flow', 'Timer', 'OTP resend timer', 'Resend disabled until timer', { steps: '1. Delivery OTP screen 2. Check resend', expected: 'Timer countdown, resend disabled' });
  s('Delivery Flow', 'COD', 'Amount display', 'COD amount shown correctly', { steps: '1. COD order 2. Check collection amount', expected: 'Correct order total shown for collection' });
  s('Delivery Flow', 'COD', 'UPI mode', 'COD via UPI collection', { steps: '1. Select UPI mode for COD 2. Enter ref', expected: 'UPI reference recorded' });
  s('Delivery Flow', 'Maps', 'Navigation launch', 'External maps opens', { steps: '1. Tap Navigate on route', expected: 'Google Maps/Apple Maps opens with destination' });
  s('Delivery GPS', 'GPS', 'Accuracy', 'Low accuracy warning', { steps: '1. Indoors with poor GPS', expected: 'Accuracy below threshold shown' });
  s('Delivery GPS', 'GPS', 'Offline queue', 'Location queued offline', { offline: 'LOCATION_UPDATE', steps: '1. Offline 2. Move 3. Reconnect', expected: 'Buffered locations sent on reconnect' });

  // ── Admin Expanded ──
  s('Admin Products', 'Products', 'Image Upload', 'Product image upload', { steps: '1. Create product 2. Upload image', expected: 'Image uploaded to Cloudinary, URL saved' });
  s('Admin Products', 'Products', 'Validation', 'Missing price rejected', { steps: '1. Create product without price 2. Save', expected: 'Validation error: price required' });
  s('Admin Products', 'Products', 'Stock', 'Set stock quantity', { steps: '1. Edit product 2. Set stock=50 3. Save', expected: 'Stock updated, reflected in customer app' });
  s('Admin Products', 'Products', 'Category', 'Assign category', { steps: '1. Create/edit product 2. Select category', expected: 'Category assigned, product appears in that category' });
  s('Admin Orders', 'Orders', 'Filter', 'Filter by status', { steps: '1. Filter CREATED orders', expected: 'Only CREATED orders shown' });
  s('Admin Orders', 'Orders', 'Search', 'Search by order ID', { steps: '1. Enter order ID in search', expected: 'Matching order found' });
  s('Admin Delivery', 'KYC', 'Documents', 'View KYC documents', { steps: '1. Open KYC review 2. View documents', expected: 'Documents render via signed Cloudinary URLs' });
  s('Admin Delivery', 'KYC', 'Rejection Reason', 'Provide rejection reason', { steps: '1. Reject KYC 2. Enter reason', expected: 'Reason saved, shown to rider' });

  // ── Notifications Expanded ──
  s('Notifications', 'Push', 'Order Confirmed', 'Push on order confirmation', { notification: 'ORDER_CONFIRMED', steps: '1. Admin confirms order', expected: 'Customer receives push' });
  s('Notifications', 'Push', 'Order Packed', 'Push on pack', { notification: 'ORDER_PACKED', steps: '1. Admin packs order', expected: 'Push received' });
  s('Notifications', 'Push', 'Out for Delivery', 'Push on dispatch', { notification: 'OUT_FOR_DELIVERY', steps: '1. Rider starts delivery', expected: 'Push: "Your order is out for delivery"' });
  s('Notifications', 'Push', 'Delivered', 'Push on delivery', { notification: 'ORDER_DELIVERED', steps: '1. Rider delivers', expected: 'Push: "Your order has been delivered"' });
  s('Notifications', 'Push', 'Cancelled', 'Push on cancellation', { notification: 'ORDER_CANCELLED', steps: '1. Order cancelled', expected: 'Cancellation push received' });
  s('Notifications', 'In-App', 'Category Filter', 'Filter by category', { steps: '1. Filter notifications by "order"', expected: 'Only order notifications shown' });
  s('Notifications', 'In-App', 'Pagination', 'Scroll loads more', { steps: '1. Many notifications 2. Scroll', expected: 'Cursor-based pagination loads more' });
  s('Notifications', 'Badge', 'Count', 'Unread count decrements', { steps: '1. 5 unread 2. Read one 3. Check', expected: 'Badge shows 4' });

  // ── Socket/Realtime Expanded ──
  s('Sockets', 'Connection', 'Initial', 'Socket connects on login', { socket: 'connect', steps: '1. Login 2. Monitor socket', expected: 'Socket.io connection established' });
  s('Sockets', 'Connection', 'Reconnect', 'Auto-reconnect after disconnect', { socket: 'reconnect', steps: '1. Disconnect (airplane mode briefly)', expected: 'Socket reconnects automatically' });
  s('Sockets', 'Tracking', 'Location Update', 'Rider location event', { socket: 'order:location-update', steps: '1. Customer tracks 2. Rider moves', expected: 'Location event received, map updates' });
  s('Sockets', 'Product', 'Stock Update', 'Product stock event', { socket: 'product:update', steps: '1. On product detail 2. Admin changes stock', expected: 'Stock badge updates live' });
  s('Sockets', 'Delivery', 'Order Assigned', 'New assignment event', { socket: 'delivery:new-order', steps: '1. Rider online 2. Admin assigns', expected: 'New order card appears' });
  s('Sockets', 'Delivery', 'Reassignment', 'Order removed event', { socket: 'delivery:order-removed', steps: '1. Admin reassigns order', expected: 'Order removed from rider list' });

  // ── Background Tasks ──
  s('Background', 'Location', 'Task Registration', 'Background task registered', { bgTask: 'backgroundLocationTask', steps: '1. Delivery starts route', expected: 'expo-task-manager task registered' });
  s('Background', 'Location', 'Periodic Updates', 'Updates in background', { steps: '1. Start route 2. Background app 3. Wait 30s', expected: 'Location updates continue' });
  s('Background', 'Location', 'Task Stops', 'Task stops on route end', { steps: '1. Delivery complete 2. Check tasks', expected: 'Background task unregistered' });
  s('Background', 'Payment', 'Stuck Scanner', 'Pending payment recovery', { bgTask: 'stuckPaymentScanner', steps: '1. Payment stuck 30min+', expected: 'Scanner reconciles with gateway' });
  s('Background', 'Outbox', 'Dispatcher', 'Outbox events dispatched', { bgTask: 'outboxDispatcher', collection: 'outboxevents', steps: '1. Order event created 2. Wait', expected: 'Event dispatched (notification/webhook)' });

  // ── Performance ──
  s('Performance', 'Startup', 'Cold Start', 'App cold start time', { minutes: 3, steps: '1. Kill app 2. Measure time to interactive', expected: '< 3 seconds to interactive' });
  s('Performance', 'Startup', 'Warm Start', 'App warm start time', { steps: '1. Background 2. Measure resume time', expected: '< 1 second to interactive' });
  s('Performance', 'Scroll', 'Products List', 'Smooth scroll 60fps', { steps: '1. 100+ products 2. Scroll fast', expected: 'No jank, 60fps scroll' });
  s('Performance', 'Scroll', 'Orders List', 'Smooth order list scroll', { steps: '1. 50+ orders 2. Scroll', expected: 'Smooth scrolling' });
  s('Performance', 'Memory', 'No Leaks', 'Memory stable during use', { steps: '1. Navigate 10 screens 2. Check memory', expected: 'Memory does not grow unbounded' });
  s('Performance', 'Network', 'Payload Size', 'API payloads reasonable', { steps: '1. Monitor response sizes', expected: 'Product list < 100KB, no over-fetching' });
  s('Performance', 'Images', 'Lazy Load', 'Images load on scroll', { component: 'SmartImage', steps: '1. Scroll products 2. Check image loading', expected: 'Images lazy-load, not all at once' });

  // ── Hidden/Debug Surfaces ──
  s('Hidden', 'Debug', 'NetworkDiagnostic', 'Not reachable in prod', { screen: 'NetworkDiagnostic', steps: '1. Prod build 2. Try all nav paths', expected: 'Debug screen not accessible' });
  s('Hidden', 'Debug', 'OrderTracking.DEBUG', 'Debug variant unused', { steps: '1. Check OrderTracking imports', expected: 'DEBUG variant not in prod bundle' });
  s('Hidden', 'Dev', 'Simulator', 'Driver simulator disabled', { steps: '1. Prod build 2. Check for simulator UI', expected: 'No simulator toggles/screens in prod' });
  s('Hidden', 'Dev', 'Scripts', 'Test scripts not bundled', { steps: '1. Check bundle for src/scripts/', expected: 'Scripts excluded from production build' });

  return tests;
}
