export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Regex to match static asset extensions
    const isAsset = /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(path);

    try {
      if (isAsset) {
        // Serve static asset from the Cloudflare Assets binding
        const assetResponse = await env.ASSETS.fetch(request);
        
        if (assetResponse.ok) {
           return assetResponse;
        }
        
        // If asset not found, return 404
        return new Response('Asset not found', { status: 404 });
      }

      // For non-asset requests (like /about, /merchant, etc.), serve the index.html
      // This enables React Router to handle client-side routing
      const indexUrl = new URL(url.origin);
      const indexRequest = new Request(indexUrl, request);
      return await env.ASSETS.fetch(indexRequest);
      
    } catch (error) {
      // Fallback error handling
      return new Response('Internal Server Error', { status: 500 });
    }
  }
};
