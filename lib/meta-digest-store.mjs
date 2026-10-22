import {get, put, BlobPreconditionFailedError} from '@vercel/blob';

// No names, contact details or answers are stored here. All reads bypass the CDN.
export function blobDigestStore(test = false, sdk = {get, put}) {
  const path = test === 'meta-test' ? 'szomex/meta-digest/meta-acceptance-test-v1.json'
    : test ? 'szomex/meta-digest/self-test-v1.json' : 'szomex/meta-digest/state-v1.json';
  return {
    async read() {
      let result = await sdk.get(path, {access: 'private', useCache: false});
      // Compression can weaken a download ETag once the JSON grows beyond 1 kB.
      // A weak validator cannot be used for a conditional write. Re-read the
      // complete, uncompressed representation; never strip W/ from a validator.
      if (result?.blob.etag?.startsWith('W/')) {
        console.warn('szomex_meta_digest_store', {code: 'STATE_WEAK_ETAG',
          contentEncoding: result.headers?.get('content-encoding') || null});
        await result.stream?.cancel();
        result = await sdk.get(path, {access: 'private', useCache: false,
          headers: {'Accept-Encoding': 'identity'}});
      }
      if (!result) return {value: null, version: null};
      if (result.statusCode !== 200 || !result.blob.etag) throw new Error('STATE_READ');
      if (result.blob.etag.startsWith('W/')) throw new Error('STATE_WEAK_ETAG');
      return {value: await new Response(result.stream).json(), version: result.blob.etag};
    },
    async compareAndSet(version, value) {
      if (Buffer.byteLength(JSON.stringify(value)) > 1000000) throw new Error('STATE_SIZE_LIMIT');
      try {
        const result = await sdk.put(path, JSON.stringify(value), {
          access: 'private', addRandomSuffix: false, contentType: 'application/json',
          allowOverwrite: Boolean(version), ...(version && {ifMatch: version}),
        });
        if (!result.etag) throw new Error('STATE_RECEIPT');
        return result.etag;
      } catch (error) {
        if (error instanceof BlobPreconditionFailedError) return null;
        // Creating a previously absent state can race with another invocation.
        if (!version && (await this.read()).value) return null;
        throw error;
      }
    },
  };
}
