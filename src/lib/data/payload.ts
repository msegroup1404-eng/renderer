const PAYLOAD_URL = process.env.PAYLOAD_URL || 'http://localhost:4000'
const PAYLOAD_TOKEN = process.env.PAYLOAD_TOKEN || ''
import templateSnapshot from '../../templates/snapshots/new.json'
import pageOverrides from '../../templates/snapshots/page-override.json'
import tenantOverrides from '../../templates/snapshots/tenant-override.json'

async function payloadGet(path: string) {
  const url = path.startsWith('http') ? path : `${PAYLOAD_URL}/api${path.startsWith('/') ? path : '/' + path}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${PAYLOAD_TOKEN}`, 'Content-Type': 'application/json' } })
  if (!res.ok) return null
  return res.json()
}

export async function fetchTenantById(id: string) { return payloadGet(`/tenants/${id}`) }

export async function fetchPageBySlug(tenantId: string, slug: string) {
  const q = `/pages?where[tenant][equals]=${tenantId}&where[slug][equals]=${encodeURIComponent(slug)}&limit=1`
  const json = await payloadGet(q)
  return json?.docs?.[0] ?? null
}

export async function fetchProductBySlug(tenantId: string, slug: string) {
  const q = `/products?where[tenant][equals]=${tenantId}&where[slug][equals]=${encodeURIComponent(slug)}&limit=1`
  const json = await payloadGet(q)
  return json?.docs?.[0] ?? null
}

export async function fetchTemplateSnapshotFromPayload(tenantId: string, templateId: string) {
  // custom payload endpoint: /templates/:tenantId/:templateId/snapshot
  const url = `${PAYLOAD_URL}/api/templates/${encodeURIComponent(tenantId)}/${encodeURIComponent(templateId)}/snapshot`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${PAYLOAD_TOKEN}` }
  })
  if (!res.ok) return null
  const j = await res.json()
  return j.snapshot ?? j
}

export async function fetchTemplateSnapshotFromJson() {

  return { templateSnapshot, pageOverrides, tenantOverrides }
}