// src/lib/puck/PuckRenderer.server.tsx
import React, { Suspense } from 'react';
import { type Data as PuckData } from '@measured/puck'; // Import official Puck Data type

import sanitizeHtml from 'sanitize-html';

import { blockKey, getRedisJSON, setRedisJSON } from '../cache';
import { requireComponent } from './componentRegistry.server';
// import { renderToStaticMarkup } from 'react-dom/server'; // For HTML caching

/**
 * This renderer expects a standard Puck `data` object in the new slots model:
 * {
 *   content: [{ type, props: { id, ..., items: [{type, props}, ...] } }, ... ],
 *   root: { props: { ... } }
 * }
 *
 * No 'zones' object; nesting is inline in props (e.g., props.children or props.items).
 *
 * Optimizations:
 * - Recursive async rendering with Suspense for streaming.
 * - Detects slot fields automatically (arrays of {type, props}).
 * - Selective HTML caching for expensive/static components.
 * - Sanitizes HTML props inline.
 */

async function renderNode(
  node: PuckData['content'][number],
  tenantSlug: string,
  pageHash: string | null,
  metadata: any
): Promise<React.ReactNode> {
  const { type, props: rawProps } = node;
  const nodeId = rawProps?.id || `${type}-${Math.random().toString(36).slice(2)}`; // Fallback ID if missing

  let cachedHtml: string | null = null;
  let cacheKey: string | null = null;

  if (pageHash && shouldCacheHtml(type)) {
    cacheKey = blockKey(tenantSlug, pageHash, nodeId);
    const cached = await getRedisJSON(cacheKey);
    if (cached?.html) {
      cachedHtml = cached.html;
    }
  }

  if (cachedHtml) {
    return <div key={nodeId} dangerouslySetInnerHTML={{ __html: cachedHtml }} />;
  }
  console.log(type)
  const Comp = await requireComponent(type);

  // Prepare props: recurse on slot fields (arrays of {type, props})
  const props = { ...rawProps };
  for (const key in props) {
    const val = props[key];
    if (Array.isArray(val) && val.length > 0 && val[0]?.type && val[0]?.props) {
      props[key] = await Promise.all(
        val.map(async (child: PuckData['content'][number]) => 
          <Suspense key={child.props?.id || key} fallback={<div>Loading...</div>}>
            {await renderNode(child, tenantSlug, pageHash, metadata)}
          </Suspense>
        )
      );
    }
  }

  if (props?.html) props.html = sanitizeHtml(props.html);

  const element = React.createElement(Comp, { key: nodeId, ...props });

  // if (cacheKey) {
  //   const html = renderToStaticMarkup(element);
  //   await setRedisJSON(cacheKey, { html }, 3600); // 1 hour TTL
  // }

  return element;
}

// Helper to determine cacheable components
function shouldCacheHtml(type: string): boolean {
  return ['ProductGrid', 'HeavyComponent'].includes(type);
}

export async function renderPuckToReactNode(
  data: PuckData,
  tenantSlug: string,
  pageHash: string | null
): Promise<React.ReactNode> {
  const metadata = { tenantSlug, pageHash };

  const rootPropsRaw = data.root?.props || data.root || {};
  const rootProps = { ...rootPropsRaw };

  // Recurse on root slots if any
  // for (const key in rootProps) {
  //   const val = rootProps[key];
  //   if (Array.isArray(val) && val.length > 0 && val[0]?.type && val[0]?.props) {
  //     rootProps[key] = await Promise.all(
  //       val.map(async (child: PuckData['content'][number]) => 
  //         <Suspense key={child.props?.id || key} fallback={<div>Loading...</div>}>
  //           {await renderNode(child, tenantSlug, pageHash, metadata)}
  //         </Suspense>
  //       )
  //     );
  //   }
  // }

  // if (rootProps?.html) rootProps.html = sanitizeHtml(rootProps.html);

  const PageComp = await requireComponent('Page');

  const content = data.content || [];
  const children = await Promise.all(
    content.map(async(node: PuckData['content'][number], idx: number) => 
      <Suspense key={node.props?.id || idx} fallback={<div>Loading...</div>}>
        {await renderNode(node, tenantSlug, pageHash, metadata)}
      </Suspense>
    )
  );

  return React.createElement(PageComp, rootProps, children);
}

// Server component wrapper
export default async function PuckRenderer({
  puckJson,
  tenantSlug,
  pageHash,
}: {
  puckJson: PuckData;
  tenantSlug: string;
  pageHash: string | null;
}) {
  const node = await renderPuckToReactNode(puckJson, tenantSlug, pageHash);
  return <div data-puck-root>{node}</div>;
}

// TODO: If slot field names vary, consider loading minimal config metadata for slot keys per component to avoid assumption-based detection.