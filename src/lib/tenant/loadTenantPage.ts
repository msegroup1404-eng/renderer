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
import { mergeTemplateWithPage } from "../templates/mergeEngine";
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

export async function loadTenantPage(
  tenantSlug: string,
  path: string,
  opts: { useCache?: boolean; preview?: boolean } = {}
): Promise<LoadTenantPageResult> {
  const useCache = opts.useCache ?? true;
  const preview = opts.preview ?? false;
  const mergedCacheKey = `tenant:${tenantSlug}:page:${path}`;

  const tenant = await fetchTenantById(tenantSlug);
  if (!tenant) {
    return { tenant: null, page: null, product: null, templateSnapshot: null, merged: null, pageHash: null, cacheHit: false };
  }

  if (useCache && !preview) {
    const cached = await getRedisJSON(mergedCacheKey);
    if (cached) {
      return { tenant, ...cached, cacheHit: true };
    }
  }

  const [product, page] = await Promise.all([
    fetchProductBySlug(tenant.slug || tenant.id || tenant._id, path),
    fetchPageBySlug(tenant.slug || tenant.id || tenant._id, path),
  ]);

  const pageData: TemplateSnapshot | null = page?.puckData ? safeDeserialize(page.puckData) : null;

  const templateId =
    product?.templateVersion ||
    page?.templateVersion ||
    tenant.templateVersion ||
    tenant.template ||
    null;

  let templateSnapshot: any = null;
  if (templateId) {
    // templateSnapshot = await fetchTemplateSnapshotFromPayload(tenant.slug || tenant.id || tenant._id, templateId);
    templateSnapshot = safeDeserialize(templateSnapshot);
  }
  // const { template: templateSnapshot, tenantOverrides, pageOverrides } = await fetchTemplateSnapshotFromJson();

  const tenantOverrides = tenant.templateOverrides ?? tenant.themeTokens ?? null;

  // TODO: must be fixed
  const merged = mergeTemplateWithPage(templateSnapshot, tenantOverrides ?? {}, pageData ?? {});
  // const merged = templateSnapshot

  const pageHashInput = JSON.stringify({
    templateVersion: templateSnapshot?.version ?? templateSnapshot?.updatedAt ?? null,
    merged,
    productId: product?.id ?? product?._id ?? null,
  });
  const pageHash = sha256Hex(pageHashInput);

  const types = collectTypesFromPuck(merged);
  await preloadComponents(types);

  if (useCache && !preview) {
    const payload = { page, product, templateSnapshot, merged, pageHash };
    await setRedisJSON(mergedCacheKey, payload, 3600); // 1 hour TTL
  }

  return { tenant, page, product, templateSnapshot, merged, pageHash, cacheHit: false };
}