import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import PuckRenderer from '@/lib/puck/PuckRenderer.server';
import { loadTenantPage } from '@/lib/tenant/loadTenantPage';
import { loadTenantPageJson } from '@/lib/tenant/loadTenantPageJson';

export default async function Page({ params, searchParams }: any) {
  const headersList = await headers();

  const tenantId = headersList.get('x-tenant-id') || undefined;
  // const tenantId = searchParams?.tenantId as string | undefined;
  if (!tenantId) notFound();
  const path =
    '/' + (params?.slug ? (Array.isArray(params.slug) ? params.slug.join('/') : params.slug) : '');

  // const { tenant, merged, pageHash } = await loadTenantPage(tenantId, path, {
  const { tenant, merged, pageHash } = await loadTenantPageJson(tenantId, path, {
    useCache: true,
    preview: false
  });
console.log(merged)
  if (!merged) {
    notFound();
  }

  return (
    <PuckRenderer
      puckJson={merged}
      tenantSlug={tenant.slug}
      pageHash={pageHash}
    />
  );
}
