/**
 * Real PDF Integration Test Script (CommonJS)
 * Run with: node src/parsers/optum-note/test-real-pdf.cjs
 */

const fs = require('fs')
const path = require('path')

// pdf-parse v2 API
const { PDFParse } = require('pdf-parse')

const { parseOptumNote } = require('../../../dist/parsers/optum-note/parser.js')

const PDF_DIR = '/Users/yhuan/Desktop/Code/achecker/Optum note'

async function testPDF(pdfPath) {
  const fileName = path.basename(pdfPath)
  console.log(`\n${'='.repeat(60)}`)
  console.log(`Testing: ${fileName}`)
  console.log('='.repeat(60))

  try {
    const dataBuffer = fs.readFileSync(pdfPath)
    const parser = new PDFParse({ verbosity: 0, data: dataBuffer })
    await parser.load()
    const pdfData = await parser.getText()
    const text = pdfData.pages.map(p => p.text).join('\n')

    const result = parseOptumNote(text)

    if (result.success && result.document) {
      const doc = result.document
      console.log(`✅ Parse SUCCESS`)
      console.log(`\n📋 Patient Info:`)
      console.log(`   Name: ${doc.header.patient.name}`)
      console.log(`   DOB: ${doc.header.patient.dob}`)
      console.log(`   ID: ${doc.header.patient.patientId}`)
      console.log(`   Gender: ${doc.header.patient.gender}`)
      console.log(`   Age: ${doc.header.patient.age}`)

      console.log(`\n📅 Dates:`)
      console.log(`   Date of Service: ${doc.header.dateOfService}`)
      console.log(`   Printed On: ${doc.header.printedOn}`)

      console.log(`\n🏥 Visit Records: ${doc.visits.length} visits`)

      for (let i = 0; i < doc.visits.length; i++) {
        const visit = doc.visits[i]
        console.log(`\n   --- Visit ${i + 1} ---`)
        console.log(`   Type: ${visit.subjective.visitType}`)
        console.log(`   Body Part: ${visit.subjective.bodyPart}`)
        console.log(`   Pain Types: ${visit.subjective.painTypes.join(', ')}`)
        console.log(`   Pain Scale: ${JSON.stringify(visit.subjective.painScale)}`)
        console.log(`   ROM Body Part: ${visit.objective.rom.bodyPart}`)
        console.log(`   ROM Items: ${visit.objective.rom.items.length}`)
        console.log(`   Tongue: ${visit.objective.tonguePulse.tongue}`)
        console.log(`   Pulse: ${visit.objective.tonguePulse.pulse}`)
        console.log(`   Treatment Time: ${visit.plan.treatmentTime} mins`)
        console.log(`   E-Stim: ${visit.plan.electricalStimulation ? 'Yes' : 'No'}`)
        console.log(`   Diagnosis Codes: ${visit.diagnosisCodes.map(c => c.icd10).join(', ')}`)
        console.log(`   Procedure Codes: ${visit.procedureCodes.map(c => c.cpt).join(', ')}`)
      }

      if (result.warnings.length > 0) {
        console.log(`\n⚠️  Warnings: ${result.warnings.length}`)
        result.warnings.forEach(w => console.log(`   - ${w.field}: ${w.message}`))
      }

      return { success: true, visits: doc.visits.length }
    } else {
      console.log(`❌ Parse FAILED`)
      console.log(`Errors:`)
      result.errors.forEach(e => console.log(`   - ${e.field}: ${e.message}`))
      return { success: false, errors: result.errors }
    }
  } catch (error) {
    console.log(`❌ Exception: ${error.message}`)
    return { success: false, error: error.message }
  }
}

async function main() {
  console.log('🔬 Optum Note PDF Parser - Real PDF Test')
  console.log('========================================\n')

  const pdfFiles = fs.readdirSync(PDF_DIR).filter(f => f.endsWith('.pdf'))
  console.log(`Found ${pdfFiles.length} PDF files\n`)

  const results = { success: 0, failed: 0, totalVisits: 0 }

  // Test all PDFs
  const testFiles = pdfFiles

  for (const file of testFiles) {
    const result = await testPDF(path.join(PDF_DIR, file))
    if (result.success) {
      results.success++
      results.totalVisits += result.visits
    } else {
      results.failed++
    }
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log('SUMMARY')
  console.log('='.repeat(60))
  console.log(`✅ Success: ${results.success}/${testFiles.length}`)
  console.log(`❌ Failed: ${results.failed}/${testFiles.length}`)
  console.log(`📊 Total Visits Parsed: ${results.totalVisits}`)
}

main().catch(console.error)
