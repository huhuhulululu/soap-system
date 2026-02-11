/**
 * 规则覆盖率报告
 * Day 5: 统计现有测试对规则的覆盖
 */
import * as fs from 'fs'
import * as path from 'path'

// 从代码中提取已实现的规则
function extractRulesFromCode(): string[] {
  const rules: Set<string> = new Set()
  
  // 扫描 checker 目录
  const checkerDir = 'parsers/optum-note/checker'
  const files = fs.readdirSync(checkerDir).filter(f => f.endsWith('.ts'))
  
  for (const file of files) {
    const content = fs.readFileSync(path.join(checkerDir, file), 'utf-8')
    // 匹配 ruleId: 'XXX' 或 'XXX' 作为规则ID
    const matches = content.matchAll(/ruleId['":\s]+['"]([A-Z]+\d+)['"]/g)
    for (const m of matches) {
      rules.add(m[1])
    }
  }
  
  return Array.from(rules).sort()
}

// 从测试文件中提取测试的规则
function extractTestedRules(): Map<string, number> {
  const tested = new Map<string, number>()
  
  const testDirs = [
    'src/generator/__tests__',
    'parsers/optum-note/checker/__tests__',
    'tests/unit'
  ]
  
  for (const dir of testDirs) {
    if (!fs.existsSync(dir)) continue
    const files = fs.readdirSync(dir).filter(f => f.includes('.test.'))
    
    for (const file of files) {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8')
      // 统计 it() 或 test() 数量
      const itCount = (content.match(/\bit\s*\(/g) || []).length
      const testCount = (content.match(/\btest\s*\(/g) || []).length
      tested.set(file, itCount + testCount)
    }
  }
  
  return tested
}

function main() {
  console.log('========================================')
  console.log('规则覆盖率报告')
  console.log('========================================\n')
  
  // 已实现规则
  const rules = extractRulesFromCode()
  console.log(`已实现规则: ${rules.length} 条`)
  console.log(rules.join(', '))
  
  // 测试文件统计
  console.log('\n测试文件统计:')
  const tested = extractTestedRules()
  let totalTests = 0
  for (const [file, count] of tested) {
    console.log(`  ${file}: ${count} 用例`)
    totalTests += count
  }
  
  console.log(`\n总测试用例: ${totalTests}`)
  
  // 按 SPEC 分类
  const specCoverage = {
    'AC-1 格式合规': { target: 10, current: 0 },
    'AC-2 选项合规': { target: 30, current: 0 },
    'AC-3 纵向逻辑': { target: 25, current: 0 },
    'AC-4 S-O-A链': { target: 20, current: 0 },
    'AC-5 部位特定': { target: 20, current: 0 },
    'AC-6 针刺协议': { target: 15, current: 0 },
    'AC-7 续写功能': { target: 20, current: 105 }  // 已有 stress-continuation
  }
  
  console.log('\n========================================')
  console.log('SPEC 覆盖状态')
  console.log('========================================')
  for (const [ac, { target, current }] of Object.entries(specCoverage)) {
    const pct = Math.round(current / target * 100)
    const status = pct >= 100 ? '✅' : pct > 0 ? '🔶' : '❌'
    console.log(`${status} ${ac}: ${current}/${target} (${pct}%)`)
  }
  
  // 保存报告
  fs.writeFileSync(
    'src/auditor/baselines/rule-coverage.json',
    JSON.stringify({
      implementedRules: rules,
      totalTests,
      specCoverage,
      timestamp: new Date().toISOString()
    }, null, 2)
  )
  
  console.log('\n报告已保存到 src/auditor/baselines/rule-coverage.json')
}

main()
