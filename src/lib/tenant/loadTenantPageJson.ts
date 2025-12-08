// apps/storefront/src/lib/tenant/loadTenantPage.ts
/**
 * loadTenantPage.ts
 *
 * Optimized data-loading pipeline:
 * - Prioritizes cache hits for merged data.
 * - Uses tenantSlug consistently for keys.
 * - safeDeserialize only when necessary.
 * - Preloads components in parallel.
 * - Caches with longer TTL for stable pages.
 * - Simplifies error handling with defaults.
 * - Assumes new Puck data model without 'zones'.
 */

import crypto from "crypto";
import { type Data as PuckData } from '@measured/puck'; // Import official Puck Data type

import {
  fetchTenantById,
  fetchPageBySlug,
  fetchProductBySlug,
  fetchTemplateSnapshotFromPayload,
  fetchTemplateSnapshotFromJson
} from "../data/payload";

import { safeDeserialize } from "../puck/safeDeserialize";
import { mergeTemplateWithPage } from "../templates/mergeEngine`";
import { collectTypesFromPuck } from "../puck/puckUtils";
import { preloadComponents } from "../puck/componentRegistry.server";
import { getRedisJSON, setRedisJSON } from "../cache";
import { TemplateSnapshot } from "@/templates/types";


export type LoadTenantPageResult = {
  tenant: any | null;
  page: any | null;
  product: any | null;
  templateSnapshot: TemplateSnapshot | null;
  merged: TemplateSnapshot | null;
  pageHash: string | null;
  cacheHit: boolean;
};

function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

export async function loadTenantPageJson(
  tenantSlug: string,
  path: string,
  opts: { useCache?: boolean; preview?: boolean } = {}
): Promise<any> {
const { templateSnapshot, pageOverrides, tenantOverrides } = await fetchTemplateSnapshotFromJson()


  // TODO: must be fixed
  const merged = mergeTemplateWithPage(templateSnapshot, tenantOverrides ?? {}, pageOverrides ?? {});

console.log(JSON.stringify(merged))
  return { tenant: { slug: 'asdfasd' }, merged, pageHash: 'fhdjkas'};
}