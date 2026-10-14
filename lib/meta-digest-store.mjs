import {get, put, BlobPreconditionFailedError} from '@vercel/blob';

// No names, contact details or answers are stored here. All reads bypass the CDN.
const path = 'szomex/meta-digest/state-v1.json';
export function blobDigestStore() {
  return {
    async read() {
      const result = await get(path, {access: 'private', useCache: false});
      if (!result) return {value: null, version: null};
      if (result.statusCode !== 200 || !result.blob.etag) throw new Error('STATE_READ');
      return {value: await new Response(result.stream).json(), version: result.blob.etag};
    },
    async compareAndSet(version, value) {
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
