# Phase 12: Strength/ROM Parity Audit Report

**Generated:** 2026-02-22
**Purpose:** Document Strength/ROM consistency across compose, batch, and realistic patch modes before engine modifications.

## Methodology

For each of 7 TX-supported body parts (mid visit count ~10-12):
1. **Compose mode**: `initialState` omits `tightness/tenderness/spasm` (engine defaults from pain)
2. **Batch mode**: `initialState` includes `tightness/tenderness/spasm` as `painCurrent >= 7 ? 3 : 2`
3. **Realistic patch**: Same as compose but applies `patchSOAPText()` post-processing

Same seed used across all 3 modes per body part. Strength/ROM values extracted from visit #5 (mid-course).

## Legend

- ✅ Compose and Batch produce identical Strength/ROM values
- ❌ Compose and Batch diverge on Strength/ROM values
- Realistic Patch column shows post-processed values (expected to differ from raw)

## LBP (seed: 200001, pain: 8, tx: 10, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 5/5, 4+/5 | 5/5, 4+/5 | 4/5, 4-/5, 4+/5 |
| ROM | 85 Degrees(normal), 30 Degrees(normal), 40 Degrees(mild), 45 Degrees(normal) | 85 Degrees(normal), 30 Degrees(normal), 40 Degrees(mild), 45 Degrees(normal) | 70 Degrees(mild), 25 Degrees(mild), 40 Degrees(mild), 30 Degrees(normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Muscles Testing:
Tightness muscles noted along iliocostalis, spinalis, longissimus
Grading Scale: Moderate

Tenderness muscle noted along Iliopsoas Muscle, Quadratus Lumborum, Gluteal Muscles, The Multifidus muscles

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along spinalis, longissimus, Gluteal Muscles, The Multifidus muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Lumbar Muscles Strength and Spine ROM
5/5 Flexion: 85 Degrees(normal)
4+/5 Extension: 30 Degrees(normal)
4+/5 Rotation to Right: 40 Degrees(mild)
5/5 Rotation to Left: 45 Degrees(normal)
5/5 Flexion to the Right: 30 Degrees(normal)
4+/5 Flexion to the Left: 30 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Muscles Testing:
Tightness muscles noted along iliocostalis, spinalis, longissimus
Grading Scale: Moderate

Tenderness muscle noted along Iliopsoas Muscle, Quadratus Lumborum, Gluteal Muscles, The Multifidus muscles

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along spinalis, longissimus, Gluteal Muscles, The Multifidus muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Lumbar Muscles Strength and Spine ROM
5/5 Flexion: 85 Degrees(normal)
4+/5 Extension: 30 Degrees(normal)
4+/5 Rotation to Right: 40 Degrees(mild)
5/5 Rotation to Left: 45 Degrees(normal)
5/5 Flexion to the Right: 30 Degrees(normal)
4+/5 Flexion to the Left: 30 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Muscles Testing:
Tightness muscles noted along iliocostalis, spinalis, longissimus
Grading Scale: Moderate

Tenderness muscle noted along Iliopsoas Muscle, Quadratus Lumborum, Gluteal Muscles, The Multifidus muscles

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along spinalis, longissimus, Gluteal Muscles, The Multifidus muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Lumbar Muscles Strength and Spine ROM
4/5 Flexion: 70 Degrees(mild)
4-/5 Extension: 25 Degrees(mild)
4/5 Rotation to Right: 40 Degrees(mild)
4-/5 Rotation to Left: 40 Degrees(mild)
4/5 Flexion to the Right: 30 Degrees(normal)
4+/5 Flexion to the Left: 30 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```
</details>

## SHOULDER (seed: 200002, pain: 7, tx: 12, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 4+/5, 5/5 | 4+/5, 5/5 | 4-/5, 4/5 |
| ROM | 140 degree(moderate), 130 degree(moderate), 50 Degrees(mild), 75 Degrees(mild) | 140 degree(moderate), 130 degree(moderate), 50 Degrees(mild), 75 Degrees(mild) | 110 degree(moderate), 45 Degrees(mild), 65 Degrees(mild), 40 degree (normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Inspection:weak muscles and dry skin without luster

Muscles Testing:
Tightness muscles noted along upper trapezius, rhomboids, middle deltoid
Grading Scale: Moderate

Tenderness muscles noted along deltoid ant fibres, bicep long head, supraspinatus, triceps short head

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along AC joint, levator scapula, rhomboids, middle deltoid
Frequency Grading Scale:(+2)=Occasional spontaneous spasms and easily induced spasms.

Left Shoulder Muscles Strength and Joint ROM
4+/5 Abduction:140 degree(moderate)
5/5 Horizontal Adduction: 45 degree (normal)
4+/5 Flexion :130 degree(moderate)
5/5 Extension : 50 Degrees(mild)
5/5 External rotation : 75 Degrees(mild)
4+/5 Internal rotation : 75 Degrees(mild)

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Inspection:weak muscles and dry skin without luster

Muscles Testing:
Tightness muscles noted along upper trapezius, rhomboids, middle deltoid
Grading Scale: Moderate

Tenderness muscles noted along deltoid ant fibres, bicep long head, supraspinatus, triceps short head

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along AC joint, levator scapula, rhomboids, middle deltoid
Frequency Grading Scale:(+2)=Occasional spontaneous spasms and easily induced spasms.

Left Shoulder Muscles Strength and Joint ROM
4+/5 Abduction:140 degree(moderate)
5/5 Horizontal Adduction: 45 degree (normal)
4+/5 Flexion :130 degree(moderate)
5/5 Extension : 50 Degrees(mild)
5/5 External rotation : 75 Degrees(mild)
4+/5 Internal rotation : 75 Degrees(mild)

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Inspection:weak muscles and dry skin without luster

Muscles Testing:
Tightness muscles noted along upper trapezius, rhomboids, middle deltoid
Grading Scale: Moderate

Tenderness muscles noted along deltoid ant fibres, bicep long head, supraspinatus, triceps short head

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along AC joint, levator scapula, rhomboids, middle deltoid
Frequency Grading Scale:(+2)=Occasional spontaneous spasms and easily induced spasms.

Left Shoulder Muscles Strength and Joint ROM
4-/5 Abduction:110 degree(moderate)
4/5 Horizontal Adduction: 40 degree (normal)
4-/5 Flexion :110 degree(moderate)
4-/5 Extension : 45 Degrees(mild)
4/5 External rotation : 65 Degrees(mild)
4/5 Internal rotation : 65 Degrees(mild)

tongue
thin white coat
pulse
string-taut
```
</details>

## KNEE (seed: 200003, pain: 9, tx: 10, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 4+/5, 5/5 | 4+/5, 5/5 | 4+/5 |
| ROM | 100 Degrees(moderate), 0(normal) | 100 Degrees(moderate), 0(normal) | 80 Degrees(moderate), 0(normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Muscles Testing:
Tightness muscles noted along Hamstrings muscle group, Gluteus Maximus, Gluteus medius / minimus
Grading Scale: Moderate

Tenderness muscle noted along Gastronemius muscle, Hamstrings muscle group, Tibialis Post/ Anterior, Plantar Fasciitis, Intrinsic Foot Muscle group

Tenderness Scale: (+2) = There is mild tenderness with grimace and flinch to moderate palpation.

Muscles spasm noted along Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB, Rectus Femoris
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Right Knee Muscles Strength and Joint ROM:

4+/5 Flexion(fully bent): 100 Degrees(moderate)
5/5 Extension(fully straight): 0(normal)

Inspection: joint swelling

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Muscles Testing:
Tightness muscles noted along Hamstrings muscle group, Gluteus Maximus, Gluteus medius / minimus
Grading Scale: Moderate

Tenderness muscle noted along Gastronemius muscle, Hamstrings muscle group, Tibialis Post/ Anterior, Plantar Fasciitis, Intrinsic Foot Muscle group

Tenderness Scale: (+2) = There is mild tenderness with grimace and flinch to moderate palpation.

Muscles spasm noted along Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB, Rectus Femoris
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Right Knee Muscles Strength and Joint ROM:

4+/5 Flexion(fully bent): 100 Degrees(moderate)
5/5 Extension(fully straight): 0(normal)

Inspection: joint swelling

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Muscles Testing:
Tightness muscles noted along Hamstrings muscle group, Gluteus Maximus, Gluteus medius / minimus
Grading Scale: Moderate

Tenderness muscle noted along Gastronemius muscle, Hamstrings muscle group, Tibialis Post/ Anterior, Plantar Fasciitis, Intrinsic Foot Muscle group

Tenderness Scale: (+2) = There is mild tenderness with grimace and flinch to moderate palpation.

Muscles spasm noted along Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB, Rectus Femoris
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Right Knee Muscles Strength and Joint ROM:

4+/5 Flexion(fully bent): 80 Degrees(moderate)
4+/5 Extension(fully straight): 0(normal)

Inspection: joint swelling

tongue
thin white coat
pulse
string-taut
```
</details>

## NECK (seed: 200004, pain: 6, tx: 10, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 5/5 | 5/5 | 4+/5 |
| ROM | 60 Degrees(normal), 50 Degrees(normal), 80 Degrees(normal), 45 Degrees(normal) | 60 Degrees(normal), 50 Degrees(normal), 80 Degrees(normal), 45 Degrees(normal) | 55 Degrees(normal), 50 Degrees(normal), 70 Degrees(mild), 45 Degrees(normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Muscles Testing:
Tightness muscles noted along Scalene anterior / med / posterior, Levator Scapulae, Trapezius
Grading Scale: Moderate

Tenderness muscles noted along sternocleidomastoid muscles, Semispinalis capitis, Splenius capitis, Suboccipital muscles

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Levator Scapulae, Trapezius, Splenius capitis, Suboccipital muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Cervical Muscles Strength and Spine ROM Assessment:
5/5 Extension (look up): 60 Degrees(normal)
5/5 Flexion (look down): 50 Degrees(normal)
5/5 Rotation to Right (look to right): 80 Degrees(normal)
5/5 Rotation to Left (look to left): 80 Degrees(normal)
5/5 Flexion to the Right (bending right): 45 Degrees(normal)
5/5 Flexion to the Left (bending left): 45 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Muscles Testing:
Tightness muscles noted along Scalene anterior / med / posterior, Levator Scapulae, Trapezius
Grading Scale: Moderate

Tenderness muscles noted along sternocleidomastoid muscles, Semispinalis capitis, Splenius capitis, Suboccipital muscles

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Levator Scapulae, Trapezius, Splenius capitis, Suboccipital muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Cervical Muscles Strength and Spine ROM Assessment:
5/5 Extension (look up): 60 Degrees(normal)
5/5 Flexion (look down): 50 Degrees(normal)
5/5 Rotation to Right (look to right): 80 Degrees(normal)
5/5 Rotation to Left (look to left): 80 Degrees(normal)
5/5 Flexion to the Right (bending right): 45 Degrees(normal)
5/5 Flexion to the Left (bending left): 45 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Muscles Testing:
Tightness muscles noted along Scalene anterior / med / posterior, Levator Scapulae, Trapezius
Grading Scale: Moderate

Tenderness muscles noted along sternocleidomastoid muscles, Semispinalis capitis, Splenius capitis, Suboccipital muscles

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Levator Scapulae, Trapezius, Splenius capitis, Suboccipital muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Cervical Muscles Strength and Spine ROM Assessment:
4+/5 Extension (look up): 55 Degrees(normal)
4+/5 Flexion (look down): 50 Degrees(normal)
4+/5 Rotation to Right (look to right): 70 Degrees(mild)
4+/5 Rotation to Left (look to left): 70 Degrees(mild)
4+/5 Flexion to the Right (bending right): 45 Degrees(normal)
4+/5 Flexion to the Left (bending left): 45 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```
</details>

## ELBOW (seed: 200005, pain: 5, tx: 10, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 5/5 | 5/5 | 4+/5 |
| ROM | 150 degree(normal), 0 degree(normal), 90 degree(normal) | 150 degree(normal), 0 degree(normal), 90 degree(normal) | 150 degree(normal), 0 degree(normal), 85 degree(normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Muscles Testing:
Tightness muscles noted along Biceps, Triceps, Brachioradialis
Grading Scale: Mild

Tenderness muscles noted along Brachioradialis, Supinator, Pronator teres

Grading Scale: (+1)=Patient states that the area is mildly tender-annoying.

Muscles spasm noted along Triceps, Brachioradialis, Supinator
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Left Elbow Muscles Strength and Joint ROM
5/5 Flexion: 150 degree(normal)
5/5 Extension: 0 degree(normal)
5/5 Supination: 90 degree(normal)
5/5 Pronation: 90 degree(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Muscles Testing:
Tightness muscles noted along Biceps, Triceps, Brachioradialis
Grading Scale: Mild

Tenderness muscles noted along Brachioradialis, Supinator, Pronator teres

Grading Scale: (+1)=Patient states that the area is mildly tender-annoying.

Muscles spasm noted along Triceps, Brachioradialis, Supinator
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Left Elbow Muscles Strength and Joint ROM
5/5 Flexion: 150 degree(normal)
5/5 Extension: 0 degree(normal)
5/5 Supination: 90 degree(normal)
5/5 Pronation: 90 degree(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Muscles Testing:
Tightness muscles noted along Biceps, Triceps, Brachioradialis
Grading Scale: Mild

Tenderness muscles noted along Brachioradialis, Supinator, Pronator teres

Grading Scale: (+1)=Patient states that the area is mildly tender-annoying.

Muscles spasm noted along Triceps, Brachioradialis, Supinator
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Left Elbow Muscles Strength and Joint ROM
4+/5 Flexion: 150 degree(normal)
4+/5 Extension: 0 degree(normal)
4+/5 Supination: 85 degree(normal)
4+/5 Pronation: 85 degree(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```
</details>

## MID_LOW_BACK (seed: 200006, pain: 7, tx: 10, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 5/5, 4+/5 | 5/5, 4+/5 | 4/5, 4-/5, 4+/5 |
| ROM | 90 Degrees(normal), 30 Degrees(normal), 45 Degrees(normal) | 90 Degrees(normal), 30 Degrees(normal), 45 Degrees(normal) | 80 Degrees(mild), 30 Degrees(normal), 45 Degrees(normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Muscles Testing:
Tightness muscles noted along iliocostalis, spinalis, longissimus
Grading Scale: Moderate

Tenderness muscle noted along Rhomboids, Middle Trapezius, Erector Spinae, Latissimus Dorsi, Serratus Posterior

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Iliopsoas Muscle, Quadratus Lumborum, Gluteal Muscles, The Multifidus muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Thoracolumbar Muscles Strength and Spine ROM
5/5 Flexion: 90 Degrees(normal)
4+/5 Extension: 30 Degrees(normal)
5/5 Rotation to Right: 45 Degrees(normal)
5/5 Rotation to Left: 45 Degrees(normal)
5/5 Flexion to the Right: 30 Degrees(normal)
5/5 Flexion to the Left: 30 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Muscles Testing:
Tightness muscles noted along iliocostalis, spinalis, longissimus
Grading Scale: Moderate

Tenderness muscle noted along Rhomboids, Middle Trapezius, Erector Spinae, Latissimus Dorsi, Serratus Posterior

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Iliopsoas Muscle, Quadratus Lumborum, Gluteal Muscles, The Multifidus muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Thoracolumbar Muscles Strength and Spine ROM
5/5 Flexion: 90 Degrees(normal)
4+/5 Extension: 30 Degrees(normal)
5/5 Rotation to Right: 45 Degrees(normal)
5/5 Rotation to Left: 45 Degrees(normal)
5/5 Flexion to the Right: 30 Degrees(normal)
5/5 Flexion to the Left: 30 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Muscles Testing:
Tightness muscles noted along iliocostalis, spinalis, longissimus
Grading Scale: Moderate

Tenderness muscle noted along Rhomboids, Middle Trapezius, Erector Spinae, Latissimus Dorsi, Serratus Posterior

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Iliopsoas Muscle, Quadratus Lumborum, Gluteal Muscles, The Multifidus muscles
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Thoracolumbar Muscles Strength and Spine ROM
4/5 Flexion: 80 Degrees(mild)
4-/5 Extension: 30 Degrees(normal)
4/5 Rotation to Right: 45 Degrees(normal)
4/5 Rotation to Left: 45 Degrees(normal)
4+/5 Flexion to the Right: 30 Degrees(normal)
4+/5 Flexion to the Left: 30 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```
</details>

## MIDDLE_BACK (seed: 200007, pain: 6, tx: 12, visit #5)

**Parity:** ✅

| Metric | Compose | Batch | Realistic Patch |
|--------|---------|-------|-----------------|
| Strength | 5/5, 4+/5 | 5/5, 4+/5 | 4/5, 4-/5 |
| ROM | 90 Degrees(normal), 30 Degrees(normal), 45 Degrees(normal) | 90 Degrees(normal), 30 Degrees(normal), 45 Degrees(normal) | 80 Degrees(mild), 30 Degrees(normal), 45 Degrees(normal) |

<details><summary>Full Objective comparison</summary>

**Compose Objective:**
```
Muscles Testing:
Tightness muscles noted along Rhomboids, Middle Trapezius, Erector Spinae
Grading Scale: Moderate

Tenderness muscles noted along Latissimus Dorsi, Serratus Posterior, Multifidus

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Erector Spinae, Latissimus Dorsi, Serratus Posterior
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Bilateral Middle back Muscles Strength and Spine ROM
5/5 Flexion: 90 Degrees(normal)
4+/5 Extension: 30 Degrees(normal)
4+/5 Rotation to Right: 45 Degrees(normal)
5/5 Rotation to Left: 45 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Batch Objective:**
```
Muscles Testing:
Tightness muscles noted along Rhomboids, Middle Trapezius, Erector Spinae
Grading Scale: Moderate

Tenderness muscles noted along Latissimus Dorsi, Serratus Posterior, Multifidus

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Erector Spinae, Latissimus Dorsi, Serratus Posterior
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Bilateral Middle back Muscles Strength and Spine ROM
5/5 Flexion: 90 Degrees(normal)
4+/5 Extension: 30 Degrees(normal)
4+/5 Rotation to Right: 45 Degrees(normal)
5/5 Rotation to Left: 45 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```

**Realistic Patch Objective:**
```
Muscles Testing:
Tightness muscles noted along Rhomboids, Middle Trapezius, Erector Spinae
Grading Scale: Moderate

Tenderness muscles noted along Latissimus Dorsi, Serratus Posterior, Multifidus

Grading Scale: (+2) = Patient states that the area is moderately tender.

Muscles spasm noted along Erector Spinae, Latissimus Dorsi, Serratus Posterior
Frequency Grading Scale:(+1)=No spontaneous spasms; vigorous sensory and motor stimulation results in spasms.

Thoracic Muscles Strength and Spine ROM
4/5 Flexion: 80 Degrees(mild)
4-/5 Extension: 30 Degrees(normal)
4/5 Rotation to Right: 45 Degrees(normal)
4/5 Rotation to Left: 45 Degrees(normal)

Inspection: weak muscles and dry skin without luster

tongue
thin white coat
pulse
string-taut
```
</details>

## Summary

- **Consistent (compose = batch):** 7/7
- **Inconsistent (compose ≠ batch):** 0/7

### Known Parity Gaps (from RESEARCH.md)

| Field | Compose | Batch | Impact |
|-------|---------|-------|--------|
| `initialState.tightness` | MISSING (engine defaults from pain) | `painCurrent >= 7 ? 3 : 2` | Different tightness grading in early visits |
| `initialState.tenderness` | MISSING (engine defaults from pain) | `painCurrent >= 7 ? 3 : 2` | Different tenderness grading in early visits |
| `initialState.spasm` | MISSING (engine defaults from pain) | `painCurrent >= 7 ? 3 : 2` | Different spasm grading in early visits |
| `localPattern` | User form selection | `inferLocalPatterns()` result | Different Assessment TCM diagnosis |
| `systemicPattern` | User form selection | `inferSystemicPatterns()` result | Different Assessment TCM diagnosis |

### Realistic Patch Impact

The `patchSOAPText()` post-processor modifies Strength/ROM values using a steeper ROM limit curve and lower base strength grades. This is expected to produce different values from raw compose/batch output. The patch is applied identically regardless of compose vs batch origin.
