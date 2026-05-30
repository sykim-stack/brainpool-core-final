export function createStorage(config) {
  const baseUrl = `${config.url}/rest/v1`;
  const getHeaders = () => ({
    'apikey': config.key,
    'Authorization': `Bearer ${config.key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  });
  return {
    async get(params, ctx) {
      try {
        const url = new URL(`${baseUrl}/${params.table}`);
        url.searchParams.set('select', '*');
        if (params.query) {
          Object.entries(params.query).forEach(([k, v]) => {
            url.searchParams.set(k, `eq.${v}`);
          });
        }
        url.searchParams.set('limit', '1');
        const res = await fetch(url.toString(), { headers: getHeaders() });
        if (!res.ok) {
          ctx._error = `GET 실패: ${res.status} ${await res.text()}`;
          return ctx;
        }
        const data = await res.json();
        ctx.payload = ctx.payload || {};
        ctx.payload.data = data;
        return ctx;
      } catch (e) {
        ctx._error = `GET 실패: ${e.message}`;
        return ctx;
      }
    },
    async post(params, ctx) {
      try {
        const res = await fetch(`${baseUrl}/${params.table}?on_conflict=project_id`, {
          method: 'POST',
          headers: getHeaders(),
          body: JSON.stringify(params.payload)
        });
        if (!res.ok) {
          ctx._error = `POST 실패: ${res.status} ${await res.text()}`;
          return ctx;
        }
        return ctx;
      } catch (e) {
        ctx._error = `POST 실패: ${e.message}`;
        return ctx;
      }
    },
    async upsert(params, ctx) {
  try {
    const conflictCol = params.onConflict || 'project_id';
    const res = await fetch(`${baseUrl}/${params.table}?on_conflict=${conflictCol}`, {
      method: 'POST',
      headers: {
        ...getHeaders(),
        'Prefer': 'resolution=merge-duplicates,return=representation'
      },
      body: JSON.stringify(params.payload)
    });
    if (!res.ok) {
      const errText = await res.text();
      ctx._error = `UPSERT 실패: ${res.status} ${errText}`;
      return ctx;
    }
    const data = await res.json();
    console.log('[storage] upsert 성공:', data);
    return ctx;
  } catch (e) {
    ctx._error = `UPSERT 실패: ${e.message}`;
    return ctx;
  }
}
  };
}
