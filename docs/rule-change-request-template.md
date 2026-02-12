# 规则变更单模板（RCR）

```text
[rcr]
request_id: RCR-YYYYMMDD-01
from_version: R1
to_version: R1.1
requester: Rule Master
reason: <变更原因>

changes:
- type: add|modify|deprecate
  rule_id: X-000
  summary: <变更摘要>
  before: <旧规则/无>
  after: <新规则>
  impact_files: <path list>
  impact_tests: <test list>
  risk_level: critical|high|medium|low

compatibility:
- backward_compatible: yes|no
- migration_required: yes|no
- migration_steps: <步骤>

approval:
- checker_review: pending|approved|rejected
- auditor_review: pending|approved|rejected
- final_decision: pass|reject
```

