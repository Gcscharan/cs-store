# AI QA Testing System

Autonomous AI-powered quality assurance system for the VyaparSetu platform. This is NOT just scripted tests - it's an intelligent QA agent that discovers workflows, executes flows, validates outcomes, detects regressions, and generates actionable reports automatically.

## 🎯 Objective

Build a reusable autonomous AI QA platform that:
- Discovers flows automatically
- Executes flows automatically
- Validates outcomes with AI
- Detects regressions
- Generates actionable reports

## 📁 Structure

```
qa/
├── engine/              # Core testing engines
│   ├── QAEngine.mjs           # Playwright wrapper with MCP integration
│   ├── WorkflowDiscovery.mjs  # Auto-discover screens, buttons, actions
│   ├── AIValidator.mjs         # Ollama integration for screen analysis
│   ├── ConsoleMonitor.mjs      # Detect crashes, red screens, API failures
│   └── Reporter.mjs            # Generate detailed markdown reports
├── agents/              # Specialized workflow agents
│   └── DeliveryAgent.mjs       # Complete delivery flow testing
├── flows/               # Workflow definitions (auto-generated)
├── reports/             # Test reports (markdown + JSON)
├── screenshots/         # Screenshots from tests
├── traces/              # Execution traces
├── datasets/            # Discovered workflows, test data
├── prompts/             # AI prompts for validation
├── results/             # JSON test results
└── run-qa.mjs           # Main entry point
```

## 🚀 Quick Start

### Prerequisites

```bash
# Ensure frontend is running on port 3000
cd frontend && npm run dev

# Optional: Install Ollama for AI-powered validation
brew install ollama
ollama pull llama3.2
ollama serve
```

### Run Tests

```bash
# Run delivery workflow test (highest priority)
npm run qa:delivery

# Run with AI validation (requires Ollama)
npm run qa:delivery:ai

# Run workflow discovery
npm run qa:discover

# Run full test suite
npm run qa:full

# Run full test with AI validation
npm run qa:full:ai
```

## 📊 Available Commands

| Command | Description | AI Support |
|---------|-------------|------------|
| `npm run qa` | Show help | - |
| `npm run qa:delivery` | Test delivery workflow | ❌ |
| `npm run qa:delivery:ai` | Test delivery workflow with AI | ✅ |
| `npm run qa:discover` | Discover all workflows | ❌ |
| `npm run qa:full` | Run full test suite | ❌ |
| `npm run qa:full:ai` | Run full test suite with AI | ✅ |
| `npm run qa:customer` | Test customer flows | ❌ |
| `npm run qa:admin` | Test admin flows | ❌ |
| `npm run qa:offline` | Test offline/reconnect | ❌ |
| `npm run qa:reconnect` | Test reconnection logic | ❌ |

## 🚚 Delivery Workflow Testing

The delivery workflow is the highest-risk flow for launch. The agent tests:

1. **Login** - Delivery partner authentication
2. **Go Online** - Availability toggle
3. **Accept Order** - Order assignment
4. **Pickup** - Mark order as picked up
5. **Start Delivery** - Begin navigation
6. **Mark Arrived** - Arrived at customer
7. **COD Cash** - Collect cash payment
8. **COD UPI** - Collect UPI payment
9. **Send OTP** - Send OTP to customer
10. **Resend OTP** - Resend OTP
11. **Verify OTP** - Verify customer OTP
12. **Delivered** - Mark order complete
13. **Earnings** - Verify earnings credited

### Run Delivery Test

```bash
npm run qa:delivery
```

### With AI Validation

```bash
npm run qa:delivery:ai
```

The AI will:
- Analyze each screen for correctness
- Detect UI bugs
- Identify broken functionality
- Provide health scores
- Suggest fixes

## 📊 Reports

### Test Reports

Generated in `qa/reports/`:
- `delivery-test-report.md` - Detailed markdown report
- `delivery-launch-readiness.md` - Launch readiness assessment
- `full-test-report.md` - Full suite results
- `full-launch-readiness.md` - Overall launch readiness

### JSON Results

Generated in `qa/results/`:
- `delivery-test.json` - Raw test data
- Console errors, network failures, screenshots

### Launch Readiness Score

The system generates a launch readiness score (0-100) based on:

- Authentication (0-10)
- Payments (0-10)
- Delivery (0-10)
- Offline (0-10)
- Sockets (0-10)
- Notifications (0-10)
- Location (0-10)
- Performance (0-10)
- Crash Risk (0-10)

**Score Interpretation:**
- **90-100**: ✅ Ready for Launch
- **70-89**: ⚠️ Launch with Caution
- **0-69**: ❌ Not Ready for Launch

## 🔍 Workflow Discovery

Automatically discovers:
- Screens
- Buttons
- Links
- Forms
- Inputs
- Headings
- Navigation paths

Generates `WORKFLOW_MAP.json` in `qa/datasets/`.

```bash
npm run qa:discover
```

## 🧠 AI Validation (Ollama)

When Ollama is available, the AI:
- Analyzes screen content
- Detects bugs and crashes
- Validates expected vs actual behavior
- Provides health scores
- Suggests fixes

### Setup Ollama

```bash
# Install
brew install ollama

# Pull model
ollama pull llama3.2

# Start server
ollama serve
```

## 📸 Screenshots

All tests automatically capture screenshots at each step:
- `qa/screenshots/` - Test screenshots
- Organized by test type and step

## 🔧 Console Monitoring

The system monitors:
- Console errors
- Page crashes
- API failures
- Network failures
- Unhandled promise rejections
- Retry storms
- Memory leaks

## 🎯 Flow Coverage

Tracks coverage of:
- AUTH FLOWS
- CUSTOMER FLOWS
- ADMIN FLOWS
- DELIVERY FLOWS
- PAYMENT FLOWS
- SOCKET FLOWS
- OFFLINE FLOWS
- RECONNECT FLOWS
- BACKGROUND FLOWS
- OTP FLOWS
- COD FLOWS
- EARNINGS FLOWS

## 🚨 Critical Issue Detection

The system automatically detects:
- Red screens (React error overlay)
- Infinite loops
- Retry storms
- Memory leaks
- API 500 errors
- API 401 loops
- Unhandled promise rejections
- Runtime crashes

## 📝 Example Output

```
🚚 DELIVERY WORKFLOW TEST
============================================================

📝 STEP 1: Login as Delivery Partner
────────────────────────────────────────────────────────────
✅ Login successful

🟢 STEP 2: Go Online
────────────────────────────────────────────────────────────
✅ Went online

📦 STEP 3: Accept Order
────────────────────────────────────────────────────────────
⚠️  No order available to accept (may need manual order creation)

============================================================
📊 Delivery Test Complete
============================================================
Success Rate: 83%
Health Score: 75/100
Failed Steps: 2
```

## 🔧 Configuration

### Environment Variables

```bash
# Delivery credentials (for testing)
DELIVERY_PHONE=9391795162
DELIVERY_PASSWORD=test123

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Ollama configuration
OLLAMA_HOST=http://localhost:11434
OLLAMA_MODEL=llama3.2
```

## 📈 Continuous Integration

Add to CI/CD pipeline:

```yaml
- name: Run QA Tests
  run: npm run qa:delivery:ai
  
- name: Check Launch Readiness
  run: |
    if [ $(cat qa/reports/full-launch-readiness.md | grep "Overall Score" | awk '{print $3}' | cut -d'/' -f1) -lt 70 ]; then
      echo "Not ready for launch"
      exit 1
    fi
```

## 🎓 Philosophy

This is NOT a traditional test suite. It's an autonomous AI agent that:

1. **Discovers** - Finds screens, buttons, flows automatically
2. **Executes** - Clicks through flows like a real user
3. **Validates** - Uses AI to understand if behavior is correct
4. **Detects** - Finds regressions, crashes, broken flows
5. **Reports** - Generates actionable insights and scores

The goal is to act like a QA engineer, continuously testing the app from login to delivery completion and reporting failures.

## 🚧 Roadmap

- [ ] Customer workflow testing
- [ ] Admin workflow testing
- [ ] Offline testing
- [ ] Reconnect testing
- [ ] Payment flow testing
- [ ] Socket event validation
- [ ] Network retry validation
- [ ] Performance regression detection
- [ ] Visual regression testing
- [ ] Mobile app testing

## 📞 Support

For issues or questions, check:
- Reports in `qa/reports/`
- Screenshots in `qa/screenshots/`
- Console logs in test output
