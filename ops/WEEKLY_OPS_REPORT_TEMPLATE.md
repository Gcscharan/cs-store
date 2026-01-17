# Weekly Ops Report Template

**Week:** [YYYY-MM-DD to YYYY-MM-DD]  
**Prepared by:** [Name/Role]  
**Review date:** [YYYY-MM-DD]

---

## 1) Incident Summary

### Totals
- Total incidents: [number]
- New incidents: [number]
- Recurring incidents: [number]

### Breakdown by Type
- TRACKING_STALE: [count]
- ETA_DRIFT: [count]
- SLA_BREACH_RISK: [count]
- KILLSWITCH_TRIGGERED: [count]

### Breakdown by Severity
- CRITICAL: [count]
- WARNING: [count]
- INFO: [count]

### Top 3 Most Frequent Patterns
1. [Pattern 1] – [brief cause]
2. [Pattern 2] – [brief cause]
3. [Pattern 3] – [brief cause]

---

## 2) Time Metrics

- **MTTA (Mean Time to Acknowledge):** [value] (target: <X minutes)
- **MTTR (Mean Time to Resolve):** [value] (target: <Y minutes)
- **Longest incident duration:** [value] – [incident ID, brief why]

### Trend Notes
- [e.g., MTTA improved by 15% due to clearer alerting]
- [e.g., MTTR increased due to [reason]]

---

## 3) SLA Health

### SLA Breach Risks Detected
- Count: [number]
- Prevented by kill-switch: [yes/no]
- Correlation to incidents: [brief]

### SLA Breaches Prevented
- Count: [number]
- Mechanism: [kill-switch / manual intervention / luck]

### Actual SLA Misses
- Count: [number]
- Incident IDs: [list]
- Customer impact: [brief]

---

## 4) Kill Switch Activity

- **Activations:** [count]
- **Total duration:** [minutes/hours]
- **Reason quality:** Good / Weak / Mixed
- **Was playbook followed?** Yes / Partially / No

### Notes
- [e.g., Activation on [date] due to [reason]; playbook followed; recovery clean]

---

## 5) Learning Signals (Phase 7, Advisory Only)

### Repeated Patterns Observed
- [Pattern 1] – frequency: [X times], suspected cause: [brief]
- [Pattern 2] – frequency: [Y times], suspected cause: [brief]

### False Positives
- Count: [number]
- Most common false positive: [type]
- Suspected cause: [tuning / data quality / transient]

### Threshold Sensitivity Issues
- Candidates for config-only tuning:
  - [Threshold name] – current: [value] – suggested: [value] – reason: [brief]

### Recommendations Requiring Human Review
- [Recommendation 1] – requires: [e.g., policy review / schedule adjustment]
- [Recommendation 2] – requires: [e.g., kill-switch criteria refinement]

---

## 6) Actions (Allowed Only)

### Documentation Updates Needed
- [ ] Update [playbook/doc name] – reason: [brief]
- [ ] Add metric/dashboard link to [section]

### Playbook Clarifications
- [ ] Clarify “How to confirm” for [scenario]
- [ ] Add “What NOT to do” for [scenario]

### Threshold Adjustments (Config-Only)
- [ ] Adjust [threshold] from [old] to [new] – rollback plan: [brief]

### Other
- [ ] [Other allowed action]

---

## 7) Quality Bar Check

- [ ] Every incident can be explained clearly in 3–5 bullets
- [ ] No “mystery” incidents remain
- [ ] All actions above are allowed under freeze (docs/config/playbooks only)

---

## 8) Next Week Focus

- [ ] [Focus area 1]
- [ ] [Focus area 2]
- [ ] [Focus area 3]

---

## 9) Attachments / Links

- Metrics dashboard: [link]
- Incident log: [link]
- Kill-switch event log: [link]
- Phase 7 insights: [link]

---

## 10) Review Sign-off

**Reviewed by:** [Name/Role]  
**Approved:** Yes / No (reason if No)
