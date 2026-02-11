/**
 * 从 soap-generator.ts 提取格式规范
 * 基准 1: 静态文本 + 动态插值
 */
import * as fs from 'fs'

const format = {
  subjective: {
    staticText: [
      "Patient c/o",
      "pain",
      "area which is",
      "The patient has been complaining of the pain for",
      "which got worse in recent",
      "The pain is associated with",
      "There is",
      "difficulty with ADLs like",
      "Pain Scale:",
      "Pain Frequency:"
    ],
    dynamicFields: [
      "chronicityLevel",
      "laterality",
      "bodyPart",
      "painTypes",
      "radiation",
      "duration",
      "associatedSymptom",
      "severityLevel",
      "adlList",
      "painScale (Worst/Best/Current)",
      "painFrequency"
    ]
  },
  objective: {
    staticText: [
      "Muscles Testing:",
      "Tightness muscles noted along",
      "Grading Scale:",
      "Tenderness muscle noted along",
      "Tenderness Scale:",
      "Muscles spasm noted along",
      "Frequency Grading Scale:",
      "Muscles Strength and Joint ROM:",
      "Flexion",
      "Extension",
      "Inspection:"
    ],
    dynamicFields: [
      "tightnessMuscles",
      "tightnessGrading",
      "tendernessMuscles", 
      "tendernessScale",
      "spasmMuscles",
      "spasmScale",
      "romValues",
      "strengthValues",
      "inspection"
    ]
  },
  assessment: {
    staticText: [
      "TCM Dx:",
      "pain due to",
      "in local meridian, but patient also has",
      "in the general",
      "Today's TCM treatment principles:",
      "on",
      "and harmonize",
      "balance in order to"
    ],
    dynamicFields: [
      "laterality",
      "bodyPart",
      "localPattern",
      "systemicPattern",
      "treatmentFocus",
      "treatmentAction",
      "harmonizeTarget",
      "treatmentGoal"
    ]
  },
  plan: {
    ie: {
      staticText: [
        "Initial Evaluation",
        "Personal one on one contact with the patient",
        "Short Term Goal",
        "RELIEF TREATMENT FREQUENCY:",
        "treatments in",
        "weeks",
        "Decrease Pain Scale to",
        "Long Term Goal",
        "ADDITIONAL MAINTENANCE & SUPPORTING TREATMENTS FREQUENCY:"
      ]
    },
    tx: {
      staticText: [
        "Acupuncture treatment was done today",
        "Acupoints:",
        "Electrical stimulation",
        "Treatment time:",
        "minutes"
      ],
      dynamicFields: [
        "laterality",
        "bodyPart",
        "acupoints",
        "electricalStimulation",
        "treatmentTime"
      ]
    }
  }
}

const outputDir = 'src/auditor/baselines'
fs.mkdirSync(outputDir, { recursive: true })
fs.writeFileSync(
  `${outputDir}/generator-format.json`,
  JSON.stringify(format, null, 2)
)

console.log('Generator 格式提取完成')
