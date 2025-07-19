// This file makes environment variables available to the frontend by injecting them into the HTML
// The VITE_ prefix allows Vite to expose the variables to the client-side code

export function injectEnvVars(html: string): string {
  return html.replace(
    '<!-- ENV_VARS -->',
    `<script>
      window.ENV = {
        VITE_ARCGIS_CLIENT_ID: "${process.env.ARCGIS_CLIENT_ID || ''}"
      };
    </script>`
  );
}