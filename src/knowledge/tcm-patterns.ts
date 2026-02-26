/**
 * 中医证型知识库
 * 来源: AC Knowledge.csv
 */

import type { TCMPattern } from "../types";

export const TCM_PATTERNS: Record<string, TCMPattern> = {
  "Qi Stagnation": {
    name: "Qi Stagnation",
    chineseName: "气滞证",
    type: "local",
    tongue: ["normal or slightly purple edges", "thin white coat"],
    tongueChineseName: "舌质正常或边缘略紫，薄白苔",
    pulse: ["wiry", "string-taut"],
    pulseChineseName: "弦脉",
    treatmentPrinciples: [
      "moving qi",
      "regulates qi",
      "dredging channel and activating collaterals",
    ],
    mainSymptoms: ["distending pain", "pain moves around", "emotional stress"],
  },
  "Blood Stasis": {
    name: "Blood Stasis",
    chineseName: "血瘀证",
    type: "local",
    tongue: ["purple", "dark purple", "petechiae", "ecchymosis"],
    tongueChineseName: "紫舌或暗紫舌，有瘀点瘀斑",
    pulse: ["choppy", "hesitant"],
    pulseChineseName: "涩脉",
    treatmentPrinciples: [
      "activating Blood circulation to dissipate blood stagnant",
      "promote circulation, relieves pain",
    ],
    mainSymptoms: ["fixed stabbing pain", "worse at night", "dark complexion"],
  },
  "Qi Stagnation, Blood Stasis": {
    name: "Qi Stagnation, Blood Stasis",
    chineseName: "气滞血瘀证",
    type: "local",
    tongue: ["purple or dark", "thin white coat", "purple spots"],
    tongueChineseName: "紫暗舌或有瘀斑，薄白苔",
    pulse: ["wiry", "choppy"],
    pulseChineseName: "弦涩脉",
    treatmentPrinciples: [
      "promote circulation, relieves pain",
      "moving qi",
      "activating Blood circulation to dissipate blood stagnant",
    ],
    mainSymptoms: [
      "fixed pain with distension",
      "worse with pressure",
      "emotional stress worsens",
    ],
  },
  "Liver Qi Stagnation": {
    name: "Liver Qi Stagnation",
    chineseName: "肝气郁结证",
    type: "local",
    tongue: ["normal or slightly red", "thin white or thin yellow coat"],
    tongueChineseName: "舌质正常或略红，薄白苔或薄黄苔",
    pulse: ["wiry"],
    pulseChineseName: "弦脉",
    treatmentPrinciples: ["moving qi", "regulates qi", "soothing liver qi"],
    mainSymptoms: ["hypochondriac pain", "emotional changes", "sighing"],
  },
  "Blood Deficiency": {
    name: "Blood Deficiency",
    chineseName: "血虚证",
    type: "local",
    tongue: ["pale", "thin body", "thin dry coat"],
    tongueChineseName: "淡白舌，舌体瘦薄，薄干苔",
    pulse: ["thready", "weak"],
    pulseChineseName: "细弱脉",
    treatmentPrinciples: [
      "nourishing blood",
      "activate blood and relax tendons",
    ],
    mainSymptoms: ["dull pain", "numbness", "pale complexion"],
  },
  "Qi & Blood Deficiency": {
    name: "Qi & Blood Deficiency",
    chineseName: "气血两虚证",
    type: "local",
    tongue: ["pale", "thin white coat"],
    tongueChineseName: "淡白舌，薄白苔",
    pulse: ["thready", "weak"],
    pulseChineseName: "细弱脉或弱脉",
    treatmentPrinciples: [
      "tonifying qi and blood",
      "strengthening muscles and bone",
    ],
    mainSymptoms: [
      "fatigue",
      "dizziness",
      "pale complexion",
      "shortness of breath",
    ],
  },
  "Wind-Cold Invasion": {
    name: "Wind-Cold Invasion",
    chineseName: "风寒侵袭证",
    type: "local",
    tongue: ["pale", "thin white coat"],
    tongueChineseName: "淡舌，薄白苔",
    pulse: ["floating", "tight"],
    pulseChineseName: "浮紧脉",
    treatmentPrinciples: [
      "expelling pathogens",
      "dispelling cold",
      "dredging channel and activating collaterals",
    ],
    mainSymptoms: ["aversion to cold", "pain worse with cold", "stiffness"],
  },
  "Cold-Damp + Wind-Cold": {
    name: "Cold-Damp + Wind-Cold",
    chineseName: "寒湿+风寒证",
    type: "local",
    tongue: ["pale", "swollen", "thick white greasy coat"],
    tongueChineseName: "淡胖舌，厚白腻苔",
    pulse: ["deep", "slow", "soggy"],
    pulseChineseName: "沉迟脉或濡脉",
    treatmentPrinciples: [
      "dispelling cold, drain the dampness",
      "expelling pathogens",
    ],
    mainSymptoms: ["heavy sensation", "cold pain", "worse in damp weather"],
  },
  "LV/GB Damp-Heat": {
    name: "LV/GB Damp-Heat",
    chineseName: "肝胆湿热证",
    type: "local",
    tongue: ["red", "yellow greasy coat"],
    tongueChineseName: "红舌，黄腻苔",
    pulse: ["wiry", "rapid"],
    pulseChineseName: "弦数脉",
    treatmentPrinciples: [
      "clear heat",
      "dispelling the flame",
      "clear damp-heat",
    ],
    mainSymptoms: ["bitter taste", "yellow urine", "irritability"],
  },
  "Phlegm-Damp": {
    name: "Phlegm-Damp",
    chineseName: "痰湿证",
    type: "local",
    tongue: ["pale", "swollen", "thick white greasy coat"],
    tongueChineseName: "淡胖舌，厚白腻苔",
    pulse: ["slippery", "soggy"],
    pulseChineseName: "滑脉或濡脉",
    treatmentPrinciples: [
      "drain the dampness",
      "resolve stagnation",
      "dredging channel and activating collaterals",
    ],
    mainSymptoms: ["heavy sensation", "numbness", "swelling"],
  },
  "Phlegm-Heat": {
    name: "Phlegm-Heat",
    chineseName: "痰热证",
    type: "local",
    tongue: ["red", "yellow greasy coat"],
    tongueChineseName: "红舌，黄腻苔",
    pulse: ["slippery", "rapid"],
    pulseChineseName: "滑数脉",
    treatmentPrinciples: ["resolve stagnation, clears heat", "clear heat"],
    mainSymptoms: ["burning sensation", "swelling", "redness"],
  },
  "Damp-Heat": {
    name: "Damp-Heat",
    chineseName: "湿热证",
    type: "local",
    tongue: ["red", "yellow greasy coat"],
    tongueChineseName: "红舌，黄腻苔",
    pulse: ["slippery", "rapid", "soggy"],
    pulseChineseName: "滑数脉或濡数脉",
    treatmentPrinciples: [
      "clear damp-heat",
      "drain the dampness",
      "clear heat",
    ],
    mainSymptoms: ["burning pain", "swelling", "redness", "heavy sensation"],
  },
  "Kidney Yang Deficiency": {
    name: "Kidney Yang Deficiency",
    chineseName: "肾阳虚证",
    type: "systemic",
    tongue: ["pale", "swollen", "teeth marks", "white moist coat"],
    tongueChineseName: "淡胖舌，有齿痕，白润苔",
    pulse: ["deep", "slow", "weak"],
    pulseChineseName: "沉迟无力脉",
    treatmentPrinciples: [
      "warming kidney yang",
      "strengthening muscles and bone",
    ],
    mainSymptoms: [
      "cold limbs",
      "fatigue",
      "frequent urination",
      "low back pain",
    ],
  },
  "Kidney Yin Deficiency": {
    name: "Kidney Yin Deficiency",
    chineseName: "肾阴虚证",
    type: "systemic",
    tongue: ["red", "little or no coat", "cracks"],
    tongueChineseName: "红舌，少苔或无苔，有裂纹",
    pulse: ["thready", "rapid"],
    pulseChineseName: "细数脉",
    treatmentPrinciples: ["nourishing kidney yin"],
    mainSymptoms: ["night sweats", "hot flashes", "dry mouth", "tinnitus"],
  },
  "Kidney Qi Deficiency": {
    name: "Kidney Qi Deficiency",
    chineseName: "肾气虚证",
    type: "systemic",
    tongue: ["pale", "thin white coat"],
    tongueChineseName: "淡舌，薄白苔",
    pulse: ["deep", "weak"],
    pulseChineseName: "沉弱脉",
    treatmentPrinciples: ["tonifying kidney qi"],
    mainSymptoms: ["fatigue", "low back weakness", "frequent urination"],
  },
  "Kidney Essence Deficiency": {
    name: "Kidney Essence Deficiency",
    chineseName: "肾精亏虚证",
    type: "systemic",
    tongue: ["pale or red", "thin coat"],
    tongueChineseName: "淡舌或红舌，薄苔",
    pulse: ["thready", "weak"],
    pulseChineseName: "细弱脉",
    treatmentPrinciples: ["nourishing kidney essence"],
    mainSymptoms: ["premature aging", "memory decline", "hair loss"],
  },
  "Qi Deficiency": {
    name: "Qi Deficiency",
    chineseName: "气虚证",
    type: "systemic",
    tongue: ["pale", "swollen", "teeth marks", "thin white coat"],
    tongueChineseName: "淡胖舌，有齿痕，薄白苔",
    pulse: ["weak", "soft"],
    pulseChineseName: "弱脉或濡脉",
    treatmentPrinciples: ["tonifying qi"],
    mainSymptoms: ["fatigue", "shortness of breath", "spontaneous sweating"],
  },
  "Spleen Deficiency": {
    name: "Spleen Deficiency",
    chineseName: "脾虚证",
    type: "systemic",
    tongue: ["pale", "swollen", "teeth marks", "white greasy coat"],
    tongueChineseName: "淡胖舌，有齿痕，白腻苔",
    pulse: ["weak", "soggy"],
    pulseChineseName: "弱濡脉",
    treatmentPrinciples: ["strengthening spleen"],
    mainSymptoms: ["poor appetite", "loose stool", "fatigue", "bloating"],
  },
  "Liver Yang Rising": {
    name: "Liver Yang Rising",
    chineseName: "肝阳上亢证",
    type: "systemic",
    tongue: ["red", "thin yellow coat"],
    tongueChineseName: "红舌，薄黄苔",
    pulse: ["wiry", "rapid", "forceful"],
    pulseChineseName: "弦数有力脉",
    treatmentPrinciples: ["calming liver yang"],
    mainSymptoms: ["headache", "dizziness", "irritability", "red face"],
  },
  "Yin Deficiency Fire": {
    name: "Yin Deficiency Fire",
    chineseName: "阴虚火旺证",
    type: "systemic",
    tongue: ["red", "little coat", "cracks"],
    tongueChineseName: "红舌，少苔，有裂纹",
    pulse: ["thready", "rapid"],
    pulseChineseName: "细数脉",
    treatmentPrinciples: ["nourishing yin", "clearing deficiency fire"],
    mainSymptoms: ["night sweats", "hot flashes", "dry mouth", "insomnia"],
  },
  "LU & KI Deficiency": {
    name: "LU & KI Deficiency",
    chineseName: "肺肾两虚证",
    type: "systemic",
    tongue: ["pale", "thin white coat"],
    tongueChineseName: "淡舌，薄白苔",
    pulse: ["deep", "weak"],
    pulseChineseName: "沉弱脉",
    treatmentPrinciples: ["tonifying lung and kidney", "nourishing kidney qi"],
    mainSymptoms: [
      "shortness of breath",
      "chronic cough",
      "low back weakness",
      "fatigue",
    ],
  },
  "LV/GB Fire": {
    name: "LV/GB Fire",
    chineseName: "肝胆火旺证",
    type: "systemic",
    tongue: ["red", "yellow coat"],
    tongueChineseName: "红舌，黄苔",
    pulse: ["wiry", "rapid"],
    pulseChineseName: "弦数脉",
    treatmentPrinciples: ["clearing liver fire", "dispelling the flame"],
    mainSymptoms: ["headache", "bitter taste", "irritability", "red eyes"],
  },
  "ST & Intestine Damp-Heat": {
    name: "ST & Intestine Damp-Heat",
    chineseName: "胃肠湿热证",
    type: "systemic",
    tongue: ["red", "yellow sticky coat"],
    tongueChineseName: "红舌，黄腻苔",
    pulse: ["rolling", "rapid"],
    pulseChineseName: "滑数脉",
    treatmentPrinciples: [
      "clear damp-heat",
      "regulating stomach and intestines",
    ],
    mainSymptoms: [
      "abdominal pain",
      "diarrhea",
      "burning sensation",
      "foul stool",
    ],
  },
  "Stomach Heat": {
    name: "Stomach Heat",
    chineseName: "胃热证",
    type: "systemic",
    tongue: ["red", "yellow dry coat"],
    tongueChineseName: "红舌，黄燥苔",
    pulse: ["rapid", "forceful"],
    pulseChineseName: "数有力脉",
    treatmentPrinciples: ["clearing stomach heat"],
    mainSymptoms: ["excessive hunger", "bad breath", "thirst", "gum swelling"],
  },
  "Food Retention": {
    name: "Food Retention",
    chineseName: "食积证",
    type: "systemic",
    tongue: ["thick greasy coat"],
    tongueChineseName: "厚腻苔",
    pulse: ["rolling", "slippery"],
    pulseChineseName: "滑脉",
    treatmentPrinciples: ["promoting digestion", "resolving food stagnation"],
    mainSymptoms: ["bloating", "belching", "acid reflux", "loss of appetite"],
  },
  "Wei Qi Deficiency": {
    name: "Wei Qi Deficiency",
    chineseName: "卫气虚证",
    type: "systemic",
    tongue: ["pale"],
    tongueChineseName: "淡舌",
    pulse: ["weak", "floating"],
    pulseChineseName: "浮弱脉",
    treatmentPrinciples: ["tonifying wei qi", "consolidating exterior"],
    mainSymptoms: [
      "frequent colds",
      "spontaneous sweating",
      "aversion to wind",
    ],
  },
  "Ying & Wei Disharmony": {
    name: "Ying & Wei Disharmony",
    chineseName: "营卫不和证",
    type: "systemic",
    tongue: ["thin white coat"],
    tongueChineseName: "薄白苔",
    pulse: ["floating", "moderate"],
    pulseChineseName: "浮缓脉",
    treatmentPrinciples: ["harmonizing ying and wei"],
    mainSymptoms: [
      "alternating chills and fever",
      "spontaneous sweating",
      "aversion to wind",
    ],
  },
  "LU Wind-Heat": {
    name: "LU Wind-Heat",
    chineseName: "肺经风热证",
    type: "systemic",
    tongue: ["red tip", "thin yellow coat"],
    tongueChineseName: "舌尖红，薄黄苔",
    pulse: ["floating", "rapid"],
    pulseChineseName: "浮数脉",
    treatmentPrinciples: ["dispelling wind-heat", "ventilating lung qi"],
    mainSymptoms: ["sore throat", "fever", "cough", "yellow nasal discharge"],
  },
  "Excessive Heat Flaring": {
    name: "Excessive Heat Flaring",
    chineseName: "实热炽盛证",
    type: "systemic",
    tongue: ["red", "dry"],
    tongueChineseName: "红舌，干燥",
    pulse: ["rapid", "forceful"],
    pulseChineseName: "数有力脉",
    treatmentPrinciples: ["clearing heat", "purging fire"],
    mainSymptoms: ["high fever", "thirst", "red face", "restlessness"],
  },
};

// 获取所有局部证型
export function getLocalPatterns(): TCMPattern[] {
  return Object.values(TCM_PATTERNS).filter((p) => p.type === "local");
}

// 获取所有整体证型
export function getSystemicPatterns(): TCMPattern[] {
  return Object.values(TCM_PATTERNS).filter((p) => p.type === "systemic");
}

// 验证舌象是否匹配证型
export function isTongueMatchPattern(
  tongue: string,
  patternName: string,
): boolean {
  const pattern = TCM_PATTERNS[patternName];
  if (!pattern) return false;

  const tongueLower = tongue.toLowerCase();
  return pattern.tongue.some((t) => tongueLower.includes(t.toLowerCase()));
}

// 验证脉象是否匹配证型
export function isPulseMatchPattern(
  pulse: string,
  patternName: string,
): boolean {
  const pattern = TCM_PATTERNS[patternName];
  if (!pattern) return false;

  const pulseLower = pulse.toLowerCase();
  return pattern.pulse.some((p) => pulseLower.includes(p.toLowerCase()));
}

// 获取证型的治疗原则
export function getTreatmentPrinciples(patternName: string): string[] {
  return TCM_PATTERNS[patternName]?.treatmentPrinciples ?? [];
}
