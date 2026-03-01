/**
 * GIAS (Get Information About Schools) Import Script
 *
 * Downloads the daily GIAS CSV extract from the DfE and upserts into the
 * gias_schools Supabase table. ~65k rows, runs in < 30 seconds.
 *
 * Usage:
 *   npx tsx scripts/import-gias.ts
 *
 * Note: The DfE GIAS service can be intermittently unavailable. If the
 * download fails with a 500 error, retry later — the service typically
 * returns within a few hours.
 */

import { createClient } from '@supabase/supabase-js'

const GIAS_CSV_URL =
  'https://ea-edubase-api-prod.azurewebsites.net/edubase/downloads/public/edubasealldata.csv'

const supabase = createClient(
  'https://ljxlfftbinfususycgtf.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqeGxmZnRiaW5mdXN1c3ljZ3RmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzNjY2NDQsImV4cCI6MjA4Nzk0MjY0NH0.CirhSlBYG_5J83jiTaOiOWjyarAobE_L4G5epXlsZ0k'
)

// Column indices from the GIAS CSV header
interface ColumnMap {
  URN: number
  EstablishmentName: number
  Street: number
  Locality: number
  Address3: number
  Town: number
  'County (name)': number
  Postcode: number
  TelephoneNum: number
  SchoolWebsite: number
  'HeadFirstName': number
  'HeadLastName': number
  'HeadTitle (name)': number
  'TypeOfEstablishment (name)': number
  'PhaseOfEducation (name)': number
  'LA (code)': number
  'LA (name)': number
  EstablishmentNumber: number
  'EstablishmentStatus (name)': number
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        result.push(current.trim())
        current = ''
      } else {
        current += char
      }
    }
  }
  result.push(current.trim())
  return result
}

function buildColumnMap(headerLine: string): ColumnMap {
  const headers = parseCSVLine(headerLine)
  const map: Record<string, number> = {}
  headers.forEach((h, i) => {
    map[h] = i
  })

  const required = [
    'URN', 'EstablishmentName', 'Street', 'Locality', 'Address3',
    'Town', 'County (name)', 'Postcode', 'TelephoneNum', 'SchoolWebsite',
    'HeadFirstName', 'HeadLastName', 'HeadTitle (name)',
    'TypeOfEstablishment (name)', 'PhaseOfEducation (name)',
    'LA (code)', 'LA (name)', 'EstablishmentNumber', 'EstablishmentStatus (name)',
  ]

  for (const col of required) {
    if (!(col in map)) {
      throw new Error(`Missing required column: ${col}`)
    }
  }

  return map as unknown as ColumnMap
}

async function importGias() {
  console.log('Downloading GIAS CSV...')
  const startTime = Date.now()

  const res = await fetch(GIAS_CSV_URL)
  if (!res.ok) {
    throw new Error(`Failed to download GIAS CSV: ${res.status} ${res.statusText}`)
  }

  const text = await res.text()
  const lines = text.split('\n')
  console.log(`  Downloaded ${lines.length} lines (${(text.length / 1024 / 1024).toFixed(1)} MB)`)

  if (lines.length < 2) {
    throw new Error('CSV file appears empty')
  }

  const colMap = buildColumnMap(lines[0])
  const col = (fields: string[], name: keyof ColumnMap): string => fields[colMap[name]] || ''

  // Parse and filter to open establishments only
  const rows: {
    urn: string
    establishment_name: string
    street: string | null
    locality: string | null
    address3: string | null
    town: string | null
    county: string | null
    postcode: string | null
    phone: string | null
    website: string | null
    head_first_name: string | null
    head_last_name: string | null
    head_title: string | null
    type_of_establishment: string | null
    phase_of_education: string | null
    la_code: string | null
    la_name: string | null
    establishment_number: string | null
    status: string | null
  }[] = []

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    const fields = parseCSVLine(line)
    const urn = col(fields, 'URN')
    if (!urn) continue

    const status = col(fields, 'EstablishmentStatus (name)')
    if (status !== 'Open') continue

    const name = col(fields, 'EstablishmentName')
    if (!name) continue

    rows.push({
      urn,
      establishment_name: name,
      street: col(fields, 'Street') || null,
      locality: col(fields, 'Locality') || null,
      address3: col(fields, 'Address3') || null,
      town: col(fields, 'Town') || null,
      county: col(fields, 'County (name)') || null,
      postcode: col(fields, 'Postcode') || null,
      phone: col(fields, 'TelephoneNum') || null,
      website: col(fields, 'SchoolWebsite') || null,
      head_first_name: col(fields, 'HeadFirstName') || null,
      head_last_name: col(fields, 'HeadLastName') || null,
      head_title: col(fields, 'HeadTitle (name)') || null,
      type_of_establishment: col(fields, 'TypeOfEstablishment (name)') || null,
      phase_of_education: col(fields, 'PhaseOfEducation (name)') || null,
      la_code: col(fields, 'LA (code)') || null,
      la_name: col(fields, 'LA (name)') || null,
      establishment_number: col(fields, 'EstablishmentNumber') || null,
      status,
    })
  }

  console.log(`  Parsed ${rows.length} open establishments`)

  // Upsert in batches of 500
  const BATCH_SIZE = 500
  let upserted = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE)
    const { error } = await supabase
      .from('gias_schools')
      .upsert(batch, { onConflict: 'urn' })

    if (error) {
      console.error(`  Error upserting batch at offset ${i}:`, error.message)
      continue
    }

    upserted += batch.length
    if (upserted % 5000 === 0 || i + BATCH_SIZE >= rows.length) {
      console.log(`  Upserted ${upserted} / ${rows.length}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nGIAS import complete: ${upserted} schools in ${elapsed}s`)
}

importGias().catch((err) => {
  console.error('Import failed:', err)
  process.exit(1)
})
