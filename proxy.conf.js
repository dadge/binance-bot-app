// Proxy configuration for Angular dev server
// Using JS format to disable SSL verification

const PROXY_CONFIG = {
  '/api': {
    target: 'http://localhost:3000',
    secure: false,
    changeOrigin: true,
    logLevel: 'debug',
    // Bypass SSL certificate verification
    onProxyReq: (proxyReq, req, res) => {
      console.log('[Proxy] Forwarding:', req.method, req.url, '-> http://localhost:3000');
    },
    onError: (err, req, res) => {
      console.error('[Proxy] Error:', err.message);
    },
  },
};

module.exports = PROXY_CONFIG;
