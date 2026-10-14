import {get, put, BlobPreconditionFailedError} from '@vercel/blob';

// No names, contact details or answers are stored here. All reads bypass the CDN.
export function blobDigestStore(test = false) {
  const path = test ? 'szomex/meta-digest/self-test-v1.json' : 'szomex/meta-digest/state-v1.json';
  return {
    async read() {
      const result = await get(path, {access: 'private', useCache: false});
      if (!result) return {value: null, version: null};
      if (result.statusCode !== 200 || !result.blob.etag) throw new Error('STATE_READ');
      return {value: await new Response(result.stream).json(), version: result.blob.etag};
    },
    async compareAndSet(version, value) {
      if (Buffer.byteLength(JSON.stringify(value)) > 1000000) throw new Error('STATE_SIZE_LIMIT');
      try {
        const result = await put(path, JSON.stringify(value), {
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
