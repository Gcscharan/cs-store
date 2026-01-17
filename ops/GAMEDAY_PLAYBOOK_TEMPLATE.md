# Game Day Playbook Template

**Game Day:** [Scenario Name]  
**Date:** [YYYY-MM-DD]  
**Lead:** [Name/Role]  
**Participants:** [Names/Roles]  
**Environment:** [Non-Prod / Guarded Prod Window]

---

## 1) Scenario

**Chosen scenario:** [one of the monthly rotations]
- [ ] Tracking projection becomes stale
- [ ] ETA drift spikes artificially
- [ ] Redis latency increases
- [ ] Stream lag introduced
- [ ] Kill switch toggled intentionally

**Objective:** Validate detection, incident creation, playbook usability, escalation behavior, recovery, and no customer impact.

---

## 2) Pre-Game Day Checklist (24–48h before)

- [ ] Scenario script written (steps, expected outcomes)
- [ ] Environment ready (non-prod or guarded prod window approved)
- [ ] Participants briefed on objectives and freeze rules
- [ ] Rollback plan documented (how to revert scenario)
- [ ] Monitoring dashboards open and baselines captured
- [ ] Incident templates/playbooks at hand
- [ ] Communication channel ready (Slack/Teams)

---

## 3) Scenario Script

### Step-by-Step Execution

| Step | Action | Expected System Response | Validation |
|------|--------|--------------------------|------------|
| 1 | [e.g., Stop location sample ingestion for 15 minutes] | Projections become STALE/OFFLINE | Freshness state changes in dashboards |
| 2 | [e.g., Inject artificial ETA drift via config override] | ETA P90 widens beyond tolerance | ETA drift incident detected |
| 3 | [e.g., Add artificial Redis latency via proxy] | Incident detection may fire if thresholds breached | Check incident logs |
| 4 | [e.g., Pause stream processing for 5 minutes] | Stream lag increases; possible SLA breach risk | Verify SLA risk incident |
| 5 | [e.g., Toggle kill switch to INGEST_ONLY] | Kill-switch triggered incident created | Confirm incident attributes |
| 6 | [e.g., Restore normal conditions] | System recovers gracefully | No lingering side effects |

### Notes
- Keep each step short (5–15 minutes)
- Capture timestamps and observed metrics
- If something unexpected happens, pause and document before continuing

---

## 4) Validation Checklist

### Detection Fires Correctly
- [ ] Incident created with correct type
- [ ] Severity and scope are appropriate
- [ ] Incident includes clear evidence (what, when, why)

### Playbook Usability
- [ ] Ops can follow playbook without developer assistance
- [ ] “How to confirm” steps are unambiguous
- [ ] Required tools/links are accessible
- [ ] No ambiguous language or missing steps

### Escalation Behavior
- [ ] Escalation policies match (if applicable)
- [ ] No alert storming (deduplication/suppression works)
- [ ] Timeline entries are recorded correctly
- [ ] On-call targets resolved correctly (if schedules used)

### Recovery
- [ ] Recovery steps are clean and auditable
- [ ] No lingering side effects in Redis/metrics
- [ ] System returns to baseline behavior
- [ ] No customer impact (or safely contained)

### Documentation Gaps
- [ ] What worked well
- [ ] What was confusing
- [ ] What needs improvement in docs/playbooks
- [ ] Any threshold tuning candidates (config-only)

---

## 5) Rollback Plan

**Immediate rollback steps:**
1. [Step 1]
2. [Step 2]
3. [Step 3]

**Verification of rollback:**
- [ ] System metrics return to baseline
- [ ] No spurious incidents remain
- [ ] Admin dashboards consistent

---

## 6) Observations & Findings

### What Worked
- [ ] [Observation 1]
- [ ] [Observation 2]

### What Was Confusing
- [ ] [Issue 1]
- [ ] [Issue 2]

### Documentation/Playbook Improvements Needed
- [ ] Update [playbook/doc name] – reason: [brief]
- [ ] Add “What NOT to do” for [scenario]
- [ ] Clarify [ambiguous step]

### Threshold Tuning Candidates (Config-Only)
- [ ] [Threshold name] – current: [value] – suggested: [value] – reason: [brief]

---

## 7) Actions (Allowed Only)

- [ ] Create/update documentation: [title]
- [ ] Clarify playbook steps: [section]
- [ ] Propose config-only threshold adjustment: [details]
- [ ] Schedule follow-up review: [when]

---

## 8) Review Sign-off

**Game Day Result:** Success / Partial Success / Issues Identified  
**Lead:** [Name/Role] – [Date]  
**Reviewed by:** [Name/Role] – [Date]  
**Approved Actions:** Yes / No (reason if No)

---

## 9) Attachments / Links

- Scenario script: [link]
- Metrics screenshots: [link]
- Incident logs: [link]
- Rollback log: [link]
