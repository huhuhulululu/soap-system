# Template Chain Binding Audit

- Total recognized fields: 35
- Bound by rule chain: 26
- Excluded fixed/policy fields: 9
- Missing binding: 0

## Field Status

| Field | Dropdown Count | In Conditions | In Effects | Status |
|---|---:|---:|---:|---|
| assessment.generalCondition | 5 | no | yes | OK |
| assessment.tcmDiagnosis.localPattern | 8 | yes | yes | OK |
| assessment.tcmDiagnosis.systemicPattern | 8 | yes | yes | OK |
| assessment.treatmentPrinciples.focusOn | 13 | no | yes | OK |
| objective.muscleTesting.muscles | 23 | no | yes | OK |
| objective.muscleTesting.tenderness.gradingScale | 8 | no | yes | OK |
| objective.muscleTesting.tightness.gradingScale | 7 | no | yes | OK |
| objective.rom.degrees | 32 | no | no | EXCLUDED |
| objective.rom.strength | 33 | no | no | EXCLUDED |
| objective.tonguePulse.pulse | 20 | no | yes | OK |
| objective.tonguePulse.tongue | 39 | no | yes | OK |
| plan.evaluationType | 8 | no | no | EXCLUDED |
| plan.needleProtocol.electricalStimulation | 43 | no | no | EXCLUDED |
| plan.needleProtocol.points | 60 | no | yes | OK |
| plan.needleProtocol.totalTime | 14 | no | no | EXCLUDED |
| plan.shortTermGoal.treatmentFrequency | 8 | no | yes | OK |
| subjective.adlDifficulty.activities | 34 | yes | yes | OK |
| subjective.adlDifficulty.level | 32 | no | yes | OK |
| subjective.associatedSymptoms | 29 | no | yes | OK |
| subjective.causativeFactors | 8 | no | yes | OK |
| subjective.chronicityLevel | 7 | yes | no | OK |
| subjective.exacerbatingFactors | 8 | no | yes | OK |
| subjective.painFrequency | 13 | no | yes | OK |
| subjective.painRadiation | 11 | no | no | EXCLUDED |
| subjective.painScale | 9 | no | no | EXCLUDED |
| subjective.painScale.best | 8 | no | no | EXCLUDED |
| subjective.painScale.current | 24 | yes | no | OK |
| subjective.painScale.worst | 8 | no | no | EXCLUDED |
| subjective.painTypes | 13 | no | yes | OK |
| subjective.reason | 5 | no | yes | OK |
| subjective.reasonConnector | 5 | no | yes | OK |
| subjective.relievingFactors | 8 | no | yes | OK |
| subjective.symptomChange | 5 | yes | no | OK |
| subjective.symptomDuration.unit | 16 | no | yes | OK |
| subjective.symptomDuration.value | 71 | no | yes | OK |
