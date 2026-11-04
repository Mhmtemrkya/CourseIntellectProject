// Tarayıcıda yayınlanan web derlemesi (REACT_APP_WEB_DEMO=true). Web girişi şimdilik
// yalnız demo hesaplara açıktır; kural sunucuda zorlanır (WebDemoAccessPolicy), burası
// yalnız arayüzü buna göre sadeleştirir.
export const isWebDemoBuild = process.env.REACT_APP_WEB_DEMO === 'true';

/** Uygulamanın yayınlandığı taban yol ("/<gizli-yol>" ya da masaüstünde ""). */
export const appBasePath = (process.env.PUBLIC_URL ?? '').replace(/\/+$/, '');
