import { generateContinuation } from '../frontend/src/services/generator.js'
import { parseOptumNote } from '../parsers/optum-note/parser.ts'

const text = `Subjective:
Follow up visit
Patient reports: there is improvement of symptom(s) because of more energy level throughout the day .
Patient still c/o Dull, Aching pain in bilateral knee area without radiation , associated with muscles soreness, heaviness (scale as 50%), impaired performing ADL's with moderate to severe difficulty Standing for long periods of time, Walking for long periods of time and moderate to severe difficulty Rising from a chair, Walking for long periods of time, bending knee to sit position.

Pain Scale: 6 /10
Pain frequency: Frequent (symptoms occur between 51% and 75% of the time)
Objective:Muscles Testing:
Tightness muscles noted along Gluteus Maximus, Quadratus femoris, Adductor longus/ brev/ magnus, Rectus Femoris, Gastronemius muscle, Plantar Fasciitis
Grading Scale: moderate

Tenderness muscle noted along Gluteus medius / minimus, Iliotibial Band ITB, Rectus Femoris, Gastronemius muscle, Hamstrings muscle group

Tenderness Scale: (+2) = There is mild tenderness with grimace and flinch to moderate palpation .

Muscles spasm noted along Quadratus femoris, Adductor longus/ brev/ magnus, Iliotibial Band ITB, Rectus Femoris
Frequency Grading Scale:(+3)=>1 but < 10 spontaneous spasms per hour.

Right Knee Muscles Strength and Joint ROM:

4-/5 Flexion(fully bent): 100 Degrees(moderate)
4-/5 Extension(fully straight): 0(normal)

Left Knee Muscles Strength and Joint ROM:

4-/5 Flexion(fully bent): 100 Degrees(moderate)
4-/5 Extension(fully straight): 0(normal)


Inspection: local skin no damage or rash


tongue
thick, white coat 
pulse
deep 
Assessment:
The patient continues treatment for in bilateral knee area today.
The patient's general condition is good, compared with last treatment, the patient presents with improvement of symptom(s). The patient has decreased muscles soreness sensation, heaviness sensation, physical finding has reduced local muscles tenderness. Patient tolerated acupuncture treatment with positive verbal response. No adverse side effect post treatment.
Current patient still has Cold-Damp + Wind-Cold in local meridian that cause the pain.
Plan:
Select Needle Size : 34#x1" ,30# x1.5",30# x2"
Daily acupuncture treatment for knee - Personal one on one contact with the patient (Total Operation Time: 60 mins)


Front Points: (30 mins) - personal one on one contact with the patient


1. Greeting patient, Review of the chart, Routine examination of the patient current condition, washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points, Initial Acupuncture needle inserted for right knee with electrical stimulation GB33, GB34, GB36   


2. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points, re-insertion of additional needles left knee without electrical stimulation SP9, XI YAN, HE DING, A SHI POINT  


Removing and properly disposing of needles 


Back Points (30 mins) - personal one on one contact with the patient


3. Explanation with patient for future treatment plan, washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points, re-insertion of additional needles right knee with electrical stimulation  BL40, BL57   


4. Washing hands, setting up the clean field, selecting acupuncture needle size, selecting location, marking and cleaning the points, re-insertion of additional needles left knee with electrical stimulation BL23, BL55, A SHI POINTS  


Removing and properly disposing of needles


Post treatment service and education patient about precautions at home after treatment.


Documentation 

Today's treatment principles:
focus on dispelling cold, drain the dampness to speed up the recovery, soothe the tendon.`

// 1. 先看 parser 能不能解析
console.log('=== Parser 测试 ===')
const parsed = parseOptumNote(text)
console.log('Success:', parsed.success)
console.log('Errors:', parsed.errors)
console.log('Warnings:', parsed.warnings?.length, 'warnings')
console.log('Visits:', parsed.document?.visits.length)

if (parsed.document) {
  for (const [i, v] of parsed.document.visits.entries()) {
    console.log(`\n--- Visit ${i} ---`)
    console.log('Type:', v.subjective.visitType)
    console.log('BodyPart:', v.subjective.bodyPartNormalized, '| Laterality:', v.subjective.laterality)
    console.log('Pain:', JSON.stringify(v.subjective.painScale))
    console.log('ADL Level:', v.subjective.adlDifficultyLevel)
    console.log('Tightness:', v.objective.tightnessMuscles.gradingScale, '| muscles:', v.objective.tightnessMuscles.muscles.length)
    console.log('Tenderness:', v.objective.tendernessMuscles.scale, '| muscles:', v.objective.tendernessMuscles.muscles.length)
    console.log('Spasm:', v.objective.spasmMuscles.frequencyScale)
    console.log('ROM items:', v.objective.rom.items.length)
    v.objective.rom.items.forEach(r => console.log(`  ${r.strength} ${r.movement}: ${r.degrees}°(${r.severity})`))
    console.log('Tongue:', v.objective.tonguePulse.tongue)
    console.log('Pulse:', v.objective.tonguePulse.pulse)
    console.log('Pattern:', v.assessment.currentPattern)
    console.log('LocalPattern:', v.assessment.localPattern)
    console.log('GeneralCond:', v.assessment.generalCondition)
    console.log('SymptomChange:', v.assessment.symptomChange)
    console.log('E-stim:', v.plan.electricalStimulation)
    console.log('TreatTime:', v.plan.treatmentTime)
    console.log('Acupoints:', v.plan.acupoints)
  }
}

// 2. 续写功能测试（预期报错：无 IE）
console.log('\n=== 续写功能测试 ===')
const r = generateContinuation(text, { insuranceType: 'OPTUM', treatmentTime: 60, generateCount: 2 })
if (r.error) {
  console.log('预期错误:', r.error)
} else {
  console.log('parseSummary:', JSON.stringify(r.parseSummary, null, 2))
  console.log('生成数量:', r.visits.length)
  for (const v of r.visits) {
    console.log(`\nTX${v.visitIndex} | Pain: ${v.state.painScaleCurrent} | Severity: ${v.state.severityLevel}`)
    console.log(v.text.substring(0, 200))
    console.log('...')
  }
}
