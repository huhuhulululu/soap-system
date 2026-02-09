/**
 * 仅基于模板动态字段的规则集
 * - condition.field 与 effect.targetField 必须来自模板下拉可解析字段
 * - effect.options 必须来自模板下拉候选
 */

import type { LogicRule } from './logic-rules'

export const TEMPLATE_ONLY_RULES: LogicRule[] = [
  {
    id: 'tpl_chronicity_chronic',
    name: '模板规则: 慢性病程偏好',
    description: 'Chronic 倾向 month/year 与 Dull/Aching',
    conditions: [
      { field: 'subjective.chronicityLevel', operator: 'equals', value: 'Chronic' }
    ],
    effects: [
      {
        targetField: 'subjective.symptomDuration.unit',
        options: ['month(s)', 'year(s)'],
        weightChange: 35,
        reason: '模板慢性病程常见月/年单位'
      },
      {
        targetField: 'subjective.painTypes',
        options: ['Dull', 'Aching'],
        weightChange: 20,
        reason: '模板慢性病程常见钝痛/酸痛'
      },
      {
        targetField: 'subjective.symptomDuration.value',
        options: ['more than 10', 'many'],
        weightChange: 30,
        reason: '模板慢性病程常见较长病程时长值'
      }
    ]
  },
  {
    id: 'tpl_chronicity_acute',
    name: '模板规则: 急性病程偏好',
    description: 'Acute 倾向 day/week 与 Stabbing/Shooting',
    conditions: [
      { field: 'subjective.chronicityLevel', operator: 'equals', value: 'Acute' }
    ],
    effects: [
      {
        targetField: 'subjective.symptomDuration.unit',
        options: ['day(s)', 'week(s)'],
        weightChange: 35,
        reason: '模板急性病程常见日/周单位'
      },
      {
        targetField: 'subjective.painTypes',
        options: ['Stabbing', 'Shooting'],
        weightChange: 20,
        reason: '模板急性病程常见刺痛/放射痛'
      },
      {
        targetField: 'subjective.symptomDuration.value',
        options: ['1', '2', '3', '4'],
        weightChange: 20,
        reason: '模板急性病程常见较短病程时长值'
      }
    ]
  },
  {
    id: 'tpl_pain_severe',
    name: '模板规则: 高疼痛评分',
    description: '疼痛评分 >= 8 倾向 severe',
    conditions: [
      { field: 'subjective.painScale.current', operator: 'gte', value: 8 }
    ],
    effects: [
      {
        targetField: 'subjective.adlDifficulty.level',
        options: ['severe', 'moderate to severe'],
        weightChange: 40,
        reason: '模板高疼痛对应高ADL困难'
      },
      {
        targetField: 'subjective.associatedSymptoms',
        options: ['soreness', 'stiffness', 'heaviness'],
        weightChange: 20,
        reason: '模板高疼痛常见酸痛僵硬沉重伴随'
      }
    ]
  },
  {
    id: 'tpl_pain_moderate',
    name: '模板规则: 中等疼痛评分',
    description: '疼痛评分 5-7 倾向 moderate',
    conditions: [
      { field: 'subjective.painScale.current', operator: 'gte', value: 5 },
      { field: 'subjective.painScale.current', operator: 'lte', value: 7 }
    ],
    effects: [
      {
        targetField: 'subjective.adlDifficulty.level',
        options: ['moderate', 'mild to moderate'],
        weightChange: 30,
        reason: '模板中等疼痛对应中等ADL困难'
      },
      {
        targetField: 'subjective.associatedSymptoms',
        options: ['soreness', 'stiffness'],
        weightChange: 15,
        reason: '模板中等疼痛常见酸痛僵硬伴随'
      }
    ]
  },
  {
    id: 'tpl_pain_mild',
    name: '模板规则: 低疼痛评分',
    description: '疼痛评分 <= 4 倾向 mild',
    conditions: [
      { field: 'subjective.painScale.current', operator: 'lte', value: 4 }
    ],
    effects: [
      {
        targetField: 'subjective.adlDifficulty.level',
        options: ['mild', 'mild to moderate'],
        weightChange: 30,
        reason: '模板低疼痛对应轻度ADL困难'
      },
      {
        targetField: 'subjective.associatedSymptoms',
        options: ['soreness'],
        weightChange: 10,
        reason: '模板低疼痛常见轻度酸痛伴随'
      }
    ]
  },
  {
    id: 'tpl_local_blood_stasis',
    name: '模板规则: 血瘀证型链',
    description: 'Blood Stasis 证型联动舌脉',
    conditions: [
      { field: 'assessment.tcmDiagnosis.localPattern', operator: 'equals', value: 'Blood Stasis' }
    ],
    effects: [
      {
        targetField: 'objective.tonguePulse.tongue',
        options: ['purple'],
        weightChange: 30,
        reason: '模板血瘀证常见紫舌'
      },
      {
        targetField: 'objective.tonguePulse.pulse',
        options: ['deep'],
        weightChange: 30,
        reason: '模板血瘀证常见沉涩脉'
      }
    ]
  },
  {
    id: 'tpl_local_qi_stagnation',
    name: '模板规则: 气滞证型链',
    description: 'Qi Stagnation 证型联动疼痛与舌脉',
    conditions: [
      { field: 'assessment.tcmDiagnosis.localPattern', operator: 'equals', value: 'Qi Stagnation' }
    ],
    effects: [
      {
        targetField: 'subjective.painTypes',
        options: ['Aching', 'Squeezing'],
        weightChange: 20,
        reason: '模板气滞证常见胀痛/挤压痛'
      },
      {
        targetField: 'subjective.relievingFactors',
        options: ['stretching', 'resting', 'massage'],
        weightChange: 15,
        reason: '模板气滞疼痛常见拉伸休息按摩可缓解'
      },
      {
        targetField: 'objective.tonguePulse.tongue',
        options: ['thin white coat'],
        weightChange: 25,
        reason: '模板气滞证常见薄白苔'
      },
      {
        targetField: 'objective.tonguePulse.pulse',
        options: ['string-taut'],
        weightChange: 25,
        reason: '模板气滞证常见弦脉'
      }
    ]
  },
  {
    id: 'tpl_systemic_kidney_yang_def',
    name: '模板规则: 肾阳虚联动',
    description: 'Kidney Yang Deficiency 倾向深脉',
    conditions: [
      { field: 'assessment.tcmDiagnosis.systemicPattern', operator: 'equals', value: 'Kidney Yang Deficiency' }
    ],
    effects: [
      {
        targetField: 'objective.tonguePulse.pulse',
        options: ['deep'],
        weightChange: 20,
        reason: '模板肾阳虚常见沉脉'
      }
    ]
  },
  {
    id: 'tpl_chronic_supporting_chain',
    name: '模板规则: 慢性支持链',
    description: '慢性病程下的模板常见病因/加重因素/ADL/频率/目标',
    conditions: [
      { field: 'subjective.chronicityLevel', operator: 'equals', value: 'Chronic' }
    ],
    effects: [
      {
        targetField: 'subjective.causativeFactors',
        options: ['age related/degenerative changes', 'weather change'],
        weightChange: 25,
        reason: '模板慢性主诉常见退行性与环境触发'
      },
      {
        targetField: 'subjective.exacerbatingFactors',
        options: ['any strenuous activities', 'repetitive motions'],
        weightChange: 20,
        reason: '模板慢性病例常见活动加重'
      },
      {
        targetField: 'subjective.adlDifficulty.activities',
        options: ['performing household chores', 'Going up and down stairs'],
        weightChange: 20,
        reason: '模板慢性病例常见ADL受限'
      },
      {
        targetField: 'subjective.painFrequency',
        options: ['Constant (symptoms occur between 76% and 100% of the time)'],
        weightChange: 20,
        reason: '模板慢性病例常见高频症状'
      },
      {
        targetField: 'plan.shortTermGoal.treatmentFrequency',
        options: ['12'],
        weightChange: 20,
        reason: '模板慢性病例短期目标常见12次'
      },
      {
        targetField: 'assessment.generalCondition',
        options: ['fair'],
        weightChange: 15,
        reason: '模板复诊整体状态常见fair'
      },
      {
        targetField: 'subjective.relievingFactors',
        options: ['resting', 'stretching', 'massage', 'changing positions'],
        weightChange: 20,
        reason: '模板慢性病例常见通过休息/体位/拉伸/按摩缓解'
      }
    ]
  },
  {
    id: 'tpl_tx_change_improved_reason',
    name: '模板规则: 复诊改善原因链',
    description: '症状改善时优先匹配模板正向改善原因',
    conditions: [
      { field: 'subjective.symptomChange', operator: 'equals', value: 'improvement of symptom(s)' }
    ],
    effects: [
      {
        targetField: 'subjective.reasonConnector',
        options: ['because of'],
        weightChange: 25,
        reason: '模板改善陈述常用连接词because of'
      },
      {
        targetField: 'subjective.reason',
        options: ['energy level improved', 'sleep quality improved', 'more energy level throughout the day'],
        weightChange: 30,
        reason: '模板改善陈述常见精力/睡眠改善'
      },
      {
        targetField: 'subjective.reason',
        options: ['reduced level of pain', 'less difficulty performing daily activities'],
        weightChange: 25,
        reason: '模板改善陈述常见疼痛与ADL改善'
      }
    ]
  },
  {
    id: 'tpl_tx_change_relapse_reason',
    name: '模板规则: 复诊反复原因链',
    description: '隔日反复时优先匹配持续治疗类原因',
    conditions: [
      { field: 'subjective.symptomChange', operator: 'equals', value: 'improvement after treatment, but pain still came back next day' }
    ],
    effects: [
      {
        targetField: 'subjective.reasonConnector',
        options: ['due to'],
        weightChange: 20,
        reason: '模板反复陈述常用连接词due to'
      },
      {
        targetField: 'subjective.reason',
        options: ['continuous treatment', 'maintain regular treatments', 'still need more treatments to reach better effect'],
        weightChange: 30,
        reason: '模板反复陈述常见持续治疗原因'
      }
    ]
  },
  {
    id: 'tpl_tx_change_exacerbate_reason',
    name: '模板规则: 复诊加重原因链',
    description: '症状加重时优先匹配模板负向触发原因',
    conditions: [
      { field: 'subjective.symptomChange', operator: 'equals', value: 'exacerbate of symptom(s)' }
    ],
    effects: [
      {
        targetField: 'subjective.reasonConnector',
        options: ['due to', 'because of'],
        weightChange: 20,
        reason: '模板加重陈述常用连接词due to/because of'
      },
      {
        targetField: 'subjective.reason',
        options: [
          'did not have good rest',
          'intense work',
          'bad posture',
          'exposure to cold air',
          'skipped treatments',
          'stopped treatment for a while',
          'discontinuous treatment',
          'weak constitution'
        ],
        weightChange: 30,
        reason: '模板加重陈述常见劳累/姿势/受寒/间断治疗'
      }
    ]
  },
  {
    id: 'tpl_tx_change_similar_reason',
    name: '模板规则: 复诊相近原因链',
    description: '症状相近时优先匹配维持治疗与待观察原因',
    conditions: [
      { field: 'subjective.symptomChange', operator: 'equals', value: 'similar symptom(s) as last visit' }
    ],
    effects: [
      {
        targetField: 'subjective.reasonConnector',
        options: ['and', 'may related of'],
        weightChange: 20,
        reason: '模板相近陈述常用连接词and/may related of'
      },
      {
        targetField: 'subjective.reason',
        options: ['maintain regular treatments', 'continuous treatment', 'uncertain reason'],
        weightChange: 25,
        reason: '模板相近陈述常见维持治疗/原因未明'
      }
    ]
  },
  {
    id: 'tpl_systemic_deficiency_assoc',
    name: '模板规则: 虚证伴随症状链',
    description: '系统证型含Deficiency时偏弱/麻木',
    conditions: [
      { field: 'assessment.tcmDiagnosis.systemicPattern', operator: 'contains', value: 'Deficiency' }
    ],
    effects: [
      {
        targetField: 'subjective.associatedSymptoms',
        options: ['weakness', 'numbness'],
        weightChange: 20,
        reason: '模板虚证常见乏力/麻木伴随'
      }
    ]
  },
  {
    id: 'tpl_objective_knee_chain',
    name: '模板规则: 膝部客观检查链',
    description: '膝部场景下的肌肉/分级/穴位偏好',
    conditions: [
      { field: 'subjective.adlDifficulty.activities', operator: 'contains', value: 'stairs' }
    ],
    effects: [
      {
        targetField: 'objective.muscleTesting.muscles',
        options: ['Quadriceps', 'Hamstrings'],
        weightChange: 25,
        reason: '模板膝部检查常见股四头/腘绳肌'
      },
      {
        targetField: 'objective.muscleTesting.tightness.gradingScale',
        options: ['moderate'],
        weightChange: 20,
        reason: '模板膝部紧张度常见moderate'
      },
      {
        targetField: 'objective.muscleTesting.tenderness.gradingScale',
        options: ['(+2) = Patient states that the area is moderately tender'],
        weightChange: 20,
        reason: '模板压痛分级常见(+2)'
      },
      {
        targetField: 'plan.needleProtocol.points',
        options: ['A SHI POINTS'],
        weightChange: 20,
        reason: '模板针刺方案常见阿是穴'
      }
    ]
  },
  {
    id: 'tpl_pattern_defaults',
    name: '模板规则: 证型默认联动',
    description: '疼痛与慢性信息联动常见证型与治则动词',
    conditions: [
      { field: 'subjective.painScale.current', operator: 'gte', value: 6 }
    ],
    effects: [
      {
        targetField: 'assessment.tcmDiagnosis.localPattern',
        options: ['Qi Stagnation', 'Blood Stasis'],
        weightChange: 20,
        reason: '模板中高疼痛常见气滞/血瘀'
      },
      {
        targetField: 'assessment.tcmDiagnosis.systemicPattern',
        options: ['Kidney Yang Deficiency', 'Kidney Qi Deficiency'],
        weightChange: 20,
        reason: '模板常见系统证型偏肾系'
      },
      {
        targetField: 'assessment.treatmentPrinciples.focusOn',
        options: ['focus', 'emphasize'],
        weightChange: 20,
        reason: '模板治则动词常见focus/emphasize'
      }
    ]
  }
]
